"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updatePushToken = exports.changeOwnPassword = exports.completeOnboarding = exports.updateOwnProfile = exports.updateUser = exports.getTeacherDetails = exports.getUsers = void 0;
const supabase_1 = require("../config/supabase");
const getUsers = async (req, res) => {
    const { school_id } = req.tenant;
    const { role } = req.query;
    try {
        let query = supabase_1.supabaseAdmin
            .from('users')
            .select(`
        id, 
        full_name, 
        role, 
        created_at,
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
            query = query.eq('role', role);
        }
        const { data: users, error } = await query;
        if (error)
            return res.status(500).json({ error: 'Error interno al consultar usuarios.' });
        res.status(200).json(users);
    }
    catch (err) {
        res.status(500).json({ error: 'Error del servidor.' });
    }
};
exports.getUsers = getUsers;
const getTeacherDetails = async (req, res) => {
    const { school_id } = req.tenant;
    const { id } = req.params;
    try {
        // 1. Obtener info básica del profesor y su perfil
        const { data: user, error: userError } = await supabase_1.supabaseAdmin
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
        if (userError || !user)
            return res.status(404).json({ error: 'Profesor no encontrado.' });
        // 2. Obtener el email desde auth.users
        const { data: authUser } = await supabase_1.supabaseAdmin.auth.admin.getUserById(id);
        const email = authUser?.user?.email || 'Sin email';
        // 3. Obtener categorías asignadas
        const { data: catData } = await supabase_1.supabaseAdmin
            .from('category_teachers')
            .select('category:categories(id, name)')
            .eq('teacher_id', id);
        // 4. Obtener permisos
        const { data: permissions } = await supabase_1.supabaseAdmin
            .from('teacher_permissions')
            .select('*')
            .eq('teacher_id', id)
            .maybeSingle();
        res.status(200).json({
            ...user,
            email,
            categories: catData?.map((c) => c.category) || [],
            permissions: permissions || {
                can_take_attendance: false,
                can_manage_events: false,
                can_view_finances: false,
                can_manage_students: false,
                can_manage_categories: false,
                can_manage_payments: false
            }
        });
    }
    catch (err) {
        console.error('getTeacherDetails Error:', err);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
};
exports.getTeacherDetails = getTeacherDetails;
const updateUser = async (req, res) => {
    const { school_id } = req.tenant;
    const { id } = req.params;
    const { full_name, phone, address, birth_date, gender, emergency_contact_name, emergency_contact_phone, medical_notes, avatar_url, categoryIds, permissions } = req.body;
    try {
        // 1. Actualizar nombre en tabla users
        if (full_name) {
            await supabase_1.supabaseAdmin
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
        await supabase_1.supabaseAdmin
            .from('profile_information')
            .upsert({ id, ...profileData });
        // 3. Actualizar categorías
        if (categoryIds && Array.isArray(categoryIds)) {
            await supabase_1.supabaseAdmin.from('category_teachers').delete().eq('teacher_id', id);
            if (categoryIds.length > 0) {
                const catInserts = categoryIds.map(catId => ({
                    teacher_id: id,
                    category_id: catId,
                    school_id
                }));
                await supabase_1.supabaseAdmin.from('category_teachers').insert(catInserts);
            }
        }
        // 4. Actualizar permisos
        if (permissions) {
            await supabase_1.supabaseAdmin
                .from('teacher_permissions')
                .upsert({
                teacher_id: id,
                school_id,
                ...permissions,
                updated_at: new Date()
            });
        }
        res.status(200).json({ message: 'Usuario actualizado con éxito.' });
    }
    catch (err) {
        console.error('updateUser Error:', err);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
};
exports.updateUser = updateUser;
const updateOwnProfile = async (req, res) => {
    const { user_id, school_id } = req.tenant;
    const { full_name, phone, avatar_url } = req.body;
    try {
        if (full_name || avatar_url) {
            await supabase_1.supabaseAdmin
                .from('users')
                .update({ ...(full_name ? { full_name } : {}), ...(avatar_url ? { avatar_url } : {}) })
                .eq('id', user_id)
                .eq('school_id', school_id);
        }
        if (phone || avatar_url) {
            await supabase_1.supabaseAdmin
                .from('profile_information')
                .upsert({ id: user_id, school_id, ...(phone ? { phone } : {}), ...(avatar_url ? { avatar_url } : {}), updated_at: new Date() });
        }
        res.status(200).json({ message: 'Perfil actualizado.' });
    }
    catch (err) {
        res.status(500).json({ error: 'Error interno.' });
    }
};
exports.updateOwnProfile = updateOwnProfile;
const completeOnboarding = async (req, res) => {
    const { user_id, school_id } = req.tenant;
    try {
        await supabase_1.supabaseAdmin
            .from('users')
            .update({ onboarded_at: new Date().toISOString() })
            .eq('id', user_id)
            .eq('school_id', school_id);
        res.status(200).json({ message: 'Onboarding completado.' });
    }
    catch (err) {
        res.status(500).json({ error: 'Error interno.' });
    }
};
exports.completeOnboarding = completeOnboarding;
const changeOwnPassword = async (req, res) => {
    const { user_id, school_id } = req.tenant;
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 8) {
        return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres.' });
    }
    try {
        const { error: authError } = await supabase_1.supabaseAdmin.auth.admin.updateUserById(user_id, {
            password: newPassword,
        });
        if (authError)
            return res.status(400).json({ error: 'Error al actualizar contraseña.' });
        await supabase_1.supabaseAdmin
            .from('users')
            .update({ must_change_password: false })
            .eq('id', user_id)
            .eq('school_id', school_id);
        res.status(200).json({ message: 'Contraseña actualizada con éxito.' });
    }
    catch (err) {
        res.status(500).json({ error: 'Error interno.' });
    }
};
exports.changeOwnPassword = changeOwnPassword;
const updatePushToken = async (req, res) => {
    const { user_id } = req.tenant;
    const { push_token } = req.body;
    if (!push_token)
        return res.status(400).json({ error: 'push_token requerido.' });
    try {
        await supabase_1.supabaseAdmin.from('users').update({ push_token }).eq('id', user_id);
        res.status(200).json({ message: 'Token registrado.' });
    }
    catch (err) {
        res.status(500).json({ error: 'Error interno.' });
    }
};
exports.updatePushToken = updatePushToken;
