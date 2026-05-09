import { MockQueryBuilder, createMockSupabase, mockReq, mockRes } from './helpers';

const mockSupabase = createMockSupabase();

jest.mock('../config/supabase', () => ({
  supabaseAdmin: mockSupabase,
}));

import { getAchievements, checkAndUnlockAchievements } from '../controllers/achievement.controller';

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

    const req = mockReq({ tenant: { school_id: 'school-1', role: 'alumno', user_id: 'user-1' } });
    const res = mockRes();

    await getAchievements(req as any, res as any);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        unlockedCount: 1,
        totalCount: 2,
        achievements: expect.arrayContaining([
          expect.objectContaining({ id: 'a1', unlocked: true }),
          expect.objectContaining({ id: 'a2', unlocked: false }),
        ]),
      })
    );
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

    const req = mockReq({ body: { studentId: 'user-1' } });
    const res = mockRes();

    await checkAndUnlockAchievements(req as any, res as any);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        unlocked: 2,
        newAchievements: expect.arrayContaining([
          expect.objectContaining({ achievement_id: 'a1' }),
          expect.objectContaining({ achievement_id: 'a2' }),
        ]),
      })
    );
  });

  it('returns 400 if studentId is missing', async () => {
    const req = mockReq({ body: {} });
    const res = mockRes();

    await checkAndUnlockAchievements(req as any, res as any);

    expect(res.status).toHaveBeenCalledWith(400);
  });
});
