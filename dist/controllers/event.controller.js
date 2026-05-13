"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTrainingsByEvent = exports.deleteEvent = exports.updateEvent = exports.createEvent = exports.getTrainingsForDay = exports.getEvent = exports.getEvents = exports.cancelInstance = void 0;
const supabase_1 = require("../config/supabase");
const push_1 = require("../config/push");
const cancelInstance = async (req, res) => {
    const { school_id } = req.tenant;
    const { training_id, event_id, date } = req.body;
    if (!training_id && (!event_id || !date)) {
        return res.status(400).json({ error: 'Se requiere training_id o (event_id y date).' });
    }
    try {
        let query = supabase_1.supabaseAdmin
            .from('trainings')
            .update({ is_cancelled: true })
            .eq('school_id', school_id);
        if (training_id) {
            query = query.eq('id', training_id);
        }
        else {
            query = query.eq('event_id', event_id).eq('date', date);
        }
        const { error } = await query;
        if (error)
            return res.status(400).json({ error: 'Error al cancelar sesión.' });
        // Notificar a padres de alumnos en la categoría afectada
        try {
            let categoryId = null;
            if (training_id) {
                const { data: t } = await supabase_1.supabaseAdmin.from('trainings').select('category_id, date').eq('id', training_id).single();
                categoryId = t?.category_id ?? null;
            }
            else if (event_id) {
                const { data: e } = await supabase_1.supabaseAdmin.from('events').select('category_id').eq('id', event_id).single();
                categoryId = e?.category_id ?? null;
            }
            if (categoryId) {
                const { data: students } = await supabase_1.supabaseAdmin
                    .from('students')
                    .select('parent_id')
                    .eq('category_id', categoryId)
                    .eq('school_id', school_id)
                    .not('parent_id', 'is', null);
                const parentIds = [...new Set((students ?? []).map((s) => s.parent_id).filter(Boolean))];
                if (parentIds.length > 0) {
                    const { data: parents } = await supabase_1.supabaseAdmin
                        .from('users')
                        .select('push_token, id')
                        .in('id', parentIds)
                        .not('push_token', 'is', null);
                    await Promise.all((parents ?? []).map((p) => (0, push_1.sendPushNotification)(p.push_token, '❌ Sesión cancelada', 'Una sesión de entrenamiento ha sido cancelada.')));
                    const notificationRows = (parents ?? []).map((p) => ({
                        school_id,
                        user_id: p.id,
                        title: '❌ Sesión cancelada',
                        body: 'Una sesión de entrenamiento ha sido cancelada.',
                        type: 'sesion_cancelada',
                        data: { training_id, event_id, date }
                    }));
                    if (notificationRows.length > 0) {
                        try {
                            await supabase_1.supabaseAdmin.from('notifications').insert(notificationRows);
                        }
                        catch { }
                    }
                }
            }
        }
        catch { /* no bloquear */ }
        res.status(200).json({ message: 'Sesión cancelada.' });
    }
    catch (err) {
        res.status(500).json({ error: 'Error interno.' });
    }
};
exports.cancelInstance = cancelInstance;
const getEvents = async (req, res) => {
    const { school_id } = req.tenant;
    const { category_id } = req.query;
    try {
        let query = supabase_1.supabaseAdmin
            .from('events')
            .select('*, category:categories(name), venue:venues(name, address)')
            .eq('school_id', school_id)
            .order('date', { ascending: true });
        if (category_id)
            query = query.eq('category_id', category_id);
        const { data, error } = await query;
        if (error)
            return res.status(500).json({ error: 'Error al consultar agenda maestra.' });
        res.status(200).json(data);
    }
    catch (err) {
        res.status(500).json({ error: 'Error interno.' });
    }
};
exports.getEvents = getEvents;
const getEvent = async (req, res) => {
    const { school_id } = req.tenant;
    const { id } = req.params;
    try {
        const { data, error } = await supabase_1.supabaseAdmin
            .from('events')
            .select('*, category:categories(name), venue:venues(name, address)')
            .eq('school_id', school_id)
            .eq('id', id)
            .single();
        if (error)
            return res.status(500).json({ error: 'Error al obtener evento.' });
        res.status(200).json(data);
    }
    catch (err) {
        res.status(500).json({ error: 'Error interno.' });
    }
};
exports.getEvent = getEvent;
const getTrainingsForDay = async (req, res) => {
    const { school_id } = req.tenant;
    const { date, category_id } = req.query;
    if (!date)
        return res.status(400).json({ error: 'Fecha requerida.' });
    try {
        let query = supabase_1.supabaseAdmin
            .from('trainings')
            .select('*, category:categories(name), event:events(name, description), venue:venues(name, address)')
            .eq('school_id', school_id)
            .eq('date', date)
            .eq('is_cancelled', false)
            .order('start_time', { ascending: true });
        if (category_id) {
            query = query.eq('category_id', category_id);
        }
        else if (req.tenant.role === 'profesor') {
            const { data: teacherCats } = await supabase_1.supabaseAdmin
                .from('category_teachers')
                .select('category_id')
                .eq('teacher_id', req.tenant.user_id)
                .eq('school_id', school_id);
            const categoryIds = (teacherCats || []).map((r) => r.category_id);
            if (categoryIds.length === 0)
                return res.status(200).json([]);
            query = query.in('category_id', categoryIds);
        }
        const { data, error } = await query;
        if (error)
            return res.status(500).json({ error: 'Error al obtener entrenamientos.' });
        res.status(200).json(data);
    }
    catch (err) {
        res.status(500).json({ error: 'Error servidor.' });
    }
};
exports.getTrainingsForDay = getTrainingsForDay;
const createEvent = async (req, res) => {
    const { school_id } = req.tenant;
    const { name, category_id, date, start_time, end_time, type, description, recurringWeeks, venue_id, recurrenceRule } = req.body;
    if (!name || !category_id || !date || !type) {
        return res.status(400).json({ error: 'Faltan campos obligatorios.' });
    }
    try {
        const count = recurringWeeks ? Math.min(parseInt(recurringWeeks), 52) : 1;
        const is_recurring = count > 1 || !!recurrenceRule;
        let recurring_end_date = null;
        let storedRecurrenceRule = recurrenceRule || null;
        // Legacy weekly recurrence
        if (is_recurring && !recurrenceRule && count > 1) {
            const d = new Date(date);
            d.setDate(d.getDate() + (count - 1) * 7);
            recurring_end_date = d.toISOString().split('T')[0];
        }
        // Generate trainings based on recurrence rule
        const trainingsToInsert = generateTrainings({
            date,
            start_time,
            type,
            count,
            recurrenceRule,
            school_id,
            category_id,
            eventId: null, // Will be set after event creation
            venue_id: venue_id || null
        });
        // 1. Crear el Evento Maestro
        const { data: eventData, error: eventError } = await supabase_1.supabaseAdmin
            .from('events')
            .insert({
            school_id, category_id, date, start_time: start_time || null, end_time: end_time || null, type,
            name: name, description: description || null,
            is_recurring, recurring_weeks: is_recurring ? count : null, recurring_end_date,
            venue_id: venue_id || null,
            recurrence_rule: storedRecurrenceRule
        })
            .select()
            .single();
        if (eventError)
            return res.status(400).json({ error: eventError.message });
        // Assign event_id to trainings
        const trainingsWithEventId = trainingsToInsert.map(t => ({ ...t, event_id: eventData.id }));
        // 2. Generar Sesiones (Trainings)
        const { error: trainingError } = await supabase_1.supabaseAdmin
            .from('trainings')
            .insert(trainingsWithEventId);
        if (trainingError)
            return res.status(400).json({ error: 'Error al generar sesiones.' });
        res.status(201).json(eventData);
    }
    catch (err) {
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
};
exports.createEvent = createEvent;
const updateEvent = async (req, res) => {
    const { school_id } = req.tenant;
    const { id } = req.params;
    const { name, category_id, description, venue_id, start_time, end_time } = req.body;
    try {
        const { data, error } = await supabase_1.supabaseAdmin
            .from('events')
            .update({
            name,
            category_id,
            description,
            venue_id,
            start_time,
            end_time,
            updated_at: new Date()
        })
            .eq('id', id)
            .eq('school_id', school_id)
            .select()
            .single();
        if (error)
            return res.status(400).json({ error: 'Error al actualizar evento.' });
        res.status(200).json(data);
    }
    catch (err) {
        res.status(500).json({ error: 'Error interno.' });
    }
};
exports.updateEvent = updateEvent;
const deleteEvent = async (req, res) => {
    const { school_id } = req.tenant;
    const { id } = req.params;
    try {
        const { error } = await supabase_1.supabaseAdmin
            .from('events')
            .delete()
            .eq('id', id)
            .eq('school_id', school_id);
        if (error)
            return res.status(400).json({ error: 'No se pudo eliminar el evento.' });
        res.status(200).json({ message: 'Evento eliminado.' });
    }
    catch (err) {
        res.status(500).json({ error: 'Error interno.' });
    }
};
exports.deleteEvent = deleteEvent;
const getTrainingsByEvent = async (req, res) => {
    const { school_id } = req.tenant;
    const { id } = req.params;
    try {
        const { data, error } = await supabase_1.supabaseAdmin
            .from('trainings')
            .select('*')
            .eq('school_id', school_id)
            .eq('event_id', id)
            .order('date', { ascending: true });
        if (error)
            return res.status(500).json({ error: 'Error al obtener sesiones del evento.' });
        res.status(200).json(data);
    }
    catch (err) {
        res.status(500).json({ error: 'Error interno.' });
    }
};
exports.getTrainingsByEvent = getTrainingsByEvent;
function generateTrainings(params) {
    const { date, start_time, type, count, recurrenceRule, school_id, category_id, venue_id } = params;
    const trainings = [];
    const firstDate = new Date(date + 'T00:00:00');
    if (!recurrenceRule || !recurrenceRule.pattern) {
        for (let i = 0; i < count; i++) {
            const trainingDate = new Date(firstDate);
            trainingDate.setDate(firstDate.getDate() + (i * 7));
            trainings.push(createTrainingRow(trainingDate, school_id, category_id, start_time, type, venue_id));
        }
        return trainings;
    }
    const { pattern, daysOfWeek, endDate } = recurrenceRule;
    if (pattern === 'weekly') {
        if (daysOfWeek && daysOfWeek.length > 0) {
            const end = endDate ? new Date(endDate + 'T00:00:00') : null;
            const maxWeeks = count || 52;
            const dayOfWeek = firstDate.getDay();
            let current = new Date(firstDate);
            let weeksGenerated = 0;
            while (weeksGenerated < maxWeeks) {
                for (const dow of daysOfWeek.sort()) {
                    const trainingDate = new Date(current);
                    trainingDate.setDate(current.getDate() + (dow - dayOfWeek));
                    if (trainingDate < firstDate)
                        continue;
                    if (end && trainingDate > end)
                        break;
                    trainings.push(createTrainingRow(trainingDate, school_id, category_id, start_time, type, venue_id));
                }
                current.setDate(current.getDate() + 7);
                weeksGenerated++;
                if (end && current > end)
                    break;
            }
        }
        else {
            for (let i = 0; i < count; i++) {
                const trainingDate = new Date(firstDate);
                trainingDate.setDate(firstDate.getDate() + (i * 7));
                trainings.push(createTrainingRow(trainingDate, school_id, category_id, start_time, type, venue_id));
            }
        }
    }
    else if (pattern === 'biweekly') {
        for (let i = 0; i < count; i++) {
            const trainingDate = new Date(firstDate);
            trainingDate.setDate(firstDate.getDate() + (i * 14));
            trainings.push(createTrainingRow(trainingDate, school_id, category_id, start_time, type, venue_id));
        }
    }
    else if (pattern === 'monthly') {
        for (let i = 0; i < count; i++) {
            const trainingDate = new Date(firstDate);
            trainingDate.setMonth(firstDate.getMonth() + i);
            trainings.push(createTrainingRow(trainingDate, school_id, category_id, start_time, type, venue_id));
        }
    }
    return trainings;
}
function createTrainingRow(date, school_id, category_id, start_time, type, venue_id) {
    return {
        school_id,
        event_id: null,
        category_id,
        date: date.toISOString().split('T')[0],
        start_time: start_time || null,
        type,
        is_completed: false,
        is_cancelled: false,
        venue_id
    };
}
