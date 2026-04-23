import { Request, Response } from 'express';
import { supabaseAdmin } from '../config/supabase';

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
      .select('*, category:categories(name)')
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

export const getTrainingsForDay = async (req: Request, res: Response) => {
  const { school_id } = req.tenant!;
  const { date, category_id } = req.query;

  if (!date) return res.status(400).json({ error: 'Fecha requerida.' });

  try {
    let query = supabaseAdmin
      .from('trainings')
      .select('*, category:categories(name), event:events(description)')
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
  const { category_id, date, start_time, type, description, recurringWeeks } = req.body;

  if (!category_id || !date || !type) {
    return res.status(400).json({ error: 'Faltan campos obligatorios.' });
  }

  try {
    const count = recurringWeeks ? parseInt(recurringWeeks) : 1;
    const is_recurring = count > 1;
    let recurring_end_date = null;

    if (is_recurring) {
      const d = new Date(date);
      d.setDate(d.getDate() + (count - 1) * 7);
      recurring_end_date = d.toISOString().split('T')[0];
    }

    // 1. Crear el Evento Maestro
    const { data: eventData, error: eventError } = await supabaseAdmin
      .from('events')
      .insert({
        school_id, category_id, date, start_time: start_time || null, type, description: description || null,
        is_recurring, recurring_weeks: is_recurring ? count : null, recurring_end_date
      })
      .select()
      .single();

    if (eventError) return res.status(400).json({ error: eventError.message });

    // 2. Generar Sesiones (Trainings)
    const trainingsToInsert = [];
    const firstDate = new Date(date);

    for (let i = 0; i < count; i++) {
        const trainingDate = new Date(firstDate);
        trainingDate.setDate(firstDate.getDate() + (i * 7));
        trainingsToInsert.push({
            school_id,
            event_id: eventData.id,
            category_id,
            date: trainingDate.toISOString().split('T')[0],
            start_time: start_time || null,
            type,
            is_completed: false,
            is_cancelled: false
        });
    }

    const { error: trainingError } = await supabaseAdmin
        .from('trainings')
        .insert(trainingsToInsert);

    if (trainingError) return res.status(400).json({ error: 'Error al generar sesiones.' });

    res.status(201).json(eventData);
  } catch (err) {
    res.status(500).json({ error: 'Error interno del servidor.' });
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
