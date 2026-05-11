import { Request, Response } from 'express';
import { supabaseAdmin } from '../config/supabase';

export const getAttendancesByCategory = async (req: Request, res: Response) => {
  const { school_id } = req.tenant!;
  const { id: category_id } = req.params;
  const { date } = req.query;

  try {
    let query = supabaseAdmin
      .from('attendances')
      .select('*, student:students!inner(full_name)')
      .eq('school_id', school_id)
      .eq('category_id', category_id)
      .order('date', { ascending: false });

    if (date) query = query.eq('date', date as string);

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: 'Error al obtener asistencias.' });
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: 'Error interno.' });
  }
};

export const getAttendancesByStudent = async (req: Request, res: Response) => {
  const { school_id } = req.tenant!;
  const { id: student_id } = req.params;

  try {
    const { data, error } = await supabaseAdmin
      .from('attendances')
      .select('*')
      .eq('school_id', school_id)
      .eq('student_id', student_id)
      .order('date', { ascending: false });

    if (error) return res.status(500).json({ error: 'Fallo consulta.' });
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: 'Error servidor.' });
  }
};

export const markTrainingComplete = async (req: Request, res: Response) => {
  const { school_id } = req.tenant!;
  const { id: training_id } = req.params;

  try {
    const { error } = await supabaseAdmin
      .from('trainings')
      .update({ is_completed: true })
      .eq('id', training_id)
      .eq('school_id', school_id);

    if (error) return res.status(500).json({ error: 'Error al marcar sesión.' });
    res.status(200).json({ message: 'Sesión marcada como completada.' });
  } catch (err) {
    res.status(500).json({ error: 'Error interno.' });
  }
};

export const saveAttendances = async (req: Request, res: Response) => {
  const { school_id, user_id } = req.tenant!;
  const { category_id, date, type, records, training_id } = req.body;

  if (!category_id || !date || !type || !records || !Array.isArray(records)) {
    return res.status(400).json({ error: 'Payload incompleto.' });
  }

  try {
    const supabaseRecords = records.map((r: any) => ({
      studentId: r.student_id,
      present: r.present,
    }));

    const { data, error } = await supabaseAdmin.rpc('save_attendance_batch', {
      p_school_id: school_id,
      p_training_id: training_id || null,
      p_date: date,
      p_type: type,
      p_teacher_id: user_id,
      p_records: supabaseRecords,
    });

    if (error) return res.status(500).json({ error: 'Sucedió un error al guardar.' });

    res.status(200).json({ message: 'Asistencia sincronizada.' });
  } catch (err) {
    res.status(500).json({ error: 'Excepción servidor.' });
  }
};
