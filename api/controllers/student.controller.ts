import { Request, Response } from 'express';
import { supabaseAdmin } from '../config/supabase';

export const getStudents = async (req: Request, res: Response) => {
  const { school_id, user_id, role } = req.tenant!;
  const { category_id, parent_id } = req.query;

  try {
    let query = supabaseAdmin
      .from('students')
      .select(`
        *,
        parent:users!students_parent_id_fkey(id, full_name),
        category:categories(id, name)
      `)
      .eq('school_id', school_id)
      .order('full_name', { ascending: true });

    if (category_id) {
      query = query.eq('category_id', category_id);
    }

    if (parent_id) {
      const resolvedParentId = parent_id === 'me' ? user_id : parent_id as string;
      query = query.eq('parent_id', resolvedParentId);
    } else if (role === 'padre') {
      query = query.eq('parent_id', user_id);
    }

    const { data, error } = await query;
    if (error) {
      console.error('DB Error getStudents:', error);
      return res.status(500).json({ 
        error: 'Error al consultar lista de alumnos.', 
        details: error.message,
        hint: 'Asegúrate de haber corrido los scripts de ALTER TABLE en Supabase.'
      });
    }
    
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: 'Error interno.' });
  }
};

export const getStudentDetails = async (req: Request, res: Response) => {
  const { school_id } = req.tenant!;
  const { id } = req.params;

  try {
    const { data: student, error } = await supabaseAdmin
      .from('students')
      .select(`
        *,
        parent:users!students_parent_id_fkey(id, full_name, phone),
        category:categories(id, name, color)
      `)
      .eq('id', id)
      .eq('school_id', school_id)
      .single();

    if (error || !student) {
      console.error('Error fetching student details:', error);
      return res.status(404).json({ error: 'Alumno no encontrado.', details: error?.message });
    }

    // Obtener email del auth de manera segura
    let email = 'Sin email (No registrado en Auth)';
    try {
      const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.getUserById(id);
      if (!authError && authUser?.user?.email) {
        email = authUser.user.email;
      } else if (authError) {
        // Logueamos solo una advertencia, no el objeto de error completo si es un error de BD interno
        console.warn(`Aviso: Identidad Auth no encontrada para el ID: ${id}`);
      }
    } catch (e) {
      console.warn('Error inesperado consultando identidad:', id);
    }

    res.status(200).json({ ...student, email });
  } catch (err) {
    res.status(500).json({ error: 'Error interno.' });
  }
};

export const createStudent = async (req: Request, res: Response) => {
  const { school_id } = req.tenant!;
  const { category_id, parent_id, full_name, birth_date, email } = req.body;

  if (!category_id || !full_name || !birth_date || !email) {
    return res.status(400).json({ error: 'Faltan campos obligatorios (Email incluido).' });
  }

  try {
    // 1. Crear usuario en Auth con contraseña default — alumno debe cambiarla en primer login
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: 'Futcamedic2024!',
      email_confirm: true,
    });

    if (authError || !authData.user) {
      return res.status(400).json({ error: authError?.message || 'Error creando identidad.' });
    }

    const userId = authData.user.id;

    // 2. Crear perfil base en public.users
    const { error: userError } = await supabaseAdmin
      .from('users')
      .insert([{ id: userId, school_id, role: 'alumno', full_name, must_change_password: true }]);

    if (userError) return res.status(500).json({ error: 'Error al crear perfil de usuario.' });

    // 3. Crear registro en profile_information
    await supabaseAdmin
      .from('profile_information')
      .insert([{ id: userId, school_id }]);

    // 4. Crear registro en students
    const { data: student, error: studentError } = await supabaseAdmin
      .from('students')
      .insert([{ 
        id: userId, 
        school_id, 
        category_id, 
        parent_id: parent_id || null, 
        full_name, 
        birth_date,
        status: 'activo'
      }])
      .select()
      .single();

    if (studentError) return res.status(500).json({ error: 'Error al registrar alumno.' });

    res.status(201).json(student);
  } catch (err) {
    res.status(500).json({ error: 'Error interno.' });
  }
};

export const updateStudent = async (req: Request, res: Response) => {
  const { school_id } = req.tenant!;
  const { id } = req.params;
  const { 
    full_name, 
    birth_date, 
    category_id,
    parent_id,
    status,
    phone, 
    address, 
    emergency_contact_name, 
    emergency_contact_phone, 
    medical_notes,
    avatar_url
  } = req.body;

  try {
    // 1. Actualizar tabla students
    const { error: studentError } = await supabaseAdmin
      .from('students')
      .update({ full_name, birth_date, category_id, parent_id, status })
      .eq('id', id)
      .eq('school_id', school_id);

    if (studentError) return res.status(400).json({ error: 'Error al actualizar alumno.' });

    // 2. Actualizar tabla users (falla si no se usa el ID correcto)
    const userUpdates: any = {};
    if (full_name) userUpdates.full_name = full_name;
    if (avatar_url) userUpdates.avatar_url = avatar_url;

    if (Object.keys(userUpdates).length > 0) {
      await supabaseAdmin
        .from('users')
        .update(userUpdates)
        .eq('id', id);
    }

    // 3. Actualizar tabla profile_information
    const { error: profileError } = await supabaseAdmin
      .from('profile_information')
      .upsert({
        id,
        school_id,
        phone,
        address,
        emergency_contact_name,
        emergency_contact_phone,
        medical_notes,
        avatar_url,
        updated_at: new Date().toISOString()
      });

    if (profileError) {
      console.error('profileError:', profileError);
      return res.status(400).json({ error: profileError.message || 'Error al actualizar perfil.' });
    }

    res.status(200).json({ message: 'Alumno actualizado con éxito.' });
  } catch (err) {
    res.status(500).json({ error: 'Error interno.' });
  }
};

