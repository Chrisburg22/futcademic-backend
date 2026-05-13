import { Request, Response } from 'express';
import { supabaseAdmin } from '../config/supabase';

export const getCategories = async (req: Request, res: Response) => {
  const { school_id } = req.tenant!;
  try {
    const { data, error } = await supabaseAdmin
      .from('categories')
      .select('id, name, color, birth_year, monthly_fee, created_at, category_teachers(teacher_id, users(full_name))')
      .eq('school_id', school_id)
      .order('birth_year', { ascending: false });

    if (error) return res.status(500).json({ error: 'Error al obtener categorías.' });
    
    // Simplificar estructura para el frontend
    const categories = data.map((cat: any) => ({
      ...cat,
      coaches_count: cat.category_teachers?.length || 0,
      teacher: cat.category_teachers?.[0]?.users?.full_name || null,
      teacher_id: cat.category_teachers?.[0]?.teacher_id || null,
      all_teachers: cat.category_teachers?.map((ct: any) => ({
        id: ct.teacher_id,
        full_name: ct.users?.full_name
      })) || []
    }));

    res.status(200).json(categories);
  } catch (err) {
    res.status(500).json({ error: 'Error interno.' });
  }
};

export const createCategory = async (req: Request, res: Response) => {
  const { school_id } = req.tenant!;
  const { name, birth_year, color, monthly_fee, teacher_ids } = req.body; // Cambiado a teacher_ids

  if (!name || !birth_year) return res.status(400).json({ error: 'Faltan campos obligatorios.' });

  try {
    // 1. Crear categoría
    const { data: category, error: catError } = await supabaseAdmin
      .from('categories')
      .insert([{ school_id, name, birth_year, color, monthly_fee: monthly_fee || 0 }])
      .select()
      .single();

    if (catError) {
      return res.status(400).json({ error: 'Falla guardando categoría.' });
    }

    // 2. Si hay profesores, asignar
    if (teacher_ids && Array.isArray(teacher_ids) && teacher_ids.length > 0) {
       const assignments = teacher_ids.map(t_id => ({ school_id, category_id: category.id, teacher_id: t_id }));
       await supabaseAdmin.from('category_teachers').insert(assignments);
    }

    res.status(201).json(category);
  } catch (err) {
    res.status(500).json({ error: 'Error interno.' });
  }
};

export const updateCategory = async (req: Request, res: Response) => {
  const { school_id } = req.tenant!;
  const { id } = req.params;
  const { name, birth_year, color, monthly_fee, teacher_ids } = req.body; // Cambiado a teacher_ids

  try {
    // 1. Actualizar categoría
    const { error: updateError } = await supabaseAdmin
      .from('categories')
      .update({ name, birth_year, color, monthly_fee })
      .eq('id', id)
      .eq('school_id', school_id);

    if (updateError) return res.status(400).json({ error: 'Error al actualizar categoría.' });

    // 2. Actualizar profesores
    if (teacher_ids !== undefined && Array.isArray(teacher_ids)) {
      await supabaseAdmin.from('category_teachers').delete().eq('category_id', id);

      if (teacher_ids.length > 0) {
        const assignments = teacher_ids.map(t_id => ({ school_id, category_id: id, teacher_id: t_id }));
        await supabaseAdmin.from('category_teachers').insert(assignments);
      }
    }

    res.status(200).json({ message: 'Categoría actualizada.' });
  } catch (err) {
    res.status(500).json({ error: 'Error interno.' });
  }
};

export const getMyCategoriesAsTeacher = async (req: Request, res: Response) => {
  const { school_id, user_id } = req.tenant!;
  try {
    const { data, error } = await supabaseAdmin
      .from('category_teachers')
      .select('category:categories(id, name, birth_year)')
      .eq('teacher_id', user_id)
      .eq('school_id', school_id);

    if (error) return res.status(500).json({ error: 'Error al obtener tus categorías.' });

    const categories = data.map((row: any) => row.category).filter(Boolean);
    res.status(200).json(categories);
  } catch (err) {
    res.status(500).json({ error: 'Error interno.' });
  }
};

