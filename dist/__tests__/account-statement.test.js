"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const helpers_1 = require("./helpers");
const mockSupabase = (0, helpers_1.createMockSupabase)();
jest.mock('../config/supabase', () => ({
    supabaseAdmin: mockSupabase,
}));
const payment_controller_1 = require("../controllers/payment.controller");
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
        const req = (0, helpers_1.mockReq)({ params: { studentId: 's1' } });
        const res = (0, helpers_1.mockRes)();
        await (0, payment_controller_1.getAccountStatement)(req, res);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            studentName: 'Juanito',
            category: 'U-12',
            hasPaidThisMonth: false,
        }));
    });
    it('rejects parent accessing another student', async () => {
        const studentBuilder = mockSupabase._builders.get('students');
        if (studentBuilder) {
            studentBuilder.single = jest.fn().mockResolvedValue({
                data: { id: 's1', full_name: 'Juanito', parent_id: 'other-parent' },
                error: null,
            });
        }
        const req = (0, helpers_1.mockReq)({
            params: { studentId: 's1' },
            tenant: { school_id: 'school-1', role: 'padre', user_id: 'user-1' },
        });
        const res = (0, helpers_1.mockRes)();
        await (0, payment_controller_1.getAccountStatement)(req, res);
        expect(res.status).toHaveBeenCalledWith(403);
    });
});
