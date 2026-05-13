"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveStudentUsername = exports.inviteAdmin = exports.inviteUser = exports.registerSchool = void 0;
const supabase_1 = require("../config/supabase");
const registerSchool = async (req, res) => {
    const { email, password, fullName, schoolName } = req.body;
    if (!email || !password || !fullName || !schoolName) {
        return res.status(400).json({ error: 'Faltan datos requeridos.' });
    }
    try {
        const { data: authData, error: authError } = await supabase_1.supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true, // Confirmar automáticamente para permitir login inmediato
        });
        if (authError || !authData.user)
            return res.status(400).json({ error: authError?.message || 'Error en auth' });
        const userId = authData.user.id;
        const { data: schoolData, error: schoolError } = await supabase_1.supabaseAdmin
            .from('schools')
            .insert([{ name: schoolName }])
            .select('id')
            .single();
        if (schoolError || !schoolData) {
            await supabase_1.supabaseAdmin.auth.admin.deleteUser(userId);
            return res.status(500).json({ error: 'Error al crear la escuela.' });
        }
        const { error: profileError } = await supabase_1.supabaseAdmin
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
        const { error: infoError } = await supabase_1.supabaseAdmin
            .from('profile_information')
            .insert([{ id: userId, school_id: schoolData.id }]);
        if (infoError) {
            console.error('Error al crear profile_information:', infoError);
            // No fallamos el registro completo por esto, pero lo logueamos
        }
        res.status(201).json({ message: 'Escuela y cuenta Admin registradas con éxito.' });
    }
    catch (err) {
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
};
exports.registerSchool = registerSchool;
const DEFAULT_PASSWORD = 'Futcamedic2024!';
const inviteUser = async (req, res) => {
    const { email: rawEmail, fullName, role, phone, categoryIds, permissions } = req.body;
    const { school_id } = req.tenant;
    if (!rawEmail || !fullName || !role) {
        return res.status(400).json({ error: 'Email, nombre y rol son obligatorios.' });
    }
    const email = rawEmail.trim().toLowerCase();
    try {
        // 1. Crear usuario con contraseña default — debe cambiarla en primer login
        const { data: authData, error: authError } = await supabase_1.supabaseAdmin.auth.admin.createUser({
            email,
            password: DEFAULT_PASSWORD,
            email_confirm: true, // Confirmar automáticamente para permitir login inmediato
            user_metadata: { full_name: fullName },
        });
        if (authError) {
            // Si ya existe en Auth, recuperar su ID
            if (authError.message.toLowerCase().includes('already registered') ||
                authError.message.toLowerCase().includes('already exists')) {
                const { data: { users } } = await supabase_1.supabaseAdmin.auth.admin.listUsers();
                const existing = users.find(u => u.email === email);
                if (!existing)
                    return res.status(400).json({ error: 'Usuario ya registrado pero no recuperable.' });
                const { data: existingProfile } = await supabase_1.supabaseAdmin
                    .from('users').select('id, school_id').eq('id', existing.id).single();
                if (existingProfile) {
                    await supabase_1.supabaseAdmin.auth.admin.updateUserById(existing.id, { email_confirm: true });
                    return res.status(400).json({
                        error: existingProfile.school_id === school_id
                            ? 'Este usuario ya está registrado en tu escuela.'
                            : 'Este usuario ya pertenece a otra escuela.'
                    });
                }
                await supabase_1.supabaseAdmin.auth.admin.updateUserById(existing.id, { email_confirm: true });
                const { error: profileError } = await supabase_1.supabaseAdmin
                    .from('users')
                    .insert([{ id: existing.id, school_id, role, full_name: fullName, must_change_password: true }]);
                if (profileError)
                    return res.status(500).json({ error: 'Error al crear perfil.' });
                await supabase_1.supabaseAdmin.from('profile_information').upsert([{ id: existing.id, school_id }]);
                if (role === 'profesor') {
                    await supabase_1.supabaseAdmin.from('teacher_permissions').upsert([{
                            school_id,
                            teacher_id: existing.id,
                            ...(permissions || {})
                        }]);
                    if (categoryIds && Array.isArray(categoryIds)) {
                        const assignments = categoryIds.map(catId => ({
                            school_id,
                            category_id: catId,
                            teacher_id: existing.id
                        }));
                        await supabase_1.supabaseAdmin.from('category_teachers').insert(assignments);
                    }
                }
                return res.status(200).json({ message: `Usuario registrado como ${role}.`, userId: existing.id });
            }
            return res.status(400).json({ error: authError.message });
        }
        const userId = authData.user.id;
        // 2. Crear perfil público con must_change_password = true
        const { error: profileError } = await supabase_1.supabaseAdmin
            .from('users')
            .insert([{ id: userId, school_id, role, full_name: fullName, must_change_password: true }]);
        if (profileError) {
            console.error('Error insertando perfil público:', profileError);
            return res.status(500).json({ error: 'Error al crear el perfil en la base de datos.' });
        }
        // 3. Perfil de información vacío (o con teléfono si viene)
        await supabase_1.supabaseAdmin.from('profile_information').upsert([{
                id: userId,
                school_id,
                phone: phone || null
            }]);
        // 4. Si es profesor, crear permisos y asignaciones
        if (role === 'profesor') {
            await supabase_1.supabaseAdmin.from('teacher_permissions').insert([{
                    school_id,
                    teacher_id: userId,
                    ...(permissions || {})
                }]);
            if (categoryIds && Array.isArray(categoryIds)) {
                const assignments = categoryIds.map(catId => ({
                    school_id,
                    category_id: catId,
                    teacher_id: userId
                }));
                await supabase_1.supabaseAdmin.from('category_teachers').insert(assignments);
            }
        }
        res.status(200).json({ message: `Usuario creado como ${role}. Contraseña default asignada.`, userId });
    }
    catch (err) {
        console.error('Invite Error Catch:', err);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
};
exports.inviteUser = inviteUser;
const inviteAdmin = async (req, res) => {
    const { email: rawEmail, fullName } = req.body;
    const { school_id } = req.tenant;
    if (!rawEmail || !fullName) {
        return res.status(400).json({ error: 'Email y nombre son obligatorios.' });
    }
    const email = rawEmail.trim().toLowerCase();
    try {
        const { data: authData, error: authError } = await supabase_1.supabaseAdmin.auth.admin.createUser({
            email,
            password: DEFAULT_PASSWORD,
            email_confirm: true,
            user_metadata: { full_name: fullName },
        });
        if (authError) {
            if (authError.message.toLowerCase().includes('already registered') ||
                authError.message.toLowerCase().includes('already exists')) {
                const { data: { users } } = await supabase_1.supabaseAdmin.auth.admin.listUsers();
                const existing = users.find(u => u.email === email);
                if (!existing)
                    return res.status(400).json({ error: 'Usuario ya registrado pero no recuperable.' });
                const { data: existingProfile } = await supabase_1.supabaseAdmin
                    .from('users').select('id, school_id').eq('id', existing.id).single();
                if (existingProfile) {
                    await supabase_1.supabaseAdmin.auth.admin.updateUserById(existing.id, { email_confirm: true });
                    return res.status(400).json({
                        error: existingProfile.school_id === school_id
                            ? 'Este usuario ya está registrado en tu escuela.'
                            : 'Este usuario ya pertenece a otra escuela.'
                    });
                }
                await supabase_1.supabaseAdmin.auth.admin.updateUserById(existing.id, { email_confirm: true });
                const { error: profileError } = await supabase_1.supabaseAdmin
                    .from('users')
                    .insert([{ id: existing.id, school_id, role: 'admin', full_name: fullName, must_change_password: true }]);
                if (profileError)
                    return res.status(500).json({ error: 'Error al crear perfil.' });
                await supabase_1.supabaseAdmin.from('profile_information').upsert([{ id: existing.id, school_id }]);
                return res.status(200).json({ message: 'Usuario registrado como admin.', userId: existing.id });
            }
            return res.status(400).json({ error: authError.message });
        }
        const userId = authData.user.id;
        const { error: profileError } = await supabase_1.supabaseAdmin
            .from('users')
            .insert([{ id: userId, school_id, role: 'admin', full_name: fullName, must_change_password: true }]);
        if (profileError)
            return res.status(500).json({ error: 'Error al crear perfil.' });
        await supabase_1.supabaseAdmin.from('profile_information').upsert([{ id: userId, school_id }]);
        res.status(200).json({ message: 'Admin creado. Contraseña default asignada.', userId });
    }
    catch (err) {
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
};
exports.inviteAdmin = inviteAdmin;
/**
 * Resuelve username de alumno → email interno para que el cliente haga
 * supabase.auth.signInWithPassword(email, password) en el siguiente paso.
 * No expone datos sensibles: solo el email interno (formato local) si el
 * username existe en alguna escuela.
 */
const resolveStudentUsername = async (req, res) => {
    const { username } = req.body;
    if (!username || typeof username !== 'string') {
        return res.status(400).json({ error: 'Username requerido.' });
    }
    const cleaned = username.trim().toLowerCase();
    try {
        const { data, error } = await supabase_1.supabaseAdmin
            .from('users')
            .select('id, school_id, role')
            .eq('username', cleaned)
            .eq('role', 'alumno')
            .maybeSingle();
        if (error || !data) {
            return res.status(404).json({ error: 'Usuario no encontrado.' });
        }
        // Reconstruir el email interno usado al crear el alumno
        const email = `${cleaned}@${data.school_id}.alumno.futcademic.local`;
        res.status(200).json({ email });
    }
    catch (err) {
        res.status(500).json({ error: 'Error interno.' });
    }
};
exports.resolveStudentUsername = resolveStudentUsername;
