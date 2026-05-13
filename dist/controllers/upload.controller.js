"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadLogo = exports.uploadAvatar = void 0;
const supabase_1 = require("../config/supabase");
const uploadAvatar = async (req, res) => {
    const { school_id, user_id } = req.tenant;
    const { userId } = req.body;
    const file = req.file;
    if (!file)
        return res.status(400).json({ error: 'Archivo de imagen requerido.' });
    const targetUserId = userId || user_id;
    const fileExt = file.originalname.split('.').pop();
    const filePath = `avatars/${school_id}/${targetUserId}.${fileExt}`;
    try {
        const { error: uploadError } = await supabase_1.supabaseAdmin.storage
            .from('avatars')
            .upload(filePath, file.buffer, { upsert: true, contentType: file.mimetype });
        if (uploadError)
            return res.status(500).json({ error: 'Error al subir avatar.' });
        const { data: urlData } = supabase_1.supabaseAdmin.storage.from('avatars').getPublicUrl(filePath);
        const publicUrl = urlData.publicUrl;
        await supabase_1.supabaseAdmin.from('users').update({ avatar_url: publicUrl }).eq('id', targetUserId);
        await supabase_1.supabaseAdmin.from('profile_information').update({ avatar_url: publicUrl, updated_at: new Date() }).eq('id', targetUserId);
        res.json({ avatarUrl: publicUrl });
    }
    catch {
        res.status(500).json({ error: 'Error interno.' });
    }
};
exports.uploadAvatar = uploadAvatar;
const uploadLogo = async (req, res) => {
    const { school_id } = req.tenant;
    const file = req.file;
    if (!file)
        return res.status(400).json({ error: 'Archivo de imagen requerido.' });
    const fileExt = file.originalname.split('.').pop();
    const filePath = `logos/${school_id}.${fileExt}`;
    try {
        const { error: uploadError } = await supabase_1.supabaseAdmin.storage
            .from('logos')
            .upload(filePath, file.buffer, { upsert: true, contentType: file.mimetype });
        if (uploadError)
            return res.status(500).json({ error: 'Error al subir logo.' });
        const { data: urlData } = supabase_1.supabaseAdmin.storage.from('logos').getPublicUrl(filePath);
        await supabase_1.supabaseAdmin.from('schools').update({ logo_url: urlData.publicUrl }).eq('id', school_id);
        res.json({ logoUrl: urlData.publicUrl });
    }
    catch {
        res.status(500).json({ error: 'Error interno.' });
    }
};
exports.uploadLogo = uploadLogo;
