import { MockQueryBuilder, createMockSupabase, mockReq, mockRes } from './helpers';

const mockSupabase = createMockSupabase();

jest.mock('../config/supabase', () => ({
  supabaseAdmin: mockSupabase,
}));

import { getNotifications, markAsRead, markAllAsRead } from '../controllers/notification.controller';

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

    const req = mockReq();
    const res = mockRes();

    await getNotifications(req as any, res as any);

    expect(res.json).toHaveBeenCalledWith(mockNotifications);
  });
});

describe('markAsRead', () => {
  it('marks a notification as read', async () => {
    mockSupabase._setMockData('notifications', { data: null, error: null });

    const req = mockReq({ params: { id: 'n1' } });
    const res = mockRes();

    await markAsRead(req as any, res as any);

    expect(res.json).toHaveBeenCalledWith({ message: 'Notificación marcada como leída.' });
  });
});

describe('markAllAsRead', () => {
  it('marks all user notifications as read', async () => {
    mockSupabase._setMockData('notifications', { data: null, error: null });

    const req = mockReq();
    const res = mockRes();

    await markAllAsRead(req as any, res as any);

    expect(res.json).toHaveBeenCalledWith({ message: 'Todas las notificaciones marcadas como leídas.' });
  });
});
