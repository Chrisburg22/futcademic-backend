"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAlumnoDashboard = exports.getPadreDashboard = exports.getProfesorDashboard = exports.getAdminDashboard = void 0;
const supabase_1 = require("../config/supabase");
const getAdminDashboard = async (req, res) => {
    const { school_id } = req.tenant;
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const today = now.toISOString().split('T')[0];
    const nextWeek = new Date(now.getTime() + 7 * 86400000).toISOString().split('T')[0];
    try {
        const [{ count: activeStudents }, { data: monthlyPayments }, { data: pendingData }, { data: upcomingEvents }, { data: todayAttendances }, { count: totalStudents }] = await Promise.all([
            supabase_1.supabaseAdmin.from('students').select('id', { count: 'exact', head: true })
                .eq('school_id', school_id).eq('status', 'activo'),
            supabase_1.supabaseAdmin.from('payments').select('amount')
                .eq('school_id', school_id).eq('payment_type', 'mensualidad')
                .gte('payment_date', firstDay),
            supabase_1.supabaseAdmin.rpc('get_pending_payments_count', { p_school_id: school_id }),
            supabase_1.supabaseAdmin.from('events').select('id, date, start_time, type, description, category:categories(name)')
                .eq('school_id', school_id).gte('date', today).lte('date', nextWeek)
                .order('date').limit(5),
            supabase_1.supabaseAdmin.from('attendances').select('present')
                .eq('school_id', school_id).eq('date', today),
            supabase_1.supabaseAdmin.from('students').select('id', { count: 'exact', head: true })
                .eq('school_id', school_id)
        ]);
        const monthlyIncome = monthlyPayments?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;
        const attendancePresent = todayAttendances?.filter((a) => a.present).length || 0;
        const attendanceTotal = todayAttendances?.length || 0;
        res.json({
            activeStudents: activeStudents ?? 0,
            totalStudents: totalStudents ?? 0,
            monthlyIncome,
            pendingPayments: pendingData ?? 0,
            upcomingEvents: upcomingEvents ?? [],
            attendanceRate: attendanceTotal > 0 ? Math.round((attendancePresent / attendanceTotal) * 100) : 0,
        });
    }
    catch (err) {
        res.status(500).json({ error: 'Error al obtener dashboard.' });
    }
};
exports.getAdminDashboard = getAdminDashboard;
const getProfesorDashboard = async (req, res) => {
    const { school_id, user_id } = req.tenant;
    const today = new Date().toISOString().split('T')[0];
    try {
        const { data: myCategories } = await supabase_1.supabaseAdmin
            .from('category_teachers')
            .select('category_id, category:categories(id, name, color)')
            .eq('teacher_id', user_id).eq('school_id', school_id);
        const catIds = (myCategories || []).map((c) => c.category_id);
        let nextSession = null;
        if (catIds.length > 0) {
            const { data: sessions } = await supabase_1.supabaseAdmin
                .from('trainings')
                .select('*, category:categories(name), venue:venues(name)')
                .in('category_id', catIds).eq('school_id', school_id)
                .gte('date', today).eq('is_cancelled', false)
                .order('date').limit(1);
            nextSession = sessions?.[0] || null;
        }
        let todayTrainingQuery = supabase_1.supabaseAdmin
            .from('trainings')
            .select('*, category:categories(name), venue:venues(name)')
            .eq('school_id', school_id).eq('date', today).eq('is_cancelled', false)
            .order('start_time');
        if (catIds.length > 0)
            todayTrainingQuery = todayTrainingQuery.in('category_id', catIds);
        const { data: todayTrainings } = await todayTrainingQuery;
        res.json({
            categoriesCount: catIds.length,
            myCategories: myCategories?.map((c) => c.category) || [],
            nextSession,
            todayTrainings: todayTrainings || [],
        });
    }
    catch (err) {
        res.status(500).json({ error: 'Error al obtener dashboard profesor.' });
    }
};
exports.getProfesorDashboard = getProfesorDashboard;
const getPadreDashboard = async (req, res) => {
    const { school_id, user_id } = req.tenant;
    try {
        const { data: children } = await supabase_1.supabaseAdmin
            .from('students')
            .select('id, full_name, category:categories(name), avatar_url')
            .eq('school_id', school_id).eq('parent_id', user_id);
        const currentMonth = new Date().getMonth() + 1;
        let paymentAlert = null;
        if (children && children.length > 0) {
            const childIds = children.map((c) => c.id);
            const { data: paidThisMonth } = await supabase_1.supabaseAdmin
                .from('payments')
                .select('student_id')
                .eq('school_id', school_id).eq('payment_type', 'mensualidad')
                .eq('payment_month', currentMonth)
                .in('student_id', childIds);
            const paidIds = new Set((paidThisMonth || []).map((p) => p.student_id));
            const unpaid = (children || []).filter((c) => !paidIds.has(c.id));
            if (unpaid.length > 0) {
                paymentAlert = { count: unpaid.length, label: `${unpaid.length} hijo(s) sin pago este mes` };
            }
        }
        let nextTraining = null;
        if (children && children.length > 0) {
            const childIds = children.map((c) => c.id);
            const { data: students } = await supabase_1.supabaseAdmin
                .from('students')
                .select('category_id')
                .in('id', childIds);
            const catIds = [...new Set((students || []).map((s) => s.category_id))];
            if (catIds.length > 0) {
                const today = new Date().toISOString().split('T')[0];
                const { data: sessions } = await supabase_1.supabaseAdmin
                    .from('trainings')
                    .select('date, start_time, type, category:categories(name, color), venue:venues(name)')
                    .in('category_id', catIds).gte('date', today).eq('is_cancelled', false)
                    .order('date').limit(1);
                nextTraining = sessions?.[0] || null;
            }
        }
        res.json({
            children: children || [],
            nextTraining,
            paymentAlert,
        });
    }
    catch (err) {
        res.status(500).json({ error: 'Error al obtener dashboard padre.' });
    }
};
exports.getPadreDashboard = getPadreDashboard;
const getAlumnoDashboard = async (req, res) => {
    const { school_id, user_id } = req.tenant;
    try {
        const { data: student } = await supabase_1.supabaseAdmin
            .from('students')
            .select('*, category:categories(name, color)')
            .eq('id', user_id).eq('school_id', school_id).single();
        const now = new Date();
        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
        const today = now.toISOString().split('T')[0];
        let trainingsPromise = Promise.resolve({ count: 0, data: [] });
        let nextTrainingPromise = Promise.resolve(null);
        let achievementsPromise = Promise.resolve([]);
        if (student?.category_id) {
            trainingsPromise = supabase_1.supabaseAdmin
                .from('attendances')
                .select('present', { count: 'exact', head: false })
                .eq('student_id', user_id).eq('school_id', school_id)
                .gte('date', firstDay);
            nextTrainingPromise = supabase_1.supabaseAdmin
                .from('trainings')
                .select('date, start_time, type, venue:venues(name), category:categories(name, color)')
                .eq('category_id', student.category_id).eq('school_id', school_id)
                .gte('date', today).eq('is_cancelled', false).order('date').limit(1)
                .then(r => r.data?.[0] || null);
            achievementsPromise = supabase_1.supabaseAdmin
                .from('student_achievements')
                .select('achievement:achievements(*)')
                .eq('student_id', user_id)
                .then(r => r.data || []);
        }
        const [trainingData, nextTraining, unlockedAchievements] = await Promise.all([
            trainingsPromise,
            nextTrainingPromise,
            achievementsPromise
        ]);
        res.json({
            studentName: student?.full_name,
            category: student?.category,
            currentStreak: student?.current_streak || 0,
            maxStreak: student?.max_streak || 0,
            trainingsThisMonth: trainingData?.length ?? 0,
            attendedThisMonth: (trainingData?.data ?? []).filter((a) => a.present).length,
            nextTraining,
            achievementsUnlocked: (unlockedAchievements ?? []).length,
        });
    }
    catch (err) {
        res.status(500).json({ error: 'Error al obtener dashboard alumno.' });
    }
};
exports.getAlumnoDashboard = getAlumnoDashboard;
