import { Request, Response } from 'express';
import { supabaseAdmin } from '../config/supabase';

export const getPayments = async (req: Request, res: Response) => {
  const { school_id } = req.tenant!;
  const { type, month } = req.query;
  
  try {
    let query = supabaseAdmin
      .from('payments')
      .select('*, student:students(full_name), teacher:users(full_name)')
      .eq('school_id', school_id)
      .order('payment_date', { ascending: false });

    if (type) {
      query = query.eq('payment_type', type as string);
    }

    if (month) {
      query = query.eq('payment_month', parseInt(month as string));
    }

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: 'Fallo consulta financiera.' });
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: 'Error interno.' });
  }
};

export const getPaymentsByStudent = async (req: Request, res: Response) => {
  const { school_id } = req.tenant!;
  const { id: student_id } = req.params;

  try {
    const { data, error } = await supabaseAdmin
      .from('payments')
      .select('*')
      .eq('school_id', school_id)
      .eq('student_id', student_id)
      .eq('payment_type', 'mensualidad')
      .order('payment_date', { ascending: false });

    if (error) return res.status(500).json({ error: 'Error historial alumno.' });
    res.status(200).json(data);
  } catch(err) {
    res.status(500).json({ error: 'Excepción del sistema.' });
  }
};

export const registerStudentPayment = async (req: Request, res: Response) => {
  const { school_id } = req.tenant!;
  const { amount, payment_date, student_id, description, payment_month } = req.body;

  if (!amount || !payment_date || !student_id) {
    return res.status(400).json({ error: 'Faltan datos financieros requeridos.' });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('payments')
      .insert([{
        school_id, amount, payment_date, payment_type: 'mensualidad', student_id, description, payment_month
      }])
      .select().single();

    if (error) return res.status(500).json({ error: 'Error BD.' });
    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: 'Error guardando mensualidad.' });
  }
};

export const registerTeacherPayment = async (req: Request, res: Response) => {
  const { school_id } = req.tenant!;
  const { amount, payment_date, teacher_id, description } = req.body;

  if (!amount || !payment_date || !teacher_id) return res.status(400).json({ error: 'Datos incompletos.' });

  try {
    const { data, error } = await supabaseAdmin
      .from('payments')
      .insert([{
        school_id, amount, payment_date, payment_type: 'pago_profesor', teacher_id, description
      }])
      .select().single();

    if (error) return res.status(500).json({ error: 'Error de BD al emitir nómina.' });
    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: 'Excepción interna.' });
  }
};
