import { Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../config/supabase';

// Extendemos el Request de Express para incluir a los usuarios de Supabase
declare global {
  namespace Express {
    interface Request {
      user?: any;
    }
  }
}

export const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Token de autorización faltante o inválido.' });
    }

    const token = authHeader.split(' ')[1];

    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({ error: 'Sesión no válida o expirada.', details: error?.message });
    }

    req.user = user;
    next();
  } catch (err) {
    console.error('Auth middleware exception:', err);
    res.status(500).json({ error: 'Error al verificar la sesión auth.' });
  }
};
