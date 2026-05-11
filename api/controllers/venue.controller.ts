import { Request, Response } from 'express';
import { supabaseAdmin } from '../config/supabase';

export const getVenues = async (req: Request, res: Response) => {
  const { school_id } = req.tenant!;
  try {
    const { data, error } = await supabaseAdmin
      .from('venues')
      .select('*')
      .eq('school_id', school_id)
      .order('created_at', { ascending: false });

    if (error) return res.status(500).json({ error: 'Error al obtener sedes.' });
    res.status(200).json(data);
  } catch {
    res.status(500).json({ error: 'Error interno.' });
  }
};

export const createVenue = async (req: Request, res: Response) => {
  const { school_id } = req.tenant!;
  const { 
    name, 
    address, 
    notes, 
    is_external, 
    status, 
    surface_type, 
    capacity,
    has_lighting,
    is_covered,
    type_label,
    latitude,
    longitude
  } = req.body;

  if (!name) return res.status(400).json({ error: 'El nombre es obligatorio.' });

  try {
    const { data, error } = await supabaseAdmin
      .from('venues')
      .insert([{ 
        school_id, 
        name, 
        address: address || null, 
        notes: notes || null,
        is_external: is_external ?? false,
        status: status || 'Activa',
        surface_type: surface_type || null,
        capacity: capacity || null,
        has_lighting: has_lighting ?? false,
        is_covered: is_covered ?? false,
        type_label: type_label || null,
        latitud: latitude || null,
        longitud: longitude || null
      }])
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
  const { 
    name, 
    address, 
    notes, 
    is_external, 
    status, 
    surface_type, 
    capacity,
    has_lighting,
    is_covered,
    type_label,
    latitude,
    longitude
  } = req.body;

  try {
    const { error } = await supabaseAdmin
      .from('venues')
      .update({ 
        name, 
        address, 
        notes,
        is_external,
        status,
        surface_type,
        capacity,
        has_lighting,
        is_covered,
        type_label,
        latitud: latitude,
        longitud: longitude
      })
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
