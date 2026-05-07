import { Request, Response } from 'express';
import { supabaseAdmin } from '../config/supabase';

export const uploadAvatar = async (req: Request, res: Response) => {
  const { school_id, user_id } = req.tenant!;
  const { userId } = req.body;
  const file = (req as any).file;

  if (!file) return res.status(400).json({ error: 'Archivo de imagen requerido.' });

  const targetUserId = userId || user_id;
  const fileExt = file.originalname.split('.').pop();
  const filePath = `avatars/${school_id}/${targetUserId}.${fileExt}`;

  try {
    const { error: uploadError } = await supabaseAdmin.storage
      .from('avatars')
      .upload(filePath, file.buffer, { upsert: true, contentType: file.mimetype });

    if (uploadError) return res.status(500).json({ error: 'Error al subir avatar.' });

    const { data: urlData } = supabaseAdmin.storage.from('avatars').getPublicUrl(filePath);
    const publicUrl = urlData.publicUrl;

    await supabaseAdmin.from('users').update({ avatar_url: publicUrl }).eq('id', targetUserId);
    await supabaseAdmin.from('profile_information').update({ avatar_url: publicUrl, updated_at: new Date() }).eq('id', targetUserId);

    res.json({ avatarUrl: publicUrl });
  } catch { res.status(500).json({ error: 'Error interno.' }); }
};

export const uploadLogo = async (req: Request, res: Response) => {
  const { school_id } = req.tenant!;
  const file = (req as any).file;

  if (!file) return res.status(400).json({ error: 'Archivo de imagen requerido.' });

  const fileExt = file.originalname.split('.').pop();
  const filePath = `logos/${school_id}.${fileExt}`;

  try {
    const { error: uploadError } = await supabaseAdmin.storage
      .from('logos')
      .upload(filePath, file.buffer, { upsert: true, contentType: file.mimetype });

    if (uploadError) return res.status(500).json({ error: 'Error al subir logo.' });

    const { data: urlData } = supabaseAdmin.storage.from('logos').getPublicUrl(filePath);

    await supabaseAdmin.from('schools').update({ logo_url: urlData.publicUrl }).eq('id', school_id);

    res.json({ logoUrl: urlData.publicUrl });
  } catch { res.status(500).json({ error: 'Error interno.' }); }
};
