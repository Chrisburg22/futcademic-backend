"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateSchool = void 0;
const supabase_1 = require("../config/supabase");
const updateSchool = async (req, res) => {
    const { school_id } = req.tenant;
    const { id } = req.params;
    const { name, logo_url } = req.body;
    // Solo podemos actualizar la escuela del tenant actual
    if (id !== school_id) {
        return res.status(403).json({ error: 'No tienes permisos para modificar otra academia.' });
    }
    try {
        if (!name && !logo_url) {
            return res.status(400).json({ error: 'El nombre o el logo de la academia es requerido.' });
        }
        const updateData = {};
        if (name)
            updateData.name = name;
        if (logo_url)
            updateData.logo_url = logo_url;
        const { error } = await supabase_1.supabaseAdmin
            .from('schools')
            .update(updateData)
            .eq('id', id);
        if (error) {
            return res.status(400).json({ error: 'Error al actualizar la academia.' });
        }
        res.status(200).json({ message: 'Academia actualizada con éxito.' });
    }
    catch (err) {
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
};
exports.updateSchool = updateSchool;
