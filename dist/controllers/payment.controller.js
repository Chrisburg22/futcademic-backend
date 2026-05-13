"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAccountStatement = exports.registerTeacherPayment = exports.registerStudentPayment = exports.getPendingPayments = exports.getPaymentsByStudent = exports.getPayments = void 0;
const supabase_1 = require("../config/supabase");
const push_1 = require("../config/push");
const getPayments = async (req, res) => {
    const { school_id } = req.tenant;
    const { type, month } = req.query;
    try {
        let query = supabase_1.supabaseAdmin
            .from('payments')
            .select('*, student:students(full_name), teacher:users(full_name), payment_students:payment_students(student_id, amount, student:students(full_name))')
            .eq('school_id', school_id)
            .order('payment_date', { ascending: false });
        if (type) {
            query = query.eq('payment_type', type);
        }
        if (month) {
            query = query.eq('payment_month', parseInt(month));
        }
        const { data, error } = await query;
        if (error)
            return res.status(500).json({ error: 'Fallo consulta financiera.' });
        res.status(200).json(data);
    }
    catch (err) {
        res.status(500).json({ error: 'Error interno.' });
    }
};
exports.getPayments = getPayments;
const getPaymentsByStudent = async (req, res) => {
    const { school_id } = req.tenant;
    const { id: student_id } = req.params;
    try {
        // Pagos directos
        const { data: directPayments, error: directError } = await supabase_1.supabaseAdmin
            .from('payments')
            .select('*')
            .eq('school_id', school_id)
            .eq('student_id', student_id)
            .eq('payment_type', 'mensualidad')
            .order('payment_date', { ascending: false });
        if (directError)
            return res.status(500).json({ error: 'Error historial alumno.' });
        // Pagos grupales donde aparece este alumno
        const { data: groupPayments, error: groupError } = await supabase_1.supabaseAdmin
            .from('payment_students')
            .select('payment:payments(*)')
            .eq('student_id', student_id);
        if (groupError)
            return res.status(500).json({ error: 'Error historial alumno.' });
        const groupPaymentsFlat = (groupPayments || []).map((gp) => gp.payment);
        const allPayments = [...(directPayments || []), ...groupPaymentsFlat]
            .sort((a, b) => new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime());
        res.status(200).json(allPayments);
    }
    catch (err) {
        res.status(500).json({ error: 'Excepción del sistema.' });
    }
};
exports.getPaymentsByStudent = getPaymentsByStudent;
const getPendingPayments = async (req, res) => {
    const { school_id } = req.tenant;
    const month = parseInt(req.query.month) || new Date().getMonth() + 1;
    const year = parseInt(req.query.year) || new Date().getFullYear();
    try {
        const { data: allStudents, error: studentsError } = await supabase_1.supabaseAdmin
            .from('students')
            .select('id, full_name, category_id, status, category:categories(name, monthly_fee)')
            .eq('school_id', school_id)
            .in('status', ['activo', 'pendiente']);
        if (studentsError)
            return res.status(500).json({ error: 'Error consultando alumnos.' });
        // Alumnos con pagos (directos o grupales) este mes/año
        const { data: paidRecords, error: paymentsError } = await supabase_1.supabaseAdmin
            .from('payments')
            .select('id, student_id, amount, payment_month, payment_year, payment_students:payment_students(student_id, amount)')
            .eq('school_id', school_id)
            .eq('payment_type', 'mensualidad')
            .eq('payment_month', month)
            .eq('payment_year', year);
        if (paymentsError)
            return res.status(500).json({ error: 'Error consultando pagos.' });
        // Crear mapa de montos pagados por alumno
        const paymentMap = new Map();
        (paidRecords || []).forEach((p) => {
            if (p.student_id) {
                paymentMap.set(p.student_id, (paymentMap.get(p.student_id) || 0) + Number(p.amount));
            }
            (p.payment_students || []).forEach((ps) => {
                paymentMap.set(ps.student_id, (paymentMap.get(ps.student_id) || 0) + Number(ps.amount));
            });
        });
        const pending = (allStudents || []).map((s) => {
            const expected = Number(s.category?.monthly_fee || 0);
            const paid = paymentMap.get(s.id) || 0;
            return {
                ...s,
                monthly_fee: expected,
                paid_amount: paid,
                pending_amount: Math.max(0, expected - paid),
                is_fully_paid: paid >= expected
            };
        }).filter((s) => !s.is_fully_paid);
        res.status(200).json({
            month,
            year,
            pending,
            total_pending_amount: pending.reduce((acc, curr) => acc + curr.pending_amount, 0),
            total_students: allStudents?.length ?? 0
        });
    }
    catch (err) {
        res.status(500).json({ error: 'Error interno.' });
    }
};
exports.getPendingPayments = getPendingPayments;
const registerStudentPayment = async (req, res) => {
    const { school_id } = req.tenant;
    const { amount, payment_date, student_id, student_ids, description, payment_month } = req.body;
    const students = student_ids || (student_id ? [student_id] : []);
    if (!amount || !payment_date || students.length === 0) {
        return res.status(400).json({ error: 'Faltan datos financieros requeridos.' });
    }
    // Si no se especifica el mes/año, usamos los de la fecha de pago o actuales
    const dateParts = payment_date.split('-');
    const finalMonth = payment_month || parseInt(dateParts[1]);
    const finalYear = parseInt(dateParts[0]) || new Date().getFullYear();
    try {
        if (students.length === 1) {
            // Pago individual (comportamiento original)
            const { data, error } = await supabase_1.supabaseAdmin
                .from('payments')
                .insert([{
                    school_id,
                    amount,
                    payment_date,
                    payment_type: 'mensualidad',
                    student_id: students[0],
                    description,
                    payment_month: finalMonth,
                    payment_year: finalYear
                }])
                .select().single();
            if (error)
                return res.status(500).json({ error: 'Error BD.' });
            // Notificar al padre del alumno si tiene push token
            await notifyParents(school_id, students[0], amount, description);
            res.status(201).json(data);
        }
        else {
            // Pago grupal: crear un payment padre + registros en payment_students
            const perStudentAmount = (parseFloat(amount) / students.length).toFixed(2);
            const { data: paymentData, error: paymentError } = await supabase_1.supabaseAdmin
                .from('payments')
                .insert([{
                    school_id,
                    amount,
                    payment_date,
                    payment_type: 'mensualidad',
                    student_id: null, // Pago grupal, no ligado a un solo alumno
                    description: description || `Pago grupal (${students.length} alumnos)`,
                    payment_month: finalMonth,
                    payment_year: finalYear
                }])
                .select()
                .single();
            if (paymentError)
                return res.status(500).json({ error: 'Error BD.' });
            const paymentStudentRows = students.map((sid) => ({
                payment_id: paymentData.id,
                student_id: sid,
                amount: perStudentAmount
            }));
            const { error: psError } = await supabase_1.supabaseAdmin
                .from('payment_students')
                .insert(paymentStudentRows);
            if (psError)
                return res.status(500).json({ error: 'Error vinculando alumnos al pago.' });
            // Notificar a todos los padres
            await Promise.all(students.map((sid) => notifyParents(school_id, sid, perStudentAmount, description)));
            res.status(201).json({ ...paymentData, student_count: students.length });
        }
    }
    catch (err) {
        res.status(500).json({ error: 'Error guardando mensualidad.' });
    }
};
exports.registerStudentPayment = registerStudentPayment;
async function notifyParents(school_id, student_id, amount, description) {
    try {
        const { data: student } = await supabase_1.supabaseAdmin
            .from('students')
            .select('full_name, parent_id')
            .eq('id', student_id)
            .single();
        if (student?.parent_id) {
            const { data: parent } = await supabase_1.supabaseAdmin
                .from('users')
                .select('push_token')
                .eq('id', student.parent_id)
                .single();
            if (parent?.push_token) {
                await (0, push_1.sendPushNotification)(parent.push_token, '✅ Pago registrado', `Se registró un pago de $${amount} para ${student.full_name} (${description || 'Mensualidad'}).`);
            }
            try {
                await supabase_1.supabaseAdmin.from('notifications').insert({
                    school_id,
                    user_id: student.parent_id,
                    title: '✅ Pago registrado',
                    body: `Se registró un pago de $${amount} para ${student.full_name}.`,
                    type: 'pago_recibido',
                    data: { student_id, amount, description }
                });
            }
            catch { }
        }
    }
    catch { /* no bloquear */ }
}
const registerTeacherPayment = async (req, res) => {
    const { school_id } = req.tenant;
    const { amount, payment_date, teacher_id, description } = req.body;
    if (!amount || !payment_date || !teacher_id)
        return res.status(400).json({ error: 'Datos incompletos.' });
    const dateParts = payment_date.split('-');
    const finalMonth = parseInt(dateParts[1]);
    const finalYear = parseInt(dateParts[0]);
    try {
        const { data, error } = await supabase_1.supabaseAdmin
            .from('payments')
            .insert([{
                school_id,
                amount,
                payment_date,
                payment_type: 'pago_profesor',
                teacher_id,
                description,
                payment_month: finalMonth,
                payment_year: finalYear
            }])
            .select().single();
        if (error)
            return res.status(500).json({ error: 'Error de BD al emitir nómina.' });
        res.status(201).json(data);
    }
    catch (err) {
        res.status(500).json({ error: 'Excepción interna.' });
    }
};
exports.registerTeacherPayment = registerTeacherPayment;
const getAccountStatement = async (req, res) => {
    const { school_id, user_id, role } = req.tenant;
    const { studentId } = req.params;
    try {
        const { data: student } = await supabase_1.supabaseAdmin
            .from('students')
            .select('*, category:categories(name, monthly_fee)')
            .eq('id', studentId).eq('school_id', school_id).single();
        if (!student)
            return res.status(404).json({ error: 'Alumno no encontrado.' });
        if (role === 'padre' && student.parent_id !== user_id) {
            return res.status(403).json({ error: 'No tienes acceso a este alumno.' });
        }
        const currentMonth = new Date().getMonth() + 1;
        const { data: payments } = await supabase_1.supabaseAdmin
            .from('payments')
            .select('*')
            .eq('school_id', school_id).eq('student_id', studentId)
            .eq('payment_type', 'mensualidad')
            .order('payment_date', { ascending: false });
        const { data: groupPayments } = await supabase_1.supabaseAdmin
            .from('payment_students')
            .select('payment:payments(*), amount')
            .eq('student_id', studentId);
        const groupPaymentsFlat = (groupPayments || []).map((gp) => ({
            ...gp.payment,
            amount: gp.amount,
        }));
        const allPayments = [...(payments || []), ...groupPaymentsFlat]
            .sort((a, b) => new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime());
        const hasPaidThisMonth = allPayments.some((p) => p.payment_month === currentMonth && p.payment_year === new Date().getFullYear());
        const monthlyFee = Number(student.category?.monthly_fee || 0);
        const paidThisMonth = allPayments
            .filter((p) => p.payment_month === currentMonth && p.payment_year === new Date().getFullYear())
            .reduce((sum, p) => sum + Number(p.amount), 0);
        const pendingAmount = Math.max(0, monthlyFee - paidThisMonth);
        res.json({
            studentName: student.full_name,
            category: student.category?.name,
            monthlyFee,
            pendingAmount,
            hasPaidThisMonth,
            dueDate: `2026-${String(currentMonth).padStart(2, '0')}-10`,
            totalPayments: allPayments.length,
            totalPaid: allPayments.reduce((sum, p) => sum + Number(p.amount), 0),
            movements: allPayments.map((p) => ({
                date: p.payment_date,
                amount: p.amount,
                description: p.description || 'Mensualidad',
                status: 'paid',
            })),
        });
    }
    catch {
        res.status(500).json({ error: 'Error al obtener estado de cuenta.' });
    }
};
exports.getAccountStatement = getAccountStatement;
