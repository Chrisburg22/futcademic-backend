import { Request, Response } from 'express';
import { supabaseAdmin } from '../config/supabase';

export const getAchievements = async (req: Request, res: Response) => {
  const { school_id, user_id } = req.tenant!;
  try {
    const { data: student } = await supabaseAdmin
      .from('students')
      .select('id')
      .eq('id', user_id)
      .eq('school_id', school_id)
      .single();

    const studentId = student?.id || user_id;

    const [allAchievements, unlocked] = await Promise.all([
      supabaseAdmin.from('achievements').select('*').eq('school_id', school_id).order('threshold'),
      supabaseAdmin.from('student_achievements').select('achievement_id, unlocked_at').eq('student_id', studentId)
    ]);

    const unlockedIds = new Set((unlocked.data || []).map((u: any) => u.achievement_id));
    const achievements = (allAchievements.data || []).map((a: any) => ({
      ...a,
      unlocked: unlockedIds.has(a.id),
      unlockedAt: (unlocked.data || []).find((u: any) => u.achievement_id === a.id)?.unlocked_at || null,
    }));

    res.json({
      achievements,
      unlockedCount: unlockedIds.size,
      totalCount: achievements.length,
    });
  } catch { res.status(500).json({ error: 'Error al obtener logros.' }); }
};

export const checkAndUnlockAchievements = async (req: Request, res: Response) => {
  const { school_id } = req.tenant!;
  const { studentId } = req.body;

  if (!studentId) return res.status(400).json({ error: 'studentId es requerido.' });

  try {
    const { data: student } = await supabaseAdmin
      .from('students')
      .select('current_streak, max_streak')
      .eq('id', studentId).eq('school_id', school_id).single();

    if (!student) return res.status(404).json({ error: 'Alumno no encontrado.' });

    const { data: achievements } = await supabaseAdmin
      .from('achievements')
      .select('*')
      .eq('school_id', school_id);

    const { data: existing } = await supabaseAdmin
      .from('student_achievements')
      .select('achievement_id')
      .eq('student_id', studentId);

    const existingIds = new Set((existing || []).map((e: any) => e.achievement_id));
    const toUnlock: any[] = [];

    for (const achievement of achievements || []) {
      if (existingIds.has(achievement.id)) continue;
      let meetsThreshold = false;
      if (achievement.type === 'racha' && (student.current_streak || 0) >= achievement.threshold) meetsThreshold = true;
      if (achievement.type === 'asistencias' && (student.max_streak || 0) >= achievement.threshold) meetsThreshold = true;
      if (meetsThreshold) toUnlock.push({ student_id: studentId, achievement_id: achievement.id });
    }

    if (toUnlock.length > 0) {
      await supabaseAdmin.from('student_achievements').insert(toUnlock);
    }

    res.json({ unlocked: toUnlock.length, newAchievements: toUnlock });
  } catch { res.status(500).json({ error: 'Error al verificar logros.' }); }
};
