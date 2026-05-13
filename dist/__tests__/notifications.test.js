"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const helpers_1 = require("./helpers");
const mockSupabase = (0, helpers_1.createMockSupabase)();
jest.mock('../config/supabase', () => ({
    supabaseAdmin: mockSupabase,
}));
const notification_controller_1 = require("../controllers/notification.controller");
beforeEach(() => {
    jest.clearAllMocks();
    mockSupabase._builders.clear();
});
describe('getNotifications', () => {
    it('returns notifications list for authenticated user', async () => {
        const mockNotifications = [
            { id: 'n1', title: 'Pago registrado', body: 'Se registró un pago', type: 'pago_recibido', is_read: false },
            { id: 'n2', title: 'Sesión cancelada', body: 'Se canceló una sesión', type: 'sesion_cancelada', is_read: true },
        ];
        mockSupabase._setMockData('notifications', { data: mockNotifications, error: null });
        const req = (0, helpers_1.mockReq)();
        const res = (0, helpers_1.mockRes)();
        await (0, notification_controller_1.getNotifications)(req, res);
        expect(res.json).toHaveBeenCalledWith(mockNotifications);
    });
});
describe('markAsRead', () => {
    it('marks a notification as read', async () => {
        mockSupabase._setMockData('notifications', { data: null, error: null });
        const req = (0, helpers_1.mockReq)({ params: { id: 'n1' } });
        const res = (0, helpers_1.mockRes)();
        await (0, notification_controller_1.markAsRead)(req, res);
        expect(res.json).toHaveBeenCalledWith({ message: 'Notificación marcada como leída.' });
    });
});
describe('markAllAsRead', () => {
    it('marks all user notifications as read', async () => {
        mockSupabase._setMockData('notifications', { data: null, error: null });
        const req = (0, helpers_1.mockReq)();
        const res = (0, helpers_1.mockRes)();
        await (0, notification_controller_1.markAllAsRead)(req, res);
        expect(res.json).toHaveBeenCalledWith({ message: 'Todas las notificaciones marcadas como leídas.' });
    });
});
