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
      email_confirm: true,
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

export const inviteUser = async (req: Request, res: Response) => {
  const { email, fullName, role } = req.body;
  const { school_id } = req.tenant!;

  if (!email || !fullName || !role) {
    return res.status(400).json({ error: 'Email, nombre y rol son obligatorios.' });
  }

  try {
    let userId: string;

    // 1. Intentar invitar por email
    const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email);

    if (inviteError) {
      // Si hay error de límite de tasa, intentamos crear directamente
      if (inviteError.message.includes('rate limit exceeded')) {
        console.warn('Límite de invitaciones alcanzado. Intentando creación directa para:', email);
        const { data: createData, error: createError } = await supabaseAdmin.auth.admin.createUser({
          email,
          email_confirm: true,
          user_metadata: { full_name: fullName }
        });

        if (createError) {
          return res.status(400).json({ error: `Error tras límite de tasa: ${createError.message}` });
        }
        userId = createData.user.id;
      } else {
        return res.status(400).json({ error: inviteError.message });
      }
    } else {
      userId = inviteData.user!.id;
    }

    // 2. Insertar en tabla pública
    const { error: profileError } = await supabaseAdmin
      .from('users')
      .insert([
        {
          id: userId,
          school_id,
          role,
          full_name: fullName,
        },
      ]);

    if (profileError) {
      return res.status(500).json({ error: 'Error al crear el perfil del invitado.' });
    }

    // 3. Crear información de perfil vacía
    const { error: infoError } = await supabaseAdmin
      .from('profile_information')
      .insert([{ id: userId, school_id }]);

    if (infoError) {
      console.error('Error al crear profile_information para invitado:', infoError);
    }

    const message = userId ? `Usuario creado/invitado con éxito como ${role}.` : `Invitación enviada al correo del ${role}.`;
    res.status(200).json({ message });
  } catch (err) {
    console.error('Invite Error:', err);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
};
