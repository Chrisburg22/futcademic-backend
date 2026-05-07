import { Request, Response } from 'express';
import { supabaseAdmin } from '../config/supabase';
import { sendPushNotification } from '../config/push';

export const getPayments = async (req: Request, res: Response) => {
  const { school_id } = req.tenant!;
  const { type, month } = req.query;
  
  try {
    let query = supabaseAdmin
      .from('payments')
      .select('*, student:students(full_name), teacher:users(full_name), payment_students:payment_students(student_id, amount, student:students(full_name))')
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
    // Pagos directos
    const { data: directPayments, error: directError } = await supabaseAdmin
      .from('payments')
      .select('*')
      .eq('school_id', school_id)
      .eq('student_id', student_id)
      .eq('payment_type', 'mensualidad')
      .order('payment_date', { ascending: false });

    if (directError) return res.status(500).json({ error: 'Error historial alumno.' });

    // Pagos grupales donde aparece este alumno
    const { data: groupPayments, error: groupError } = await supabaseAdmin
      .from('payment_students')
      .select('payment:payments(*)')
      .eq('student_id', student_id);

    if (groupError) return res.status(500).json({ error: 'Error historial alumno.' });

    const groupPaymentsFlat = (groupPayments || []).map((gp: any) => gp.payment);
    const allPayments = [...(directPayments || []), ...groupPaymentsFlat]
      .sort((a, b) => new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime());

    res.status(200).json(allPayments);
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

    // Alumnos con pago directo este mes
    const { data: paidDirect, error: paymentsError } = await supabaseAdmin
      .from('payments')
      .select('student_id')
      .eq('school_id', school_id)
      .eq('payment_type', 'mensualidad')
      .eq('payment_month', month);

    // Alumnos con pago grupal este mes
    const { data: paidGroup, error: groupError } = await supabaseAdmin
      .from('payment_students')
      .select('student_id')
      .eq('payment_id', supabaseAdmin.from('payments').select('id').eq('school_id', school_id).eq('payment_type', 'mensualidad').eq('payment_month', month));

    if (paymentsError) return res.status(500).json({ error: 'Error consultando pagos.' });

    const paidIds = new Set([
      ...(paidDirect || []).map((p: any) => p.student_id),
      ...(paidGroup || []).map((p: any) => p.student_id)
    ]);
    const pending = (allStudents || []).filter((s: any) => !paidIds.has(s.id));

    res.status(200).json({ month, pending, total_pending: pending.length, total_students: allStudents?.length ?? 0 });
  } catch (err) {
    res.status(500).json({ error: 'Error interno.' });
  }
};

export const registerStudentPayment = async (req: Request, res: Response) => {
  const { school_id } = req.tenant!;
  const { amount, payment_date, student_id, student_ids, description, payment_month } = req.body;

  const students = student_ids || (student_id ? [student_id] : []);
  if (!amount || !payment_date || students.length === 0) {
    return res.status(400).json({ error: 'Faltan datos financieros requeridos.' });
  }

  // Si no se especifica el mes (ej. concepto no es mensualidad), usamos el mes de la fecha de pago
  const finalMonth = payment_month || parseInt(payment_date.split('-')[1]);

  try {
    if (students.length === 1) {
      // Pago individual (comportamiento original)
      const { data, error } = await supabaseAdmin
        .from('payments')
        .insert([{
          school_id, 
          amount, 
          payment_date, 
          payment_type: 'mensualidad', 
          student_id: students[0], 
          description, 
          payment_month: finalMonth
        }])
        .select().single();

      if (error) return res.status(500).json({ error: 'Error BD.' });

      // Notificar al padre del alumno si tiene push token
      await notifyParents(school_id, students[0], amount, description);

      res.status(201).json(data);
    } else {
      // Pago grupal: crear un payment padre + registros en payment_students
      const perStudentAmount = (parseFloat(amount) / students.length).toFixed(2);

      const { data: paymentData, error: paymentError } = await supabaseAdmin
        .from('payments')
        .insert([{
          school_id,
          amount,
          payment_date,
          payment_type: 'mensualidad',
          student_id: null, // Pago grupal, no ligado a un solo alumno
          description: description || `Pago grupal (${students.length} alumnos)`,
          payment_month: finalMonth
        }])
        .select()
        .single();

      if (paymentError) return res.status(500).json({ error: 'Error BD.' });

      const paymentStudentRows = students.map((sid: string) => ({
        payment_id: paymentData.id,
        student_id: sid,
        amount: perStudentAmount
      }));

      const { error: psError } = await supabaseAdmin
        .from('payment_students')
        .insert(paymentStudentRows);

      if (psError) return res.status(500).json({ error: 'Error vinculando alumnos al pago.' });

      // Notificar a todos los padres
      await Promise.all(students.map((sid: string) => notifyParents(school_id, sid, perStudentAmount, description)));

      res.status(201).json({ ...paymentData, student_count: students.length });
    }
  } catch (err) {
    res.status(500).json({ error: 'Error guardando mensualidad.' });
  }
};

async function notifyParents(school_id: string, student_id: string, amount: string, description?: string) {
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

      try { await supabaseAdmin.from('notifications').insert({
        school_id,
        user_id: student.parent_id,
        title: '✅ Pago registrado',
        body: `Se registró un pago de $${amount} para ${student.full_name}.`,
        type: 'pago_recibido',
        data: { student_id, amount, description }
      }); } catch {}
    }
  } catch { /* no bloquear */ }
}

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

export const getAccountStatement = async (req: Request, res: Response) => {
  const { school_id, user_id, role } = req.tenant!;
  const { studentId } = req.params;

  try {
    const { data: student } = await supabaseAdmin
      .from('students')
      .select('*, category:categories(name)')
      .eq('id', studentId).eq('school_id', school_id).single();

    if (!student) return res.status(404).json({ error: 'Alumno no encontrado.' });

    if (role === 'padre' && student.parent_id !== user_id) {
      return res.status(403).json({ error: 'No tienes acceso a este alumno.' });
    }

    const currentMonth = new Date().getMonth() + 1;

    const { data: payments } = await supabaseAdmin
      .from('payments')
      .select('*')
      .eq('school_id', school_id).eq('student_id', studentId)
      .eq('payment_type', 'mensualidad')
      .order('payment_date', { ascending: false });

    const { data: groupPayments } = await supabaseAdmin
      .from('payment_students')
      .select('payment:payments(*), amount')
      .eq('student_id', studentId);

    const groupPaymentsFlat = (groupPayments || []).map((gp: any) => ({
      ...gp.payment,
      amount: gp.amount,
    }));

    const allPayments = [...(payments || []), ...groupPaymentsFlat]
      .sort((a, b) => new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime());

    const hasPaidThisMonth = allPayments.some((p: any) => p.payment_month === currentMonth);
    const pendingAmount = hasPaidThisMonth ? 0 : 500;

    res.json({
      studentName: student.full_name,
      category: student.category?.name,
      monthlyFee: 500,
      pendingAmount,
      hasPaidThisMonth,
      dueDate: `2026-${String(currentMonth).padStart(2, '0')}-10`,
      totalPayments: allPayments.length,
      totalPaid: allPayments.reduce((sum: number, p: any) => sum + Number(p.amount), 0),
      movements: allPayments.map((p: any) => ({
        date: p.payment_date,
        amount: p.amount,
        description: p.description || 'Mensualidad',
        status: 'paid',
      })),
    });
  } catch { res.status(500).json({ error: 'Error al obtener estado de cuenta.' }); }
};

