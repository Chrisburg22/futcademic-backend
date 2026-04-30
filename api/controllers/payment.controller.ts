import { Request, Response } from 'express';
import { supabaseAdmin } from '../config/supabase';
import { sendPushNotification } from '../config/push';

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

export const getPendingPayments = async (req: Request, res: Response) => {
  const { school_id } = req.tenant!;
  const month = parseInt(req.query.month as string) || new Date().getMonth() + 1;

  try {
    const { data: allStudents, error: studentsError } = await supabaseAdmin
      .from('students')
      .select('id, full_name, category_id, category:categories(name)')
      .eq('school_id', school_id);

    if (studentsError) return res.status(500).json({ error: 'Error consultando alumnos.' });

    const { data: paidThisMonth, error: paymentsError } = await supabaseAdmin
      .from('payments')
      .select('student_id')
      .eq('school_id', school_id)
      .eq('payment_type', 'mensualidad')
      .eq('payment_month', month);

    if (paymentsError) return res.status(500).json({ error: 'Error consultando pagos.' });

    const paidIds = new Set((paidThisMonth || []).map((p: any) => p.student_id));
    const pending = (allStudents || []).filter((s: any) => !paidIds.has(s.id));

    res.status(200).json({ month, pending, total_pending: pending.length, total_students: allStudents?.length ?? 0 });
  } catch (err) {
    res.status(500).json({ error: 'Error interno.' });
  }
};

export const registerStudentPayment = async (req: Request, res: Response) => {
  const { school_id } = req.tenant!;
  const { amount, payment_date, student_id, description, payment_month } = req.body;

  if (!amount || !payment_date || !student_id) {
    return res.status(400).json({ error: 'Faltan datos financieros requeridos.' });
  }

  // Si no se especifica el mes (ej. concepto no es mensualidad), usamos el mes de la fecha de pago
  const finalMonth = payment_month || parseInt(payment_date.split('-')[1]);

  try {
    const { data, error } = await supabaseAdmin
      .from('payments')
      .insert([{
        school_id, 
        amount, 
        payment_date, 
        payment_type: 'mensualidad', 
        student_id, 
        description, 
        payment_month: finalMonth
      }])
      .select().single();

    if (error) return res.status(500).json({ error: 'Error BD.' });

    // Notificar al padre del alumno si tiene push token
    try {
      const { data: student } = await supabaseAdmin
        .from('students')
        .select('full_name, parent_id')
        .eq('id', student_id)
        .single();

      if (student?.parent_id) {
        const { data: parent } = await supabaseAdmin
          .from('users')
          .select('push_token')
          .eq('id', student.parent_id)
          .single();

        if (parent?.push_token) {
          await sendPushNotification(
            parent.push_token,
            '✅ Pago registrado',
            `Se registró un pago de $${amount} para ${student.full_name} (${description || 'Mensualidad'}).`
          );
        }
      }
    } catch { /* no bloquear si falla la notificación */ }

    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: 'Error guardando mensualidad.' });
  }
};

export const registerTeacherPayment = async (req: Request, res: Response) => {
  const { school_id } = req.tenant!;
  const { amount, payment_date, teacher_id, description } = req.body;

  if (!amount || !payment_date || !teacher_id) return res.status(400).json({ error: 'Datos incompletos.' });

  const finalMonth = parseInt(payment_date.split('-')[1]);

  try {
    const { data, error } = await supabaseAdmin
      .from('payments')
      .insert([{
        school_id, 
        amount, 
        payment_date, 
        payment_type: 'pago_profesor', 
        teacher_id, 
        description,
        payment_month: finalMonth
      }])
      .select().single();

    if (error) return res.status(500).json({ error: 'Error de BD al emitir nómina.' });
    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: 'Excepción interna.' });
  }
};

