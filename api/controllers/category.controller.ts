import { Request, Response } from 'express';
import { supabaseAdmin } from '../config/supabase';

export const getCategories = async (req: Request, res: Response) => {
  const { school_id } = req.tenant!;
  try {
    const { data, error } = await supabaseAdmin
      .from('categories')
      .select('id, name, color, birth_year, created_at, category_teachers(teacher_id, users(full_name))')
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
  const { name, birth_year, color, teacher_ids } = req.body; // Cambiado a teacher_ids

  if (!name || !birth_year) return res.status(400).json({ error: 'Faltan campos obligatorios.' });

  try {
    // 1. Crear categoría
    const { data: category, error: catError } = await supabaseAdmin
      .from('categories')
      .insert([{ school_id, name, birth_year, color }])
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
  const { name, birth_year, color, teacher_ids } = req.body; // Cambiado a teacher_ids

  try {
    // 1. Actualizar categoría
    const { error: updateError } = await supabaseAdmin
      .from('categories')
      .update({ name, birth_year, color })
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
