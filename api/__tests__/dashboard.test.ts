import { MockQueryBuilder, createMockSupabase, mockReq, mockRes } from './helpers';

const mockSupabase = createMockSupabase();

jest.mock('../config/supabase', () => ({
  supabaseAdmin: mockSupabase,
}));

import { getAdminDashboard, getProfesorDashboard, getPadreDashboard, getAlumnoDashboard } from '../controllers/dashboard.controller';

beforeEach(() => {
  jest.clearAllMocks();
  mockSupabase._builders.clear();
});

describe('getAdminDashboard', () => {
  it('returns KPIs for admin dashboard', async () => {
    mockSupabase._setMockData('students', { data: [], error: null, count: 25 });
    mockSupabase._setMockData('payments', {
      data: [{ amount: 500 }, { amount: 300 }, { amount: 200 }],
      error: null,
    });
    mockSupabase._setMockData('events', {
      data: [{ id: 'e1', date: '2026-05-10', type: 'entrenamiento', category: { name: 'U-12' } }],
      error: null,
    });
    mockSupabase._setMockData('attendances', {
      data: [{ present: true }, { present: true }, { present: false }],
      error: null,
    });
    mockSupabase.rpc.mockResolvedValue({ data: 3, error: null });

    const req = mockReq();
    const res = mockRes();

    await getAdminDashboard(req as any, res as any);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        activeStudents: 25,
        totalStudents: 25,
        monthlyIncome: 1000,
        pendingPayments: 3,
        attendanceRate: 67,
      })
    );
  });
});

describe('getProfesorDashboard', () => {
  it('returns profesor dashboard with categories and today trainings', async () => {
    mockSupabase._setMockData('category_teachers', {
      data: [
        { category_id: 'cat-1', category: { id: 'cat-1', name: 'U-12', color: '#FF6B6B' } },
        { category_id: 'cat-2', category: { id: 'cat-2', name: 'U-14', color: '#4ECDC4' } },
      ],
      error: null,
    });
    mockSupabase._setMockData('trainings', {
      data: [
        { id: 't1', date: '2026-05-07', start_time: '16:00', type: 'entrenamiento', category: { name: 'U-12' }, venue: { name: 'Campo 1' } },
      ],
      error: null,
    });

    const req = mockReq({ tenant: { school_id: 'school-1', role: 'profesor', user_id: 'user-1' } });
    const res = mockRes();

    await getProfesorDashboard(req as any, res as any);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        categoriesCount: 2,
        todayTrainings: expect.any(Array),
      })
    );
  });
});

describe('getPadreDashboard', () => {
  it('returns parent dashboard with children', async () => {
    mockSupabase._setMockData('students', {
      data: [{ id: 's1', full_name: 'Juanito', category: { name: 'U-12' }, category_id: 'cat-1' }],
      error: null,
    });
    mockSupabase._setMockData('payments', {
      data: [{ student_id: 's1' }],
      error: null,
    });
    mockSupabase._setMockData('trainings', {
      data: [{ id: 't1', date: '2026-05-10', start_time: '16:00', category: { name: 'U-12', color: '#FF6B6B' }, venue: { name: 'Campo 1' } }],
      error: null,
    });

    const req = mockReq({ tenant: { school_id: 'school-1', role: 'padre', user_id: 'parent-1' } });
    const res = mockRes();

    await getPadreDashboard(req as any, res as any);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        children: expect.any(Array),
      })
    );
  });
});

describe('getAlumnoDashboard', () => {
  it('returns alumno dashboard with streak and stats', async () => {
    mockSupabase._setMockData('students', {
      data: { id: 'user-1', full_name: 'Pedro', category_id: 'cat-1', current_streak: 5, max_streak: 12, category: { name: 'U-12', color: '#FF6B6B' } },
      error: null,
    });
    mockSupabase._setMockData('attendances', {
      data: [{ present: true }, { present: true }, { present: false }, { present: true }],
      error: null,
    });
    mockSupabase._setMockData('trainings', { data: [], error: null });
    mockSupabase._setMockData('student_achievements', {
      data: [{ achievement: { name: 'Estrella' } }],
      error: null,
    });

    const req = mockReq({ tenant: { school_id: 'school-1', role: 'alumno', user_id: 'user-1' } });
    const res = mockRes();

    await getAlumnoDashboard(req as any, res as any);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        studentName: 'Pedro',
        currentStreak: 5,
        maxStreak: 12,
        trainingsThisMonth: 4,
        attendedThisMonth: 3,
      })
    );
  });
});
