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

    // 4. Obtener permisos
    const { data: permissions } = await supabaseAdmin
      .from('teacher_permissions')
      .select('*')
      .eq('teacher_id', id)
      .maybeSingle();
    
    // Note: If no permissions exist, we'll handle it in the response

    res.status(200).json({
      ...user,
      email,
      categories: categories?.map((c: any) => c.category) || [],
      permissions: permissions || {
        can_take_attendance: true,
        can_manage_events: true,
        can_view_finances: false,
        can_manage_students: false,
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
};

export const changeOwnPassword = async (req: Request, res: Response) => {
  const { user_id, school_id } = req.tenant!;
  const { newPassword } = req.body;

  if (!newPassword || newPassword.length < 8) {
    return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres.' });
  }

  try {
    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(user_id, {
      password: newPassword,
    });

    if (authError) return res.status(400).json({ error: 'Error al actualizar contraseña.' });

    await supabaseAdmin
      .from('users')
      .update({ must_change_password: false })
      .eq('id', user_id)
      .eq('school_id', school_id);

    res.status(200).json({ message: 'Contraseña actualizada con éxito.' });
  } catch (err) {
    res.status(500).json({ error: 'Error interno.' });
  }
};

export const updatePushToken = async (req: Request, res: Response) => {
  const { user_id } = req.tenant!;
  const { push_token } = req.body;

  if (!push_token) return res.status(400).json({ error: 'push_token requerido.' });

  try {
    await supabaseAdmin.from('users').update({ push_token }).eq('id', user_id);
    res.status(200).json({ message: 'Token registrado.' });
  } catch (err) {
    res.status(500).json({ error: 'Error interno.' });
  }
};

export const updateUser = async (req: Request, res: Response) => {
  const { school_id } = req.tenant!;
  const { id } = req.params;
  const { 
    medical_notes,
    avatar_url,
    categoryIds,
    permissions
  } = req.body;

  try {
    // 1. Actualizar nombre en tabla users
    if (full_name) {
      const { error: userError } = await supabaseAdmin
        .from('users')
        .update({ full_name, avatar_url })
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
      avatar_url,
      updated_at: new Date()
    };

    const { error: profileError } = await supabaseAdmin
      .from('profile_information')
      .upsert({ id, ...profileData });

    if (profileError) {
      console.error('Error profile update:', profileError);
      return res.status(400).json({ error: 'Error al actualizar información de perfil.' });
    }

    // 3. Actualizar categorías (si se proporcionan)
    if (categoryIds && Array.isArray(categoryIds)) {
      // Borrar asignaciones anteriores
      await supabaseAdmin.from('category_teachers').delete().eq('teacher_id', id);
      
      // Insertar nuevas
      if (categoryIds.length > 0) {
        const catInserts = categoryIds.map(catId => ({
          teacher_id: id,
          category_id: catId,
          school_id
        }));
        await supabaseAdmin.from('category_teachers').insert(catInserts);
      }
    }

    // 4. Actualizar permisos (si se proporcionan)
    if (permissions) {
      const { error: permError } = await supabaseAdmin
        .from('teacher_permissions')
        .upsert({
          teacher_id: id,
          school_id,
          ...permissions,
          updated_at: new Date()
        });
      
      if (permError) console.error('Error updating permissions:', permError);
    }

    res.status(200).json({ message: 'Usuario actualizado con éxito.' });
  } catch (err) {
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
};
