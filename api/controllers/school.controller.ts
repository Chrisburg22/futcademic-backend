import { Request, Response } from 'express';
import { supabaseAdmin } from '../config/supabase';

export const updateSchool = async (req: Request, res: Response) => {
  const { school_id } = req.tenant!;
  const { id } = req.params;
  const { name } = req.body;

  // Solo podemos actualizar la escuela del tenant actual
  if (id !== school_id) {
    return res.status(403).json({ error: 'No tienes permisos para modificar otra academia.' });
  }

  try {
    if (!name) {
      return res.status(400).json({ error: 'El nombre de la academia es requerido.' });
    }

    const { error } = await supabaseAdmin
      .from('schools')
      .update({ name })
      .eq('id', id);

    if (error) {
      return res.status(400).json({ error: 'Error al actualizar la academia.' });
    }

    res.status(200).json({ message: 'Academia actualizada con éxito.' });
  } catch (err) {
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
};
