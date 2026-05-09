import { MockQueryBuilder, createMockSupabase, mockReq, mockRes } from './helpers';

const mockSupabase = createMockSupabase();

jest.mock('../config/supabase', () => ({
  supabaseAdmin: mockSupabase,
}));

import { getStudentStats, getStudentTeam, updateStatus } from '../controllers/student.controller';

beforeEach(() => {
  jest.clearAllMocks();
  mockSupabase._builders.clear();
});

describe('getStudentStats', () => {
  it('returns student stats with streak and attendance', async () => {
    mockSupabase._setMockData('students', { data: { current_streak: 5, max_streak: 12 }, error: null });
    mockSupabase._setMockData('attendances', {
      data: [{ present: true }, { present: true }, { present: false }],
      error: null,
    });
    mockSupabase._setMockData('achievements', { data: [], error: null, count: 10 });
    mockSupabase._setMockData('student_achievements', { data: [], error: null, count: 3 });

    const req = mockReq({ params: { id: 'student-1' } });
    const res = mockRes();

    await getStudentStats(req as any, res as any);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        currentStreak: 5,
        maxStreak: 12,
        trainingsThisMonth: 3,
        attendedThisMonth: 2,
        achievementsUnlocked: 3,
        totalAchievements: 10,
      })
    );
  });
});

describe('getStudentTeam', () => {
  it('returns teammates from same category', async () => {
    const studentData = { category_id: 'cat-1' };
    const teammatesData = [
      { id: 's2', full_name: 'Compañero 1', current_streak: 3 },
      { id: 's3', full_name: 'Compañero 2', current_streak: 0 },
    ];

    const studentsBuilder = mockSupabase._builders.get('students');
    if (studentsBuilder) {
      studentsBuilder.single = jest.fn().mockResolvedValue({ data: studentData, error: null });
    }
    mockSupabase._setMockData('students', { data: teammatesData, error: null });
    mockSupabase._setMockData('categories', { data: { name: 'U-12', color: '#FF6B6B', birth_year: 2012 }, error: null });

    const req = mockReq({ params: { id: 'student-1' } });
    const res = mockRes();

    await getStudentTeam(req as any, res as any);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        teamName: 'U-12',
        totalTeammates: 2,
      })
    );
  });
});

describe('updateStatus', () => {
  it('validates new status values', async () => {
    mockSupabase._setMockData('students', { data: null, error: null });

    const req = mockReq({ params: { id: 'student-1' }, body: { status: 'pendiente_pago' } });
    const res = mockRes();

    await updateStatus(req as any, res as any);

    expect(res.json).toHaveBeenCalledWith({ message: 'Estado actualizado.' });
  });

  it('rejects invalid status values', async () => {
    const req = mockReq({ body: { status: 'invalid' } });
    const res = mockRes();

    await updateStatus(req as any, res as any);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('rejects old status values', async () => {
    const req = mockReq({ body: { status: 'beca' } });
    const res = mockRes();

    await updateStatus(req as any, res as any);

    expect(res.status).toHaveBeenCalledWith(400);
  });
});
