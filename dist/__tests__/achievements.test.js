"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const helpers_1 = require("./helpers");
const mockSupabase = (0, helpers_1.createMockSupabase)();
jest.mock('../config/supabase', () => ({
    supabaseAdmin: mockSupabase,
}));
const achievement_controller_1 = require("../controllers/achievement.controller");
beforeEach(() => {
    jest.clearAllMocks();
    mockSupabase._builders.clear();
});
describe('getAchievements', () => {
    it('returns achievements with unlocked status', async () => {
        mockSupabase._setMockData('students', { data: { id: 'user-1' }, error: null });
        mockSupabase._setMockData('achievements', {
            data: [
                { id: 'a1', name: 'Racha 5', type: 'racha', threshold: 5 },
                { id: 'a2', name: 'Racha 10', type: 'racha', threshold: 10 },
            ],
            error: null,
        });
        mockSupabase._setMockData('student_achievements', {
            data: [{ achievement_id: 'a1', unlocked_at: '2026-05-01' }],
            error: null,
        });
        const req = (0, helpers_1.mockReq)({ tenant: { school_id: 'school-1', role: 'alumno', user_id: 'user-1' } });
        const res = (0, helpers_1.mockRes)();
        await (0, achievement_controller_1.getAchievements)(req, res);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            unlockedCount: 1,
            totalCount: 2,
            achievements: expect.arrayContaining([
                expect.objectContaining({ id: 'a1', unlocked: true }),
                expect.objectContaining({ id: 'a2', unlocked: false }),
            ]),
        }));
    });
});
describe('checkAndUnlockAchievements', () => {
    it('unlocks new achievements when thresholds are met', async () => {
        mockSupabase._setMockData('students', { data: { current_streak: 12, max_streak: 15 }, error: null });
        mockSupabase._setMockData('achievements', {
            data: [
                { id: 'a1', name: 'Racha 5', type: 'racha', threshold: 5 },
                { id: 'a2', name: 'Racha 10', type: 'racha', threshold: 10 },
                { id: 'a3', name: 'Racha 20', type: 'racha', threshold: 20 },
            ],
            error: null,
        });
        mockSupabase._setMockData('student_achievements', { data: [], error: null });
        const req = (0, helpers_1.mockReq)({ body: { studentId: 'user-1' } });
        const res = (0, helpers_1.mockRes)();
        await (0, achievement_controller_1.checkAndUnlockAchievements)(req, res);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            unlocked: 2,
            newAchievements: expect.arrayContaining([
                expect.objectContaining({ achievement_id: 'a1' }),
                expect.objectContaining({ achievement_id: 'a2' }),
            ]),
        }));
    });
    it('returns 400 if studentId is missing', async () => {
        const req = (0, helpers_1.mockReq)({ body: {} });
        const res = (0, helpers_1.mockRes)();
        await (0, achievement_controller_1.checkAndUnlockAchievements)(req, res);
        expect(res.status).toHaveBeenCalledWith(400);
    });
});
