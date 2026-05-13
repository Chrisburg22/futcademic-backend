"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.markAllAsRead = exports.markAsRead = exports.getNotifications = void 0;
const supabase_1 = require("../config/supabase");
const getNotifications = async (req, res) => {
    const { school_id, user_id } = req.tenant;
    try {
        const { data, error } = await supabase_1.supabaseAdmin
            .from('notifications')
            .select('*')
            .eq('school_id', school_id)
            .eq('user_id', user_id)
            .order('created_at', { ascending: false })
            .limit(50);
        if (error)
            return res.status(500).json({ error: 'Error al obtener notificaciones.' });
        res.json(data);
    }
    catch {
        res.status(500).json({ error: 'Error interno.' });
    }
};
exports.getNotifications = getNotifications;
const markAsRead = async (req, res) => {
    const { school_id, user_id } = req.tenant;
    const { id } = req.params;
    try {
        const { error } = await supabase_1.supabaseAdmin
            .from('notifications')
            .update({ is_read: true })
            .eq('id', id).eq('school_id', school_id).eq('user_id', user_id);
        if (error)
            return res.status(500).json({ error: 'Error al marcar notificación.' });
        res.json({ message: 'Notificación marcada como leída.' });
    }
    catch {
        res.status(500).json({ error: 'Error interno.' });
    }
};
exports.markAsRead = markAsRead;
const markAllAsRead = async (req, res) => {
    const { school_id, user_id } = req.tenant;
    try {
        const { error } = await supabase_1.supabaseAdmin
            .from('notifications')
            .update({ is_read: true })
            .eq('school_id', school_id).eq('user_id', user_id).eq('is_read', false);
        if (error)
            return res.status(500).json({ error: 'Error al marcar notificaciones.' });
        res.json({ message: 'Todas las notificaciones marcadas como leídas.' });
    }
    catch {
        res.status(500).json({ error: 'Error interno.' });
    }
};
exports.markAllAsRead = markAllAsRead;
