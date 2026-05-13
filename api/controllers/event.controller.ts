import { Request, Response } from 'express';
import { supabaseAdmin } from '../config/supabase';
import { sendPushNotification } from '../config/push';

export const cancelInstance = async (req: Request, res: Response) => {
  const { school_id } = req.tenant!;
  const { training_id, event_id, date } = req.body;

  if (!training_id && (!event_id || !date)) {
    return res.status(400).json({ error: 'Se requiere training_id o (event_id y date).' });
  }

  try {
    let query = supabaseAdmin
      .from('trainings')
      .update({ is_cancelled: true })
      .eq('school_id', school_id);

    if (training_id) {
      query = query.eq('id', training_id);
    } else {
      query = query.eq('event_id', event_id).eq('date', date);
    }

    const { error } = await query;

    if (error) return res.status(400).json({ error: 'Error al cancelar sesión.' });

    // Notificar a padres de alumnos en la categoría afectada
    try {
      let categoryId: string | null = null;
      if (training_id) {
        const { data: t } = await supabaseAdmin.from('trainings').select('category_id, date').eq('id', training_id).single();
        categoryId = t?.category_id ?? null;
      } else if (event_id) {
        const { data: e } = await supabaseAdmin.from('events').select('category_id').eq('id', event_id).single();
        categoryId = e?.category_id ?? null;
      }

      if (categoryId) {
        const { data: students } = await supabaseAdmin
          .from('students')
          .select('parent_id')
          .eq('category_id', categoryId)
          .eq('school_id', school_id)
          .not('parent_id', 'is', null);

        const parentIds = [...new Set((students ?? []).map((s: any) => s.parent_id).filter(Boolean))];

        if (parentIds.length > 0) {
          const { data: parents } = await supabaseAdmin
            .from('users')
            .select('push_token, id')
            .in('id', parentIds)
            .not('push_token', 'is', null);

          await Promise.all((parents ?? []).map((p: any) =>
            sendPushNotification(p.push_token, '❌ Sesión cancelada', 'Una sesión de entrenamiento ha sido cancelada.')
          ));

          const notificationRows = (parents ?? []).map((p: any) => ({
            school_id,
            user_id: p.id,
            title: '❌ Sesión cancelada',
            body: 'Una sesión de entrenamiento ha sido cancelada.',
            type: 'sesion_cancelada',
            data: { training_id, event_id, date }
          }));
          if (notificationRows.length > 0) {
            try { await supabaseAdmin.from('notifications').insert(notificationRows); } catch {}
          }
        }
      }
    } catch { /* no bloquear */ }

    res.status(200).json({ message: 'Sesión cancelada.' });
  } catch (err) {
    res.status(500).json({ error: 'Error interno.' });
  }
};

export const getEvents = async (req: Request, res: Response) => {
  const { school_id } = req.tenant!;
  const { category_id } = req.query;

  try {
    let query = supabaseAdmin
      .from('events')
      .select('*, category:categories(name), venue:venues(name, address)')
      .eq('school_id', school_id)
      .order('date', { ascending: true });

    if (category_id) query = query.eq('category_id', category_id);

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: 'Error al consultar agenda maestra.' });
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: 'Error interno.' });
  }
};

export const getEvent = async (req: Request, res: Response) => {
  const { school_id } = req.tenant!;
  const { id } = req.params;

  try {
    const { data, error } = await supabaseAdmin
      .from('events')
      .select('*, category:categories(name), venue:venues(name, address)')
      .eq('school_id', school_id)
      .eq('id', id)
      .single();

    if (error) return res.status(500).json({ error: 'Error al obtener evento.' });
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: 'Error interno.' });
  }
};