export const createFullCategory = async (req: Request, res: Response) => {
  const { school_id } = req.tenant!;
  const {
    name,
    birth_year,
    color,
    monthly_fee,
    teacher_ids,
    days,
    start_time,
    venue_id,
    duration_minutes,
    recurrence_weeks,
  } = req.body;

  if (!name || !birth_year) {
    return res.status(400).json({ error: 'Faltan campos obligatorios.' });
  }

  try {
    const { data: category, error: catError } = await supabaseAdmin
      .from('categories')
      .insert([{ school_id, name, birth_year, color, monthly_fee: monthly_fee || 0 }])
      .select()
      .single();

    if (catError) {
      console.error('[createFullCategory] category insert error:', catError);
      return res.status(400).json({ error: `Error al crear categoría: ${catError.message}` });
    }

    const warnings: string[] = [];

    if (teacher_ids && Array.isArray(teacher_ids) && teacher_ids.length > 0) {
      const assignments = teacher_ids.map((t_id: string) => ({
        school_id,
        category_id: category.id,
        teacher_id: t_id,
      }));
      const { error: tError } = await supabaseAdmin
        .from('category_teachers')
        .insert(assignments);
      if (tError) {
        console.error('[createFullCategory] teacher insert error:', tError);
        warnings.push(`Profesores: ${tError.message}`);
      }
    }

    if (days && Array.isArray(days) && days.length > 0 && start_time) {
      const dayNames = ['D', 'L', 'M', 'Mi', 'J', 'V', 'S'];
      const dayDescriptions = days
        .map((d: number) => dayNames[d])
        .filter(Boolean)
        .join(', ');

      const { data: event, error: evError } = await supabaseAdmin
        .from('events')
        .insert([{
          school_id,
          category_id: category.id,
          venue_id: venue_id || null,
          date: new Date().toISOString().split('T')[0],
          start_time,
          type: 'entrenamiento',
          name,
          description: `${name} · ${dayDescriptions} ${start_time}`,
          is_recurring: true,
          recurring_weeks: recurrence_weeks || 12,
        }])
        .select()
        .single();

      if (evError) {
        console.error('[createFullCategory] event insert error:', evError);
        warnings.push(`Evento: ${evError.message}`);
      } else if (days.length > 0) {
        const trainingInserts: any[] = [];
        const startDate = new Date();
        const minDay = Math.min(...days);
        const daysUntilNext = ((minDay + 1) - startDate.getDay() + 7) % 7;
        startDate.setDate(startDate.getDate() + (daysUntilNext || 7));
        const weeks = recurrence_weeks || 12;

        for (let w = 0; w < weeks; w++) {
          for (const dayIndex of days) {
            const d = new Date(startDate);
            d.setDate(startDate.getDate() + w * 7 + (dayIndex - minDay));
            trainingInserts.push({
              school_id,
              event_id: event.id,
              category_id: category.id,
              venue_id: venue_id || null,
              date: d.toISOString().split('T')[0],
              start_time,
              type: 'entrenamiento',
            });
          }
        }

        if (trainingInserts.length > 0) {
          const { error: trError } = await supabaseAdmin
            .from('trainings')
            .insert(trainingInserts);
          if (trError) {
            console.error('[createFullCategory] training insert error:', trError);
            warnings.push(`Trainings: ${trError.message}`);
          }
        }
      }
    }

    res.status(201).json({
      message: 'Categoría creada con éxito.',
      category,
      ...(warnings.length > 0 && { warnings }),
    });
  } catch (err: any) {
    console.error('[createFullCategory] unexpected error:', err);
    res.status(500).json({ error: `Error interno: ${err.message}` });
  }
};

export const assignTeacher = async (req: Request, res: Response) => {
  const { school_id } = req.tenant!;
  const { id: category_id } = req.params;
  const { teacher_id } = req.body;

  if (!teacher_id) return res.status(400).json({ error: 'Falta ID del profesor.' });

  try {
    const { error } = await supabaseAdmin
      .from('category_teachers')
      .insert([{ school_id, category_id, teacher_id }]);

    if (error) return res.status(400).json({ error: 'Fallo al asignar (¿Ya está asignado?).' });
    
    res.status(201).json({ message: 'Profesor asignado con éxito.' });
  } catch (err) {
    res.status(500).json({ error: 'Error interno.' });
  }
};
