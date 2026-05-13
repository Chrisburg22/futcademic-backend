/**
 * Pruebas Modulares (TC-M-01 … TC-M-05)
 * Cada test aísla un solo controller/middleware y mockea supabaseAdmin.
 */
import { MockQueryBuilder, createMockSupabase, mockReq, mockRes } from './helpers';

// ── Mock global de supabase ────────────────────────────────────────────────────
const mockSupabase = createMockSupabase();

jest.mock('../config/supabase', () => ({
  supabaseAdmin: mockSupabase,
}));

// Importar después del mock
import { requireAuth } from '../middlewares/auth.middleware';
import { createStudent } from '../controllers/student.controller';
import { saveAttendances } from '../controllers/attendance.controller';
import { cancelInstance } from '../controllers/event.controller';
import { createCategory } from '../controllers/category.controller';

beforeEach(() => {
  jest.clearAllMocks();
  mockSupabase._builders.clear();
});

// ─────────────────────────────────────────────────────────────────────────────
// TC-M-01 — getStudents rechaza sin autenticación
// Módulo: auth.middleware.ts
// ─────────────────────────────────────────────────────────────────────────────
describe('TC-M-01 — requireAuth sin token', () => {
  it('devuelve 401 cuando no hay header Authorization', async () => {
    const req = mockReq({ headers: {} });
    const res = mockRes();
    const next = jest.fn();

    await requireAuth(req as any, res as any, next as any);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'Token de autorización faltante o inválido.' })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('devuelve 401 cuando Authorization no empieza con Bearer', async () => {
    const req = mockReq({ headers: { authorization: 'Basic abc123' } });
    const res = mockRes();
    const next = jest.fn();

    await requireAuth(req as any, res as any, next as any);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TC-M-02 — createStudent rechaza payload sin full_name
// Módulo: student.controller.ts::createStudent
// ─────────────────────────────────────────────────────────────────────────────
describe('TC-M-02 — createStudent sin full_name', () => {
  it('devuelve 400 cuando falta full_name', async () => {
    const req = mockReq({
      body: { category_id: 'c1', birth_date: '2014-01-01', email: 'x@y.com' },
    });
    const res = mockRes();

    await createStudent(req as any, res as any);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.any(String) }));
  });

  it('devuelve 400 cuando falta category_id', async () => {
    const req = mockReq({
      body: { full_name: 'Juan', birth_date: '2014-01-01', email: 'x@y.com' },
    });
    const res = mockRes();

    await createStudent(req as any, res as any);

    expect(res.status).toHaveBeenCalledWith(400);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TC-M-03 — saveAttendances evita duplicados (delete+insert = upsert manual)
// Módulo: attendance.controller.ts::saveAttendances
// ─────────────────────────────────────────────────────────────────────────────
describe('TC-M-03 — saveAttendances maneja registros duplicados', () => {
  it('devuelve 200 cuando el upsert manual elimina e inserta sin error', async () => {
    // Mock students: devuelve 1 alumno válido
    mockSupabase._setMockData('students', {
      data: [{ id: 'stu-1', category_id: 'cat-1' }],
      error: null,
    });

    // Mock trainings (single para resolver training_id) → null (no training vinculado)
    const trainingsBuilder = new MockQueryBuilder({ data: null, error: null });
    trainingsBuilder.single = jest.fn().mockResolvedValue({ data: null, error: null });
    mockSupabase._builders.set('trainings', trainingsBuilder);

    // Mock attendances: delete (via then) → { error: null }, insert → { error: null }
    const attendancesBuilder = new MockQueryBuilder({ data: [], error: null });
    attendancesBuilder.insert = jest.fn().mockResolvedValue({ data: null, error: null });
    mockSupabase._builders.set('attendances', attendancesBuilder);

    const req = mockReq({
      body: {
        category_id: 'cat-1',
        date: '2026-05-12',
        type: 'entrenamiento',
        records: [{ student_id: 'stu-1', present: true }],
        training_id: null,
      },
    });
    const res = mockRes();

    await saveAttendances(req as any, res as any);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining('exitosamente') })
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TC-M-04 — cancelInstance sin training_id ni event_id+date
// Módulo: event.controller.ts::cancelInstance
// ─────────────────────────────────────────────────────────────────────────────
describe('TC-M-04 — cancelInstance con body vacío', () => {
  it('devuelve 400 con mensaje descriptivo', async () => {
    const req = mockReq({ body: {} });
    const res = mockRes();

    await cancelInstance(req as any, res as any);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.stringMatching(/training_id|event_id/i),
      })
    );
  });

  it('devuelve 400 cuando solo se envía event_id sin date', async () => {
    const req = mockReq({ body: { event_id: 'ev-1' } });
    const res = mockRes();

    await cancelInstance(req as any, res as any);

    expect(res.status).toHaveBeenCalledWith(400);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TC-M-05 — createCategory rechaza duplicado de birth_year (UNIQUE 23505)
// Módulo: category.controller.ts::createCategory
// ─────────────────────────────────────────────────────────────────────────────
describe('TC-M-05 — createCategory rechaza UNIQUE violation', () => {
  it('devuelve 400 cuando la DB retorna error de clave duplicada (23505)', async () => {
    // Simular que insert falla con código 23505
    const categoriesBuilder = new MockQueryBuilder({ data: null, error: null });
    categoriesBuilder.insert = jest.fn().mockReturnThis();
    categoriesBuilder.select = jest.fn().mockReturnThis();
    categoriesBuilder.single = jest
      .fn()
      .mockResolvedValue({ data: null, error: { code: '23505', message: 'duplicate key value' } });
    mockSupabase._builders.set('categories', categoriesBuilder);

    const req = mockReq({
      body: { name: 'Sub-12', birth_year: 2014 },
    });
    const res = mockRes();

    await createCategory(req as any, res as any);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.any(String) }));
  });

  it('devuelve 400 ante cualquier error de DB en insert', async () => {
    const categoriesBuilder = new MockQueryBuilder({ data: null, error: null });
    categoriesBuilder.insert = jest.fn().mockReturnThis();
    categoriesBuilder.select = jest.fn().mockReturnThis();
    categoriesBuilder.single = jest
      .fn()
      .mockResolvedValue({ data: null, error: { code: '42501', message: 'permission denied' } });
    mockSupabase._builders.set('categories', categoriesBuilder);

    const req = mockReq({
      body: { name: 'Sub-14', birth_year: 2012 },
    });
    const res = mockRes();

    await createCategory(req as any, res as any);

    expect(res.status).toHaveBeenCalledWith(400);
  });
});
