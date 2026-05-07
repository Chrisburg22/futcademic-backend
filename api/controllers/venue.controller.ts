import { Request, Response } from 'express';
import { supabaseAdmin } from '../config/supabase';

export const getVenues = async (req: Request, res: Response) => {
  const { school_id } = req.tenant!;
  try {
    const { data, error } = await supabaseAdmin
      .from('venues')
      .select('*')
      .eq('school_id', school_id)
      .order('name', { ascending: true });

    if (error) return res.status(500).json({ error: 'Error al obtener sedes.' });
    res.status(200).json(data);
  } catch {
    res.status(500).json({ error: 'Error interno.' });
  }
};

export const createVenue = async (req: Request, res: Response) => {
  const { school_id } = req.tenant!;
  const { name, address, notes } = req.body;

  if (!name) return res.status(400).json({ error: 'El nombre es obligatorio.' });

  try {
    const { data, error } = await supabaseAdmin
      .from('venues')
      .insert([{ school_id, name, address: address || null, notes: notes || null }])
      .select()
      .single();

    if (error) return res.status(400).json({ error: error.message });
    res.status(201).json(data);
  } catch {
    res.status(500).json({ error: 'Error interno.' });
  }
};

export const updateVenue = async (req: Request, res: Response) => {
  const { school_id } = req.tenant!;
  const { id } = req.params;
  const { name, address, notes } = req.body;

  try {
    const { error } = await supabaseAdmin
      .from('venues')
      .update({ name, address, notes })
      .eq('id', id)
      .eq('school_id', school_id);

    if (error) return res.status(400).json({ error: error.message });
    res.status(200).json({ message: 'Sede actualizada.' });
  } catch {
    res.status(500).json({ error: 'Error interno.' });
  }
};

export const deleteVenue = async (req: Request, res: Response) => {
  const { school_id } = req.tenant!;
  const { id } = req.params;

  try {
    const { error } = await supabaseAdmin
      .from('venues')
      .delete()
      .eq('id', id)
      .eq('school_id', school_id);

    if (error) return res.status(400).json({ error: 'No se pudo eliminar la sede.' });
    res.status(200).json({ message: 'Sede eliminada.' });
  } catch {
    res.status(500).json({ error: 'Error interno.' });
  }
};
