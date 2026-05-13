"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const helpers_1 = require("./helpers");
const mockSupabase = (0, helpers_1.createMockSupabase)();
jest.mock('../config/supabase', () => ({
    supabaseAdmin: mockSupabase,
}));
const export_controller_1 = require("../controllers/export.controller");
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
        const req = (0, helpers_1.mockReq)({ query: { month: '5' } });
        const res = (0, helpers_1.mockRes)();
        await (0, export_controller_1.exportPayments)(req, res);
        expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/csv; charset=utf-8');
        expect(res.setHeader).toHaveBeenCalledWith('Content-Disposition', expect.stringContaining('attachment; filename='));
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
        const req = (0, helpers_1.mockReq)({ query: { month: '5', category_id: 'cat-1' } });
        const res = (0, helpers_1.mockRes)();
        await (0, export_controller_1.exportAttendance)(req, res);
        expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/csv; charset=utf-8');
        expect(res.send).toHaveBeenCalledWith(expect.stringContaining('Juanito'));
    });
});
