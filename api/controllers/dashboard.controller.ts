import { Request, Response } from 'express';
import { supabaseAdmin } from '../config/supabase';

export const getAdminDashboard = async (req: Request, res: Response) => {
  const { school_id } = req.tenant!;
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const today = now.toISOString().split('T')[0];
  const nextWeek = new Date(now.getTime() + 7 * 86400000).toISOString().split('T')[0];

  try {
    const [
      { count: activeStudents },
      { data: monthlyPayments },
      { data: pendingData },
      { data: upcomingEvents },
      { data: todayAttendances },
      { count: totalStudents }
    ] = await Promise.all([
      supabaseAdmin.from('students').select('id', { count: 'exact', head: true })
        .eq('school_id', school_id).eq('status', 'activo'),
      supabaseAdmin.from('payments').select('amount')
        .eq('school_id', school_id).eq('payment_type', 'mensualidad')
        .gte('payment_date', firstDay),
      supabaseAdmin.rpc('get_pending_payments_count', { p_school_id: school_id }),
      supabaseAdmin.from('events').select('id, date, start_time, type, description, category:categories(name)')
        .eq('school_id', school_id).gte('date', today).lte('date', nextWeek)
        .order('date').limit(5),
      supabaseAdmin.from('attendances').select('present')
        .eq('school_id', school_id).eq('date', today),
      supabaseAdmin.from('students').select('id', { count: 'exact', head: true })
        .eq('school_id', school_id)
    ]);

    const monthlyIncome = monthlyPayments?.reduce((sum: number, p: any) => sum + Number(p.amount), 0) || 0;
    const attendancePresent = todayAttendances?.filter((a: any) => a.present).length || 0;
    const attendanceTotal = todayAttendances?.length || 0;

    res.json({
      activeStudents: activeStudents ?? 0,
      totalStudents: totalStudents ?? 0,
      monthlyIncome,
      pendingPayments: pendingData ?? 0,
      upcomingEvents: upcomingEvents ?? [],
      attendanceRate: attendanceTotal > 0 ? Math.round((attendancePresent / attendanceTotal) * 100) : 0,
    });
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener dashboard.' });
  }
};

export const getProfesorDashboard = async (req: Request, res: Response) => {
  const { school_id, user_id } = req.tenant!;
  const today = new Date().toISOString().split('T')[0];

  try {
    const { data: myCategories } = await supabaseAdmin
      .from('category_teachers')
      .select('category_id, category:categories(id, name, color)')
      .eq('teacher_id', user_id).eq('school_id', school_id);

    const catIds = (myCategories || []).map((c: any) => c.category_id);
    let nextSession = null;
    if (catIds.length > 0) {
      const { data: sessions } = await supabaseAdmin
        .from('trainings')
        .select('*, category:categories(name), venue:venues(name)')
        .in('category_id', catIds).eq('school_id', school_id)
        .gte('date', today).eq('is_cancelled', false)
        .order('date').limit(1);
      nextSession = sessions?.[0] || null;
    }

    let todayTrainingQuery = supabaseAdmin
      .from('trainings')
      .select('*, category:categories(name), venue:venues(name)')
      .eq('school_id', school_id).eq('date', today).eq('is_cancelled', false)
      .order('start_time');
    if (catIds.length > 0) todayTrainingQuery = todayTrainingQuery.in('category_id', catIds);
    const { data: todayTrainings } = await todayTrainingQuery;

    res.json({
      categoriesCount: catIds.length,
      myCategories: myCategories?.map((c: any) => c.category) || [],
      nextSession,
      todayTrainings: todayTrainings || [],
    });
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener dashboard profesor.' });
  }
};

export const getPadreDashboard = async (req: Request, res: Response) => {
  const { school_id, user_id } = req.tenant!;

  try {
    const { data: children } = await supabaseAdmin
      .from('students')
      .select('id, full_name, category:categories(name), avatar_url')
      .eq('school_id', school_id).eq('parent_id', user_id);

    const currentMonth = new Date().getMonth() + 1;
    let paymentAlert = null;
    if (children && children.length > 0) {
      const childIds = children.map((c: any) => c.id);
      const { data: paidThisMonth } = await supabaseAdmin
        .from('payments')
        .select('student_id')
        .eq('school_id', school_id).eq('payment_type', 'mensualidad')
        .eq('payment_month', currentMonth)
        .in('student_id', childIds);
      const paidIds = new Set((paidThisMonth || []).map((p: any) => p.student_id));
      const unpaid = (children || []).filter((c: any) => !paidIds.has(c.id));
      if (unpaid.length > 0) {
        paymentAlert = { count: unpaid.length, label: `${unpaid.length} hijo(s) sin pago este mes` };
      }
    }

    let nextTraining = null;
    if (children && children.length > 0) {
      const childIds = children.map((c: any) => c.id);
      const { data: students } = await supabaseAdmin
        .from('students')
        .select('category_id')
        .in('id', childIds);
      const catIds = [...new Set((students || []).map((s: any) => s.category_id))];
      if (catIds.length > 0) {
        const today = new Date().toISOString().split('T')[0];
        const { data: sessions } = await supabaseAdmin
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
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener dashboard padre.' });
  }
};

export const getAlumnoDashboard = async (req: Request, res: Response) => {
  const { school_id, user_id } = req.tenant!;

  try {
    const { data: student } = await supabaseAdmin
      .from('students')
      .select('*, category:categories(name, color)')
      .eq('id', user_id).eq('school_id', school_id).single();

    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const today = now.toISOString().split('T')[0];

    let trainingsPromise: any = Promise.resolve({ count: 0, data: [] });
    let nextTrainingPromise: any = Promise.resolve(null);
    let achievementsPromise: any = Promise.resolve([]);

    if (student?.category_id) {
      trainingsPromise = supabaseAdmin
        .from('attendances')
        .select('present', { count: 'exact', head: false })
        .eq('student_id', user_id).eq('school_id', school_id)
        .gte('date', firstDay);

      nextTrainingPromise = supabaseAdmin
        .from('trainings')
        .select('date, start_time, type, venue:venues(name), category:categories(name, color)')
        .eq('category_id', student.category_id).eq('school_id', school_id)
        .gte('date', today).eq('is_cancelled', false).order('date').limit(1)
        .then(r => r.data?.[0] || null);

      achievementsPromise = supabaseAdmin
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
      attendedThisMonth: (trainingData?.data ?? []).filter((a: any) => a.present).length,
      nextTraining,
      achievementsUnlocked: (unlockedAchievements ?? []).length,
    });
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener dashboard alumno.' });
  }
};
