"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAuth = void 0;
const supabase_1 = require("../config/supabase");
const requireAuth = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Token de autorización faltante o inválido.' });
        }
        const token = authHeader.split(' ')[1];
        const { data: { user }, error } = await supabase_1.supabaseAdmin.auth.getUser(token);
        if (error || !user) {
            return res.status(401).json({ error: 'Sesión no válida o expirada.', details: error?.message });
        }
        req.user = user;
        next();
    }
    catch (err) {
        console.error('Auth middleware exception:', err);
        res.status(500).json({ error: 'Error al verificar la sesión auth.' });
    }
};
exports.requireAuth = requireAuth;
