import { Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../config/supabase';

// Interfaces para tipado fuerte del tenant
export interface TenantPayload {
  school_id: string;
  role: string;
  user_id: string;
}

declare global {
  namespace Express {
    interface Request {
      tenant?: TenantPayload;
    }
  }
}

export const requireTenant = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user || !req.user.id) {
       return res.status(401).json({ error: 'Se requiere autenticación previa.' });
    }

    const { data: userProfile, error } = await supabaseAdmin
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
  } catch (err) {
    console.error('Tenant middleware error:', err);
    res.status(500).json({ error: 'Error validando tenant.' });
  }
};

export const requireRole = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.tenant || !roles.includes(req.tenant.role)) {
      return res.status(403).json({ error: 'Acceso denegado (rol insuficiente).' });
    }
    next();
  }
};
