import { Request, Response } from 'express';
import { supabaseAdmin } from '../config/supabase';

export const getNotifications = async (req: Request, res: Response) => {
  const { school_id, user_id } = req.tenant!;
  try {
    const { data, error } = await supabaseAdmin
      .from('notifications')
      .select('*')
      .eq('school_id', school_id)
      .eq('user_id', user_id)
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) return res.status(500).json({ error: 'Error al obtener notificaciones.' });
    res.json(data);
  } catch { res.status(500).json({ error: 'Error interno.' }); }
};

export const markAsRead = async (req: Request, res: Response) => {
  const { school_id, user_id } = req.tenant!;
  const { id } = req.params;
  try {
    const { error } = await supabaseAdmin
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id).eq('school_id', school_id).eq('user_id', user_id);
    if (error) return res.status(500).json({ error: 'Error al marcar notificación.' });
    res.json({ message: 'Notificación marcada como leída.' });
  } catch { res.status(500).json({ error: 'Error interno.' }); }
};

export const markAllAsRead = async (req: Request, res: Response) => {
  const { school_id, user_id } = req.tenant!;
  try {
    const { error } = await supabaseAdmin
      .from('notifications')
      .update({ is_read: true })
      .eq('school_id', school_id).eq('user_id', user_id).eq('is_read', false);
    if (error) return res.status(500).json({ error: 'Error al marcar notificaciones.' });
    res.json({ message: 'Todas las notificaciones marcadas como leídas.' });
  } catch { res.status(500).json({ error: 'Error interno.' }); }
};