export const updateUniform = async (req: Request, res: Response) => {
  const { school_id } = req.tenant!;
  const { id } = req.params;
  const { uniform_delivered } = req.body;

  try {
    const { error } = await supabaseAdmin
      .from('students')
      .update({ uniform_delivered: !!uniform_delivered })
      .eq('id', id)
      .eq('school_id', school_id); 
    
    if (error) return res.status(500).json({ error: 'Error de BD actualizando status.' });
    res.status(200).json({ message: 'Estatus del uniforme actualizado.' });
  } catch (err) {
    res.status(500).json({ error: 'Error interno.' });
  }
};

export const updateStatus = async (req: Request, res: Response) => {
  const { school_id } = req.tenant!;
  const { id } = req.params;
  const { status } = req.body;

  if (!status || !['activo', 'pendiente_pago', 'inactivo', 'becado'].includes(status)) {
    return res.status(400).json({ error: 'Estado inválido. Debe ser: activo, pendiente_pago, inactivo o becado.' });
  }

  try {
    const { error } = await supabaseAdmin
      .from('students')
      .update({ status })
      .eq('id', id)
      .eq('school_id', school_id);

    if (error) return res.status(400).json({ error: 'Error al actualizar estado.' });
    res.status(200).json({ message: 'Estado actualizado.' });
  } catch (err) {
    res.status(500).json({ error: 'Error interno.' });
  }
};



export const deleteStudent = async (req: Request, res: Response) => {
  const { school_id, user_id } = req.tenant!;
  const { id } = req.params;

  try {
    // 1. Obtener datos del alumno antes de eliminar
    const { data: student, error: fetchError } = await supabaseAdmin
      .from('students')
      .select('*')
      .eq('id', id)
      .eq('school_id', school_id)
      .single();

    if (fetchError || !student) {
      return res.status(404).json({ error: 'Alumno no encontrado.' });
    }

    // 2. Registrar en deleted_students para auditoría
    await supabaseAdmin
      .from('deleted_students')
      .insert([{
        school_id,
        original_student_id: student.id,
        full_name: student.full_name,
        birth_date: student.birth_date,
        category_id: student.category_id,
        parent_id: student.parent_id,
        deleted_by: user_id
      }]);

    // 3. Eliminar alumno (las asistencias se borran en cascada, payments quedan con student_id=NULL)
    const { error: deleteError } = await supabaseAdmin
      .from('students')
      .delete()
      .eq('id', id)
      .eq('school_id', school_id);

    if (deleteError) return res.status(400).json({ error: 'Error al eliminar alumno.' });

    res.status(200).json({ message: 'Alumno eliminado permanentemente.' });
  } catch (err) {
    res.status(500).json({ error: 'Error interno.' });
  }
};

export const getDeletedStudents = async (req: Request, res: Response) => {
  const { school_id } = req.tenant!;

  try {
    const { data, error } = await supabaseAdmin
      .from('deleted_students')
      .select('*, category:categories(name), deleted_by_user:users(full_name)')
      .eq('school_id', school_id)
      .order('deleted_at', { ascending: false });

    if (error) return res.status(500).json({ error: 'Error al consultar alumnos eliminados.' });
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: 'Error interno.' });
  }
};

export const getStudentStats = async (req: Request, res: Response) => {
  const { school_id } = req.tenant!;
  const { id } = req.params;
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];

  try {
    const { data: student } = await supabaseAdmin
      .from('students')
      .select('current_streak, max_streak')
      .eq('id', id).eq('school_id', school_id).single();

    if (!student) return res.status(404).json({ error: 'Alumno no encontrado.' });

    const { data: monthlyAttendance } = await supabaseAdmin
      .from('attendances')
      .select('present', { count: 'exact' })
      .eq('student_id', id).eq('school_id', school_id)
      .gte('date', firstDay);

    const { count: totalAchievements } = await supabaseAdmin
      .from('achievements')
      .select('id', { count: 'exact', head: true })
      .eq('school_id', school_id);

    const { count: unlockedAchievements } = await supabaseAdmin
      .from('student_achievements')
      .select('id', { count: 'exact', head: true })
      .eq('student_id', id);

    res.json({
      currentStreak: student.current_streak || 0,
      maxStreak: student.max_streak || 0,
      trainingsThisMonth: monthlyAttendance?.length || 0,
      attendedThisMonth: (monthlyAttendance || []).filter((a: any) => a.present).length || 0,
      achievementsUnlocked: unlockedAchievements || 0,
      totalAchievements: totalAchievements || 0,
    });
  } catch { res.status(500).json({ error: 'Error al obtener estadísticas.' }); }
};

export const getStudentTeam = async (req: Request, res: Response) => {
  const { school_id, user_id } = req.tenant!;
  const { id } = req.params;
  const studentId = id === 'me' ? user_id : id;

  try {
    const { data: student } = await supabaseAdmin
      .from('students')
      .select('category_id')
      .eq('id', studentId).eq('school_id', school_id).single();

    if (!student) return res.status(404).json({ error: 'Alumno no encontrado.' });

    const { data: teammates } = await supabaseAdmin
      .from('students')
      .select('id, full_name, avatar_url, current_streak')
      .eq('category_id', student.category_id).eq('school_id', school_id)
      .eq('status', 'activo')
      .neq('id', studentId);

    const { data: category } = await supabaseAdmin
      .from('categories')
      .select('name, color, birth_year')
      .eq('id', student.category_id).single();

    res.json({
      teamName: category?.name || 'Mi Equipo',
      color: category?.color,
      birthYear: category?.birth_year,
      totalTeammates: teammates?.length || 0,
      teammates: teammates || [],
    });
  } catch { res.status(500).json({ error: 'Error al obtener equipo.' }); }
};
