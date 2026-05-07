import { Request, Response } from 'express';
import { supabaseAdmin } from '../config/supabase';

export const getTeacherPermissions = async (req: Request, res: Response) => {
  const { school_id } = req.tenant!;
  const { id } = req.params;

  try {
    const { data, error } = await supabaseAdmin
      .from('teacher_permissions')
      .select('*')
      .eq('teacher_id', id)
      .eq('school_id', school_id)
      .single();

    if (error && error.code !== 'PGRST116') return res.status(500).json({ error: 'Error al obtener permisos.' });
    
    res.status(200).json(data || {
      teacher_id: id,
      can_manage_students: true,
      can_manage_events: true,
      can_view_finances: false,
      can_manage_payments: false,
      can_take_attendance: true,
      can_manage_categories: false
    });
  } catch {
    res.status(500).json({ error: 'Error interno.' });
  }
};

export const updateTeacherPermissions = async (req: Request, res: Response) => {
  const { school_id } = req.tenant!;
  const { id } = req.params;
  const { can_manage_students, can_manage_events, can_view_finances, can_manage_payments, can_take_attendance, can_manage_categories } = req.body;

  try {
    const { data: existing } = await supabaseAdmin
      .from('teacher_permissions')
      .select('id')
      .eq('teacher_id', id)
      .eq('school_id', school_id)
      .single();

    const payload = {
      school_id,
      teacher_id: id,
      can_manage_students: can_manage_students ?? true,
      can_manage_events: can_manage_events ?? true,
      can_view_finances: can_view_finances ?? false,
      can_manage_payments: can_manage_payments ?? false,
      can_take_attendance: can_take_attendance ?? true,
      can_manage_categories: can_manage_categories ?? false
    };

    let error;
    if (existing) {
      ({ error } = await supabaseAdmin.from('teacher_permissions').update(payload).eq('id', existing.id));
    } else {
      ({ error } = await supabaseAdmin.from('teacher_permissions').insert(payload));
    }

    if (error) return res.status(400).json({ error: error.message });
    res.status(200).json({ message: 'Permisos actualizados.' });
  } catch {
    res.status(500).json({ error: 'Error interno.' });
  }
};

export const getMyPermissions = async (req: Request, res: Response) => {
  const { school_id, user_id } = req.tenant!;

  try {
    const { data, error } = await supabaseAdmin
      .from('teacher_permissions')
      .select('*')
      .eq('teacher_id', user_id)
      .eq('school_id', school_id)
      .single();

    if (error) return res.status(200).json({
      can_manage_students: true,
      can_manage_events: true,
      can_view_finances: false,
      can_manage_payments: false,
      can_take_attendance: true,
      can_manage_categories: false
    });

    res.status(200).json(data);
  } catch {
    res.status(500).json({ error: 'Error interno.' });
  }
};
