import { MockQueryBuilder, createMockSupabase, mockReq, mockRes } from './helpers';

const mockSupabase = createMockSupabase();

jest.mock('../config/supabase', () => ({
  supabaseAdmin: mockSupabase,
}));

import { exportPayments, exportAttendance } from '../controllers/export.controller';

beforeEach(() => {
  jest.clearAllMocks();
  mockSupabase._builders.clear();
});

describe('exportPayments', () => {
  it('returns CSV file with payments data', async () => {
    mockSupabase._setMockData('payments', {
      data: [
        { payment_date: '2026-05-01', payment_type: 'mensualidad', amount: 500, description: 'Mensualidad Mayo', student: { full_name: 'Juanito' }, teacher: null },
        { payment_date: '2026-05-05', payment_type: 'mensualidad', amount: 300, description: 'Pago parcial', student: { full_name: 'Pedro' }, teacher: null },
      ],
      error: null,
    });

    const req = mockReq({ query: { month: '5' } });
    const res = mockRes();

    await exportPayments(req as any, res as any);

    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/csv; charset=utf-8');
    expect(res.setHeader).toHaveBeenCalledWith(
      'Content-Disposition',
      expect.stringContaining('attachment; filename=')
    );
    expect(res.send).toHaveBeenCalledWith(expect.stringContaining('Juanito'));
  });
});

describe('exportAttendance', () => {
  it('returns CSV file with attendance data', async () => {
    mockSupabase._setMockData('attendances', {
      data: [
        { date: '2026-05-01', present: true, student: { full_name: 'Juanito', category: { name: 'U-12' } } },
        { date: '2026-05-01', present: false, student: { full_name: 'Pedro', category: { name: 'U-12' } } },
      ],
      error: null,
    });

    const req = mockReq({ query: { month: '5', category_id: 'cat-1' } });
    const res = mockRes();

    await exportAttendance(req as any, res as any);

    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/csv; charset=utf-8');
    expect(res.send).toHaveBeenCalledWith(expect.stringContaining('Juanito'));
  });
});
