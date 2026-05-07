import { Request, Response } from 'express';
import { supabaseAdmin } from '../config/supabase';

export const registerSchool = async (req: Request, res: Response) => {
  const { email, password, fullName, schoolName } = req.body;

  if (!email || !password || !fullName || !schoolName) {
    return res.status(400).json({ error: 'Faltan datos requeridos.' });
  }

  try {
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: false, // Ahora se enviará correo de confirmación
    });

    if (authError || !authData.user) return res.status(400).json({ error: authError?.message || 'Error en auth' });
    const userId = authData.user.id;

    const { data: schoolData, error: schoolError } = await supabaseAdmin
      .from('schools')
      .insert([{ name: schoolName }])
      .select('id')
      .single();

    if (schoolError || !schoolData) {
      await supabaseAdmin.auth.admin.deleteUser(userId);
      return res.status(500).json({ error: 'Error al crear la escuela.' });
    }

    const { error: profileError } = await supabaseAdmin
      .from('users')
      .insert([
        {
          id: userId,
          school_id: schoolData.id,
          role: 'admin',
          full_name: fullName,
        },
      ]);

    if (profileError) {
      return res.status(500).json({ error: 'Error al enlazar el perfil del usuario.' });
    }

    // 4. Crear información de perfil vacía
    const { error: infoError } = await supabaseAdmin
      .from('profile_information')
      .insert([{ id: userId, school_id: schoolData.id }]);

    if (infoError) {
      console.error('Error al crear profile_information:', infoError);
      // No fallamos el registro completo por esto, pero lo logueamos
    }

    res.status(201).json({ message: 'Escuela y cuenta Admin registradas con éxito.' });
  } catch (err) {
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
};

const DEFAULT_PASSWORD = 'Futcamedic2024!';

export const inviteUser = async (req: Request, res: Response) => {
  const { email, fullName, role, phone } = req.body;
  const { school_id } = req.tenant!;

  if (!email || !fullName || !role) {
    return res.status(400).json({ error: 'Email, nombre y rol son obligatorios.' });
  }

  try {
    // 1. Crear usuario con contraseña default — debe cambiarla en primer login
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: DEFAULT_PASSWORD,
      email_confirm: false, // Ahora se enviará invitación por correo
      user_metadata: { full_name: fullName },
    });

    if (authError) {
      // Si ya existe en Auth, recuperar su ID
      if (authError.message.toLowerCase().includes('already registered') ||
          authError.message.toLowerCase().includes('already exists')) {
        const { data: { users } } = await supabaseAdmin.auth.admin.listUsers();
        const existing = users.find(u => u.email === email);
        if (!existing) return res.status(400).json({ error: 'Usuario ya registrado pero no recuperable.' });

        const { data: existingProfile } = await supabaseAdmin
          .from('users').select('id, school_id').eq('id', existing.id).single();

        if (existingProfile) {
          return res.status(400).json({
            error: existingProfile.school_id === school_id
              ? 'Este usuario ya está registrado en tu escuela.'
              : 'Este usuario ya pertenece a otra escuela.'
          });
        }

        const { error: profileError } = await supabaseAdmin
          .from('users')
          .insert([{ id: existing.id, school_id, role, full_name: fullName, must_change_password: true }]);

        if (profileError) return res.status(500).json({ error: 'Error al crear perfil.' });

        await supabaseAdmin.from('profile_information').upsert([{ id: existing.id, school_id }]);
        
        if (role === 'profesor') {
          await supabaseAdmin.from('teacher_permissions').insert([{ school_id, teacher_id: existing.id }]);
        }
        
        return res.status(200).json({ message: `Usuario registrado como ${role}.`, userId: existing.id });
      }

      return res.status(400).json({ error: authError.message });
    }

    const userId = authData.user!.id;

    // 2. Crear perfil público con must_change_password = true
    const { error: profileError } = await supabaseAdmin
      .from('users')
      .insert([{ id: userId, school_id, role, full_name: fullName, must_change_password: true }]);

    if (profileError) {
      console.error('Error insertando perfil público:', profileError);
      return res.status(500).json({ error: 'Error al crear el perfil en la base de datos.' });
    }

    // 3. Perfil de información vacío (o con teléfono si viene)
    await supabaseAdmin.from('profile_information').upsert([{
      id: userId,
      school_id,
      phone: phone || null
    }]);

    // 4. Si es profesor, crear permisos por defecto
    if (role === 'profesor') {
      await supabaseAdmin.from('teacher_permissions').insert([{ school_id, teacher_id: userId }]);
    }

    res.status(200).json({ message: `Usuario creado como ${role}. Contraseña default asignada.`, userId });
  } catch (err: any) {
    console.error('Invite Error Catch:', err);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
};

export const inviteAdmin = async (req: Request, res: Response) => {
  const { email, fullName } = req.body;
  const { school_id } = req.tenant!;

  if (!email || !fullName) {
    return res.status(400).json({ error: 'Email y nombre son obligatorios.' });
  }

  try {
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: DEFAULT_PASSWORD,
      email_confirm: false,
      user_metadata: { full_name: fullName },
    });

    if (authError) {
      if (authError.message.toLowerCase().includes('already registered') ||
          authError.message.toLowerCase().includes('already exists')) {
        const { data: { users } } = await supabaseAdmin.auth.admin.listUsers();
        const existing = users.find(u => u.email === email);
        if (!existing) return res.status(400).json({ error: 'Usuario ya registrado pero no recuperable.' });

        const { data: existingProfile } = await supabaseAdmin
          .from('users').select('id, school_id').eq('id', existing.id).single();

        if (existingProfile) {
          return res.status(400).json({
            error: existingProfile.school_id === school_id
              ? 'Este usuario ya está registrado en tu escuela.'
              : 'Este usuario ya pertenece a otra escuela.'
          });
        }

        const { error: profileError } = await supabaseAdmin
          .from('users')
          .insert([{ id: existing.id, school_id, role: 'admin', full_name: fullName, must_change_password: true }]);

        if (profileError) return res.status(500).json({ error: 'Error al crear perfil.' });

        await supabaseAdmin.from('profile_information').upsert([{ id: existing.id, school_id }]);
        return res.status(200).json({ message: 'Usuario registrado como admin.', userId: existing.id });
      }

      return res.status(400).json({ error: authError.message });
    }

    const userId = authData.user!.id;

    const { error: profileError } = await supabaseAdmin
      .from('users')
      .insert([{ id: userId, school_id, role: 'admin', full_name: fullName, must_change_password: true }]);

    if (profileError) return res.status(500).json({ error: 'Error al crear perfil.' });

    await supabaseAdmin.from('profile_information').upsert([{ id: userId, school_id }]);

    res.status(200).json({ message: 'Admin creado. Contraseña default asignada.', userId });
  } catch (err: any) {
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
};
