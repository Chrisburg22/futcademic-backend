import { Request, Response } from 'express';
import { supabaseAdmin } from '../config/supabase';

export const getAttendancesByCategory = async (req: Request, res: Response) => {
  const { school_id } = req.tenant!;
  const { id } = req.params;
  const { date } = req.query;

  let query = supabaseAdmin
    .from('attendances')
    .select('*, student:students(full_name)')
    .eq('school_id', school_id)
    .eq('category_id', id);

  if (date) {
    query = query.eq('date', date);
  }

  const { data, error } = await query;

  if (error) return res.status(500).json({ error: error.message });
  res.status(200).json(data);
};

export const getAttendancesByStudent = async (req: Request, res: Response) => {
  const { school_id } = req.tenant!;
  const { id } = req.params;

  const { data, error } = await supabaseAdmin
    .from('attendances')
    .select('*')
    .eq('school_id', school_id)
    .eq('student_id', id)
    .order('date', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  res.status(200).json(data);
};

export const markTrainingComplete = async (req: Request, res: Response) => {
  const { school_id } = req.tenant!;
  const { id } = req.params;

  const { data, error } = await supabaseAdmin
    .from('trainings')
    .update({ is_completed: true })
    .eq('id', id)
    .eq('school_id', school_id)
    .select();

  if (error) return res.status(500).json({ error: error.message });
  res.status(200).json(data);
};

export const saveAttendances = async (req: Request, res: Response) => {
  const { school_id, user_id } = req.tenant!;
  const { category_id, date, type, records, training_id } = req.body;

  if (!category_id || !date || !type || !records || !Array.isArray(records)) {
    return res.status(400).json({ error: 'Payload incompleto.', received: { category_id, date, type, records_count: records?.length } });
  }

  try {
    console.log(`[ATTENDANCE] Saving: School=${school_id}, Cat=${category_id}, Date=${date}, Type=${type}, Records=${records.length}`);

    // 1. Obtener los estudiantes para validar y obtener sus IDs reales
    const studentIds = records.map((r: any) => r.student_id);
    const { data: students, error: studentsError } = await supabaseAdmin
      .from('students')
      .select('id, category_id')
      .in('id', studentIds)
      .eq('school_id', school_id);

    if (studentsError) {
      console.error('[ATTENDANCE] Error fetching students:', studentsError);
      return res.status(500).json({ error: 'Error validando estudiantes.', details: studentsError.message });
    }

    if (!students || students.length === 0) {
      console.warn('[ATTENDANCE] No students found for IDs:', studentIds);
      return res.status(400).json({ error: 'No se encontraron estudiantes válidos para esta escuela.' });
    }

    // 2. Preparar los registros para insertar
    const attendanceToInsert = records.map((r: any) => {
      const student = students.find(s => s.id === r.student_id);
      if (!student) return null;
      return {
        school_id,
        student_id: r.student_id,
        category_id: student.category_id,
        teacher_id: user_id,
        training_id: (training_id && training_id !== 'temp') ? training_id : null,
        date,
        type,
        present: r.present
      };
    }).filter(Boolean);

    if (attendanceToInsert.length === 0) {
      return res.status(400).json({ error: 'La lista de asistencia final está vacía.' });
    }

    // 3. Limpiar registros previos (manual upsert)
    // Borramos usando student_ids, date y type para ser específicos
    const { error: deleteError } = await supabaseAdmin
      .from('attendances')
      .delete()
      .in('student_id', studentIds)
      .eq('date', date)
      .eq('type', type)
      .eq('school_id', school_id);

    if (deleteError) {
      console.error('[ATTENDANCE] Error deleting old records:', deleteError);
      return res.status(500).json({ error: 'Error limpiando registros previos.', details: deleteError.message });
    }

    // 4. Insertar los nuevos registros
    const { error: insertError } = await supabaseAdmin
      .from('attendances')
      .insert(attendanceToInsert);

    if (insertError) {
      console.error('[ATTENDANCE] Error inserting new records:', insertError);
      return res.status(500).json({ error: 'Error al insertar registros.', details: insertError.message });
    }

    // 5. Marcar el entrenamiento como completado si aplica
    if (training_id && training_id !== 'temp') {
      const { error: trError } = await supabaseAdmin
        .from('trainings')
        .update({ is_completed: true })
        .eq('id', training_id)
        .eq('school_id', school_id);
      
      if (trError) console.error('[ATTENDANCE] Error updating training status:', trError);
    }

    console.log('[ATTENDANCE] Success!');
    res.status(200).json({ message: 'Asistencia sincronizada exitosamente.' });
  } catch (err: any) {
    console.error('[ATTENDANCE] Unexpected error:', err);
    res.status(500).json({ 
      error: 'Ocurrió un error inesperado.', 
      details: err.message || JSON.stringify(err)
    });
  }
};
