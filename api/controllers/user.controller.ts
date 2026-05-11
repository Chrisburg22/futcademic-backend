import { Request, Response } from 'express';
import { supabaseAdmin } from '../config/supabase';

export const getUsers = async (req: Request, res: Response) => {
  const { school_id } = req.tenant!;
  const { role } = req.query;

  try {
    let query = supabaseAdmin
      .from('users')
      .select(`
        categories:category_teachers(category:categories(id, name)),
        permissions:teacher_permissions(
          can_take_attendance,
          can_manage_events,
          can_view_finances,
          can_manage_students,
          can_manage_payments,
          can_manage_categories
        )
      `)
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

    // 2. Obtener el email desde auth.users
    const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(id);
    const email = authUser?.user?.email || 'Sin email';

    // 3. Obtener categorías asignadas
    const { data: catData } = await supabaseAdmin
      .from('category_teachers')
      .select('category:categories(id, name)')
      .eq('teacher_id', id);

    // 4. Obtener permisos
    const { data: permissions } = await supabaseAdmin
      .from('teacher_permissions')
      .select('*')
      .eq('teacher_id', id)
      .maybeSingle();
    
    res.status(200).json({
      ...user,
      email,
      categories: catData?.map((c: any) => c.category) || [],
      permissions: permissions || {
        can_take_attendance: false,
        can_manage_events: false,
        can_view_finances: false,
        can_manage_students: false,
        can_manage_categories: false,
        can_manage_payments: false
      }
    });
  } catch (err) {
    console.error('getTeacherDetails Error:', err);
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
    medical_notes,
    avatar_url,
    categoryIds,
    permissions
  } = req.body;

  try {
    // 1. Actualizar nombre en tabla users
    if (full_name) {
      await supabaseAdmin
        .from('users')
        .update({ full_name, avatar_url })
        .eq('id', id)
        .eq('school_id', school_id);
    }

    // 2. Actualizar perfil en profile_information
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

    await supabaseAdmin
      .from('profile_information')
      .upsert({ id, ...profileData });

    // 3. Actualizar categorías
    if (categoryIds && Array.isArray(categoryIds)) {
      await supabaseAdmin.from('category_teachers').delete().eq('teacher_id', id);
      
      if (categoryIds.length > 0) {
        const catInserts = categoryIds.map(catId => ({
          teacher_id: id,
          category_id: catId,
          school_id
        }));
        await supabaseAdmin.from('category_teachers').insert(catInserts);
      }
    }

    // 4. Actualizar permisos
    if (permissions) {
      await supabaseAdmin
        .from('teacher_permissions')
        .upsert({
          teacher_id: id,
          school_id,
          ...permissions,
          updated_at: new Date()
        });
    }

    res.status(200).json({ message: 'Usuario actualizado con éxito.' });
  } catch (err) {
    console.error('updateUser Error:', err);
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
