import { Request, Response } from 'express';
import { supabaseAdmin } from '../config/supabase';

export const getAttendanceByDate = async (req: Request, res: Response) => {
  const { school_id } = req.tenant!;
  const { date } = req.query;

  if (!date) return res.status(400).json({ error: 'Fecha requerida.' });

  const { data, error } = await supabaseAdmin
    .from('attendances')
    .select('*, student:students(full_name)')
    .eq('school_id', school_id)
    .eq('date', date);

  if (error) return res.status(500).json({ error: error.message });
  res.status(200).json(data);
};

export const getStudentAttendanceHistory = async (req: Request, res: Response) => {
  const { school_id } = req.tenant!;
  const { studentId } = req.params;

  const { data, error } = await supabaseAdmin
    .from('attendances')
    .select('*')
    .eq('school_id', school_id)
    .eq('student_id', studentId)
    .order('date', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  res.status(200).json(data);
};

export const saveAttendances = async (req: Request, res: Response) => {
  const { school_id, user_id } = req.tenant!;
  const { category_id, date, type, records, training_id } = req.body;

  if (!category_id || !date || !type || !records || !Array.isArray(records)) {
    return res.status(400).json({ error: 'Payload incompleto.' });
  }

  try {
    // 1. Obtener los IDs de los estudiantes para validar y obtener su categoría real
    const studentIds = records.map((r: any) => r.student_id);
    const { data: students, error: studentsError } = await supabaseAdmin
      .from('students')
      .select('id, category_id')
      .in('id', studentIds)
      .eq('school_id', school_id);

    if (studentsError) throw studentsError;

    // 2. Preparar los registros para insertar
    const attendanceToInsert = records.map((r: any) => {
      const student = students.find(s => s.id === r.student_id);
      if (!student) return null;
      return {
        school_id,
        student_id: r.student_id,
        category_id: student.category_id, // Usamos la del estudiante para mayor precisión
        teacher_id: user_id,
        training_id: training_id || null,
        date,
        type,
        present: r.present
      };
    }).filter(Boolean);

    if (attendanceToInsert.length === 0) {
      return res.status(400).json({ error: 'No se encontraron estudiantes válidos.' });
    }

    // 3. Limpiar registros previos para evitar duplicados (puesto que falta la restricción UNIQUE en la DB)
    // Borramos solo los registros de los estudiantes que estamos enviando en esta fecha/tipo
    const { error: deleteError } = await supabaseAdmin
      .from('attendances')
      .delete()
      .in('student_id', studentIds)
      .eq('date', date)
      .eq('type', type)
      .eq('school_id', school_id);

    if (deleteError) throw deleteError;

    // 4. Insertar los nuevos registros
    const { error: insertError } = await supabaseAdmin
      .from('attendances')
      .insert(attendanceToInsert);

    if (insertError) throw insertError;

    // 5. Marcar el entrenamiento como completado si se proporcionó un training_id
    if (training_id) {
      await supabaseAdmin
        .from('trainings')
        .update({ is_completed: true })
        .eq('id', training_id)
        .eq('school_id', school_id);
    }

    res.status(200).json({ message: 'Asistencia sincronizada exitosamente.' });
  } catch (err: any) {
    console.error('Manual Save error:', err);
    res.status(500).json({ 
      error: 'Sucedió un error al guardar la asistencia.', 
      details: err.message 
    });
  }
};
