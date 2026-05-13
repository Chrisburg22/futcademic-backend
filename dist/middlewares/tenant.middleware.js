"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireRole = exports.requireTenant = void 0;
const supabase_1 = require("../config/supabase");
const requireTenant = async (req, res, next) => {
    try {
        if (!req.user || !req.user.id) {
            return res.status(401).json({ error: 'Se requiere autenticación previa.' });
        }
        const { data: userProfile, error } = await supabase_1.supabaseAdmin
            .from('users')
            .select('id, school_id, role, full_name')
            .eq('id', req.user.id)
            .single();
        if (error || !userProfile) {
            return res.status(403).json({ error: 'Usuario no pertenece a ninguna escuela.' });
        }
        req.tenant = {
            school_id: userProfile.school_id,
            role: userProfile.role,
            user_id: userProfile.id
        };
        next();
    }
    catch (err) {
        console.error('Tenant middleware error:', err);
        res.status(500).json({ error: 'Error validando tenant.' });
    }
};
exports.requireTenant = requireTenant;
const requireRole = (...roles) => {
    return (req, res, next) => {
        if (!req.tenant || !roles.includes(req.tenant.role)) {
            return res.status(403).json({ error: 'Acceso denegado (rol insuficiente).' });
        }
        next();
    };
};
exports.requireRole = requireRole;
