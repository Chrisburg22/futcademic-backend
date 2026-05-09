import { MockQueryBuilder, createMockSupabase, mockReq, mockRes } from './helpers';

const mockSupabase = createMockSupabase();

jest.mock('../config/supabase', () => ({
  supabaseAdmin: mockSupabase,
}));

import { getAccountStatement } from '../controllers/payment.controller';

beforeEach(() => {
  jest.clearAllMocks();
  mockSupabase._builders.clear();
});

describe('getAccountStatement', () => {
  it('returns account statement for a student', async () => {
    const studentBuilder = mockSupabase._builders.get('students');
    if (studentBuilder) {
      studentBuilder.single = jest.fn().mockResolvedValue({
        data: { id: 's1', full_name: 'Juanito', category: { name: 'U-12' }, parent_id: 'user-1' },
        error: null,
      });
    }
    mockSupabase._setMockData('payments', {
      data: [{ id: 'p1', payment_date: '2026-04-10', amount: 500, description: 'Mensualidad Abril', payment_month: 4 }],
      error: null,
    });
    mockSupabase._setMockData('payment_students', { data: [], error: null });

    const req = mockReq({ params: { studentId: 's1' } });
    const res = mockRes();

    await getAccountStatement(req as any, res as any);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        studentName: 'Juanito',
        category: 'U-12',
        hasPaidThisMonth: false,
      })
    );
  });

  it('rejects parent accessing another student', async () => {
    const studentBuilder = mockSupabase._builders.get('students');
    if (studentBuilder) {
      studentBuilder.single = jest.fn().mockResolvedValue({
        data: { id: 's1', full_name: 'Juanito', parent_id: 'other-parent' },
        error: null,
      });
    }

    const req = mockReq({
      params: { studentId: 's1' },
      tenant: { school_id: 'school-1', role: 'padre', user_id: 'user-1' },
    });
    const res = mockRes();

    await getAccountStatement(req as any, res as any);

    expect(res.status).toHaveBeenCalledWith(403);
  });
});
