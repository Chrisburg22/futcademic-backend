"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkAndUnlockAchievements = exports.getAchievements = void 0;
const supabase_1 = require("../config/supabase");
const getAchievements = async (req, res) => {
    const { school_id, user_id } = req.tenant;
    try {
        const { data: student } = await supabase_1.supabaseAdmin
            .from('students')
            .select('id')
            .eq('id', user_id)
            .eq('school_id', school_id)
            .single();
        const studentId = student?.id || user_id;
        const [allAchievements, unlocked] = await Promise.all([
            supabase_1.supabaseAdmin.from('achievements').select('*').eq('school_id', school_id).order('threshold'),
            supabase_1.supabaseAdmin.from('student_achievements').select('achievement_id, unlocked_at').eq('student_id', studentId)
        ]);
        const unlockedIds = new Set((unlocked.data || []).map((u) => u.achievement_id));
        const achievements = (allAchievements.data || []).map((a) => ({
            ...a,
            unlocked: unlockedIds.has(a.id),
            unlockedAt: (unlocked.data || []).find((u) => u.achievement_id === a.id)?.unlocked_at || null,
        }));
        res.json({
            achievements,
            unlockedCount: unlockedIds.size,
            totalCount: achievements.length,
        });
    }
    catch {
        res.status(500).json({ error: 'Error al obtener logros.' });
    }
};
exports.getAchievements = getAchievements;
const checkAndUnlockAchievements = async (req, res) => {
    const { school_id } = req.tenant;
    const { studentId } = req.body;
    if (!studentId)
        return res.status(400).json({ error: 'studentId es requerido.' });
    try {
        const { data: student } = await supabase_1.supabaseAdmin
            .from('students')
            .select('current_streak, max_streak')
            .eq('id', studentId).eq('school_id', school_id).single();
        if (!student)
            return res.status(404).json({ error: 'Alumno no encontrado.' });
        const { data: achievements } = await supabase_1.supabaseAdmin
            .from('achievements')
            .select('*')
            .eq('school_id', school_id);
        const { data: existing } = await supabase_1.supabaseAdmin
            .from('student_achievements')
            .select('achievement_id')
            .eq('student_id', studentId);
        const existingIds = new Set((existing || []).map((e) => e.achievement_id));
        const toUnlock = [];
        for (const achievement of achievements || []) {
            if (existingIds.has(achievement.id))
                continue;
            let meetsThreshold = false;
            if (achievement.type === 'racha' && (student.current_streak || 0) >= achievement.threshold)
                meetsThreshold = true;
            if (achievement.type === 'asistencias' && (student.max_streak || 0) >= achievement.threshold)
                meetsThreshold = true;
            if (meetsThreshold)
                toUnlock.push({ student_id: studentId, achievement_id: achievement.id });
        }
        if (toUnlock.length > 0) {
            await supabase_1.supabaseAdmin.from('student_achievements').insert(toUnlock);
        }
        res.json({ unlocked: toUnlock.length, newAchievements: toUnlock });
    }
    catch {
        res.status(500).json({ error: 'Error al verificar logros.' });
    }
};
exports.checkAndUnlockAchievements = checkAndUnlockAchievements;
