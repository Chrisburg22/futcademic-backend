"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.exportAttendance = exports.exportPayments = void 0;
const supabase_1 = require("../config/supabase");
const exportPayments = async (req, res) => {
    const { school_id } = req.tenant;
    const { month, format } = req.query;
    try {
        const currentMonth = month ? parseInt(month) : new Date().getMonth() + 1;
        const { data: payments, error } = await supabase_1.supabaseAdmin
            .from('payments')
            .select('*, student:students(full_name), teacher:users(full_name)')
            .eq('school_id', school_id)
            .eq('payment_month', currentMonth)
            .order('payment_date', { ascending: false });
        if (error)
            return res.status(500).json({ error: 'Error al exportar pagos.' });
        const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
        const csvHeader = 'Fecha,Tipo,Alumno/Profesor,Monto,Descripción\n';
        const csvRows = (payments || []).map((p) => `${p.payment_date},${p.payment_type === 'mensualidad' ? 'Mensualidad' : 'Pago Profesor'},${p.student?.full_name || p.teacher?.full_name || '—'},$${p.amount},${p.description || ''}`).join('\n');
        const csv = csvHeader + csvRows;
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="pagos-${monthNames[currentMonth - 1]}.csv"`);
        res.status(200).send(csv);
    }
    catch {
        res.status(500).json({ error: 'Error al exportar.' });
    }
};
exports.exportPayments = exportPayments;
const exportAttendance = async (req, res) => {
    const { school_id } = req.tenant;
    const { category_id, month } = req.query;
    try {
        const currentMonth = month ? parseInt(month) : new Date().getMonth() + 1;
        const { data: attendances, error } = await supabase_1.supabaseAdmin
            .from('attendances')
            .select('date, present, student:students(full_name, category:categories(name))')
            .eq('school_id', school_id)
            .eq('extract(month from date)', currentMonth)
            .order('date', { ascending: false });
        if (category_id && attendances) {
            attendances.filter((a) => a.student?.category?.id === category_id);
        }
        if (error)
            return res.status(500).json({ error: 'Error al exportar asistencias.' });
        const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
        const csvHeader = 'Fecha,Alumno,Categoría,Asistió\n';
        const csvRows = (attendances || []).map((a) => `${a.date},${a.student?.full_name || '—'},${a.student?.category?.name || '—'},${a.present ? 'Sí' : 'No'}`).join('\n');
        const csv = csvHeader + csvRows;
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="asistencias-${monthNames[currentMonth - 1]}.csv"`);
        res.status(200).send(csv);
    }
    catch {
        res.status(500).json({ error: 'Error al exportar.' });
    }
};
exports.exportAttendance = exportAttendance;
