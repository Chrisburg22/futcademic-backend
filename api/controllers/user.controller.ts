import { Request, Response } from 'express';
import { supabaseAdmin } from '../config/supabase';

export const getUsers = async (req: Request, res: Response) => {
  const { school_id } = req.tenant!;
  const { role } = req.query;

  try {
    let query = supabaseAdmin
      .from('users')
      .select('id, full_name, role, created_at')
      .eq('school_id', school_id)
      .order('created_at', { ascending: false });

    if (role) {
      query = query.eq('role', role as string);
    }

    const { data: users, error } = await query;
    if (error) return res.status(500).json({ error: 'Error interno al consultar usuarios.' });

    res.status(200).json(users);
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor.' });
  }
};

export const getTeacherDetails = async (req: Request, res: Response) => {
  const { school_id } = req.tenant!;
  const { id } = req.params;

  try {
    // 1. Obtener info básica del profesor y su perfil
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select(`
        id, 
        full_name, 
        role, 
        created_at,
        profile:profile_information (*)
      `)
      .eq('id', id)
      .eq('school_id', school_id)
      .single();

    if (userError || !user) return res.status(404).json({ error: 'Profesor no encontrado.' });

    // 2. Obtener el email desde auth.users (usando admin API porque no está en public.users)
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.getUserById(id);
    const email = authUser?.user?.email || 'Sin email';

    // 3. Obtener categorías asignadas
    const { data: categories, error: catError } = await supabaseAdmin
      .from('category_teachers')
      .select('category:categories(id, name, birth_year)')
      .eq('teacher_id', id);

    res.status(200).json({
      ...user,
      email,
      categories: categories?.map((c: any) => c.category) || []
    });
  } catch (err) {
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
};

export const updateUser = async (req: Request, res: Response) => {
  const { school_id } = req.tenant!;
  const { id } = req.params;
  const { 
    full_name, 
    phone, 
    address, 
    birth_date, 
    gender, 
    emergency_contact_name, 
    emergency_contact_phone, 
    medical_notes 
  } = req.body;

  try {
    // 1. Actualizar nombre en tabla users
    if (full_name) {
      const { error: userError } = await supabaseAdmin
        .from('users')
        .update({ full_name })
        .eq('id', id)
        .eq('school_id', school_id);
      
      if (userError) return res.status(400).json({ error: 'Error al actualizar nombre.' });
    }

    // 2. Actualizar (o crear si no existe) perfil en profile_information
    const profileData = {
      school_id,
      phone,
      address,
      birth_date,
      gender,
      emergency_contact_name,
      emergency_contact_phone,
      medical_notes,
      updated_at: new Date()
    };

    const { error: profileError } = await supabaseAdmin
      .from('profile_information')
      .upsert({ id, ...profileData });

    if (profileError) {
      console.error('Error profile update:', profileError);
      return res.status(400).json({ error: 'Error al actualizar información de perfil.' });
    }

    res.status(200).json({ message: 'Usuario actualizado con éxito.' });
  } catch (err) {
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
};