export const getTrainingsForDay = async (req: Request, res: Response) => {
  const { school_id } = req.tenant!;
  const { date, category_id } = req.query;

  if (!date) return res.status(400).json({ error: 'Fecha requerida.' });

  try {
    let query = supabaseAdmin
      .from('trainings')
      .select('*, category:categories(name), event:events(name, description), venue:venues(name, address)')
      .eq('school_id', school_id)
      .eq('date', date as string)
      .eq('is_cancelled', false)
      .order('start_time', { ascending: true });

    if (category_id) {
      query = query.eq('category_id', category_id);
    } else if (req.tenant!.role === 'profesor') {
      const { data: teacherCats } = await supabaseAdmin
        .from('category_teachers')
        .select('category_id')
        .eq('teacher_id', req.tenant!.user_id)
        .eq('school_id', school_id);
      const categoryIds = (teacherCats || []).map((r: any) => r.category_id);
      if (categoryIds.length === 0) return res.status(200).json([]);
      query = query.in('category_id', categoryIds);
    }

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: 'Error al obtener entrenamientos.' });
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: 'Error servidor.' });
  }
};

export const createEvent = async (req: Request, res: Response) => {
  const { school_id } = req.tenant!;
  const { name, category_id, date, start_time, end_time, type, description, recurringWeeks, venue_id, recurrenceRule } = req.body;

  if (!name || !category_id || !date || !type) {
    return res.status(400).json({ error: 'Faltan campos obligatorios.' });
  }

  try {
    const count = recurringWeeks ? Math.min(parseInt(recurringWeeks), 52) : 1;
    const is_recurring = count > 1 || !!recurrenceRule;
    let recurring_end_date = null;
    let storedRecurrenceRule = recurrenceRule || null;

    // Legacy weekly recurrence
    if (is_recurring && !recurrenceRule && count > 1) {
      const d = new Date(date);
      d.setDate(d.getDate() + (count - 1) * 7);
      recurring_end_date = d.toISOString().split('T')[0];
    }

    // Generate trainings based on recurrence rule
    const trainingsToInsert = generateTrainings({
      date,
      start_time,
      type,
      count,
      recurrenceRule,
      school_id,
      category_id,
      eventId: null, // Will be set after event creation
      venue_id: venue_id || null
    });

    // 1. Crear el Evento Maestro
    const { data: eventData, error: eventError } = await supabaseAdmin
      .from('events')
      .insert({
        school_id, category_id, date, start_time: start_time || null, end_time: end_time || null, type, 
        name: name, description: description || null,
        is_recurring, recurring_weeks: is_recurring ? count : null, recurring_end_date,
        venue_id: venue_id || null,
        recurrence_rule: storedRecurrenceRule
      })
      .select()
      .single();

    if (eventError) return res.status(400).json({ error: eventError.message });

    // Assign event_id to trainings
    const trainingsWithEventId = trainingsToInsert.map(t => ({ ...t, event_id: eventData.id }));

    // 2. Generar Sesiones (Trainings)
    const { error: trainingError } = await supabaseAdmin
        .from('trainings')
        .insert(trainingsWithEventId);

    if (trainingError) return res.status(400).json({ error: 'Error al generar sesiones.' });

    res.status(201).json(eventData);
  } catch (err) {
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
};

export const updateEvent = async (req: Request, res: Response) => {
  const { school_id } = req.tenant!;
  const { id } = req.params;
  const { name, category_id, description, venue_id, start_time, end_time } = req.body;

  try {
    const { data, error } = await supabaseAdmin
      .from('events')
      .update({
        name,
        category_id,
        description,
        venue_id,
        start_time,
        end_time,
        updated_at: new Date()
      })
      .eq('id', id)
      .eq('school_id', school_id)
      .select()
      .single();

    if (error) return res.status(400).json({ error: 'Error al actualizar evento.' });
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: 'Error interno.' });
  }
};

export const deleteEvent = async (req: Request, res: Response) => {
  const { school_id } = req.tenant!;
  const { id } = req.params;

  try {
    const { error } = await supabaseAdmin
      .from('events')
      .delete()
      .eq('id', id)
      .eq('school_id', school_id);

    if (error) return res.status(400).json({ error: 'No se pudo eliminar el evento.' });
    res.status(200).json({ message: 'Evento eliminado.' });
  } catch (err) {
    res.status(500).json({ error: 'Error interno.' });
  }
};

export const getTrainingsByEvent = async (req: Request, res: Response) => {
  const { school_id } = req.tenant!;
  const { id } = req.params;

  try {
    const { data, error } = await supabaseAdmin
      .from('trainings')
      .select('*')
      .eq('school_id', school_id)
      .eq('event_id', id)
      .order('date', { ascending: true });

    if (error) return res.status(500).json({ error: 'Error al obtener sesiones del evento.' });
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: 'Error interno.' });
  }
};

interface TrainingGenerationParams {
  date: string;
  start_time?: string;
  type: string;
  count: number;
  recurrenceRule?: any;
  school_id: string;
  category_id: string;
  eventId: string | null;
  venue_id: string | null;
}

function generateTrainings(params: TrainingGenerationParams) {
  const { date, start_time, type, count, recurrenceRule, school_id, category_id, venue_id } = params;
  const trainings: any[] = [];
  const firstDate = new Date(date + 'T00:00:00');

  if (!recurrenceRule || !recurrenceRule.pattern) {
    for (let i = 0; i < count; i++) {
      const trainingDate = new Date(firstDate);
      trainingDate.setDate(firstDate.getDate() + (i * 7));
      trainings.push(createTrainingRow(trainingDate, school_id, category_id, start_time, type, venue_id));
    }
    return trainings;
  }

  const { pattern, daysOfWeek, endDate } = recurrenceRule;

  if (pattern === 'weekly') {
    if (daysOfWeek && daysOfWeek.length > 0) {
      const end = endDate ? new Date(endDate + 'T00:00:00') : null;
      const maxWeeks = count || 52;
      const dayOfWeek = firstDate.getDay();
      let current = new Date(firstDate);
      let weeksGenerated = 0;

      while (weeksGenerated < maxWeeks) {
        for (const dow of daysOfWeek.sort()) {
          const trainingDate = new Date(current);
          trainingDate.setDate(current.getDate() + (dow - dayOfWeek));
          if (trainingDate < firstDate) continue;
          if (end && trainingDate > end) break;
          trainings.push(createTrainingRow(trainingDate, school_id, category_id, start_time, type, venue_id));
        }
        current.setDate(current.getDate() + 7);
        weeksGenerated++;
        if (end && current > end) break;
      }
    } else {
      for (let i = 0; i < count; i++) {
        const trainingDate = new Date(firstDate);
        trainingDate.setDate(firstDate.getDate() + (i * 7));
        trainings.push(createTrainingRow(trainingDate, school_id, category_id, start_time, type, venue_id));
      }
    }
  } else if (pattern === 'biweekly') {
    for (let i = 0; i < count; i++) {
      const trainingDate = new Date(firstDate);
      trainingDate.setDate(firstDate.getDate() + (i * 14));
      trainings.push(createTrainingRow(trainingDate, school_id, category_id, start_time, type, venue_id));
    }
  } else if (pattern === 'monthly') {
    for (let i = 0; i < count; i++) {
      const trainingDate = new Date(firstDate);
      trainingDate.setMonth(firstDate.getMonth() + i);
      trainings.push(createTrainingRow(trainingDate, school_id, category_id, start_time, type, venue_id));
    }
  }

  return trainings;
}

function createTrainingRow(date: Date, school_id: string, category_id: string, start_time: string | undefined, type: string, venue_id: string | null) {
  return {
    school_id,
    event_id: null,
    category_id,
    date: date.toISOString().split('T')[0],
    start_time: start_time || null,
    type,
    is_completed: false,
    is_cancelled: false,
    venue_id
  };
}
