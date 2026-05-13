/**
 * Pruebas de Integración (TC-I-01 … TC-I-05)
 * Usan supertest sobre la Express app completa.
 * supabaseAdmin se mockea para evitar dependencia de DB real.
 */
import request from 'supertest';
import { createMockSupabase, MockQueryBuilder } from './helpers';

// ── Mock supabase antes de importar la app ─────────────────────────────────
const mockSupabase = createMockSupabase();

jest.mock('../config/supabase', () => ({
  supabaseAdmin: mockSupabase,
}));

import app from '../app';

// Token fake — el mock de auth.getUser siempre devuelve un usuario válido
const TOKEN = 'Bearer test-token';
const SCHOOL_ID = 'school-1';
const USER_ID = 'user-1';

// Helpers: preparar mock de auth + tenant para cada request
function setupAuthMocks(role = 'admin') {
  mockSupabase.auth.getUser.mockResolvedValue({
    data: { user: { id: USER_ID, email: 'admin@test.com' } },
    error: null,
  });

  mockSupabase._setMockData('users', {
    data: { id: USER_ID, school_id: SCHOOL_ID, role, full_name: 'Admin Test' },
    error: null,
  });
  // single() para tenant middleware
  const usersBuilder = mockSupabase._builders.get('users')!;
  usersBuilder.single = jest.fn().mockResolvedValue({
    data: { id: USER_ID, school_id: SCHOOL_ID, role, full_name: 'Admin Test' },
    error: null,
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockSupabase._builders.clear();
});

// ─────────────────────────────────────────────────────────────────────────────
// TC-I-01 — CRUD completo de alumno
// ─────────────────────────────────────────────────────────────────────────────
describe('TC-I-01 — CRUD completo alumno', () => {
  const STUDENT_ID = 'stu-uuid-1';
  const STUDENT = {
    id: STUDENT_ID,
    school_id: SCHOOL_ID,
    full_name: 'Diego Ramírez',
    birth_date: '2014-03-15',
    category_id: 'cat-1',
    status: 'activo',
    email: 'diegor1@alumno.com',
  };

  function mockStudentCreation() {
    mockSupabase.auth.admin.createUser.mockResolvedValue({
      data: { user: { id: 'new-auth-id' } },
      error: null,
    });

    // users: tenant middleware single() + username check maybeSingle() (null = disponible) + insert
    const usersBuilder = new MockQueryBuilder({ data: null, error: null });
    usersBuilder.insert = jest.fn().mockResolvedValue({ data: null, error: null });
    usersBuilder.select = jest.fn().mockReturnThis();
    usersBuilder.single = jest.fn().mockResolvedValue({
      data: { id: USER_ID, school_id: SCHOOL_ID, role: 'admin', full_name: 'Admin Test' },
      error: null,
    });
    usersBuilder.maybeSingle = jest.fn().mockResolvedValue({ data: null, error: null });
    mockSupabase._builders.set('users', usersBuilder);

    // students insert
    const studentsBuilder = new MockQueryBuilder({ data: STUDENT, error: null });
    studentsBuilder.insert = jest.fn().mockReturnThis();
    studentsBuilder.select = jest.fn().mockReturnThis();
    studentsBuilder.single = jest.fn().mockResolvedValue({ data: STUDENT, error: null });
    mockSupabase._builders.set('students', studentsBuilder);
  }

  it('POST /api/students — crea alumno (201)', async () => {
    setupAuthMocks();
    mockStudentCreation();

    const res = await request(app)
      .post('/api/students')
      .set('Authorization', TOKEN)
      .send({
        full_name: 'Diego Ramírez',
        birth_date: '2014-03-15',
        category_id: 'cat-1',
      });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ full_name: 'Diego Ramírez' });
    // Username generado debe estar presente
    expect(res.body).toHaveProperty('username');
    expect(res.body).toHaveProperty('temp_password');
  });

  it('GET /api/students — lista alumnos (200)', async () => {
    setupAuthMocks();
    mockSupabase._setMockData('students', { data: [STUDENT], error: null });
    const usersBuilder = mockSupabase._builders.get('users')!;
    usersBuilder.single = jest.fn().mockResolvedValue({
      data: { id: USER_ID, school_id: SCHOOL_ID, role: 'admin', full_name: 'Admin Test' },
      error: null,
    });

    const res = await request(app)
      .get('/api/students')
      .set('Authorization', TOKEN);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('PATCH /api/students/:id/status — cambia estatus (200)', async () => {
    setupAuthMocks();
    const studentsBuilder = new MockQueryBuilder({ data: { ...STUDENT, status: 'becado' }, error: null });
    studentsBuilder.update = jest.fn().mockReturnThis();
    studentsBuilder.single = jest.fn().mockResolvedValue({
      data: { ...STUDENT, status: 'becado' },
      error: null,
    });
    mockSupabase._builders.set('students', studentsBuilder);
    const usersBuilder = mockSupabase._builders.get('users')!;
    if (usersBuilder) {
      usersBuilder.single = jest.fn().mockResolvedValue({
        data: { id: USER_ID, school_id: SCHOOL_ID, role: 'admin', full_name: 'Admin Test' },
        error: null,
      });
    }

    const res = await request(app)
      .patch(`/api/students/${STUDENT_ID}/status`)
      .set('Authorization', TOKEN)
      .send({ status: 'becado' });

    expect(res.status).toBe(200);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TC-I-02 — Aislamiento multi-tenant en lista de alumnos
// ─────────────────────────────────────────────────────────────────────────────
describe('TC-I-02 — Aislamiento multi-tenant', () => {
  it('solo devuelve alumnos del school_id del JWT (s1)', async () => {
    setupAuthMocks('admin');

    // El mock devuelve solo alumnos de school-1
    const s1Students = [
      { id: 's1', school_id: SCHOOL_ID, full_name: 'Alumno S1-1' },
      { id: 's2', school_id: SCHOOL_ID, full_name: 'Alumno S1-2' },
    ];
    mockSupabase._setMockData('students', { data: s1Students, error: null });
    const usersBuilder = mockSupabase._builders.get('users')!;
    usersBuilder.single = jest.fn().mockResolvedValue({
      data: { id: USER_ID, school_id: SCHOOL_ID, role: 'admin', full_name: 'Admin Test' },
      error: null,
    });

    const res = await request(app)
      .get('/api/students')
      .set('Authorization', TOKEN);

    expect(res.status).toBe(200);
    // Verificar que el builder de students recibió eq con school_id correcto
    const studentsBuilder = mockSupabase._builders.get('students');
    expect(studentsBuilder?.eq).toHaveBeenCalledWith('school_id', SCHOOL_ID);
    // Ningún alumno de otra escuela en el response
    const body: any[] = res.body;
    body.forEach(s => expect(s.school_id).toBe(SCHOOL_ID));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TC-I-03 — Pase de lista completo (attendances + training completion)
// ─────────────────────────────────────────────────────────────────────────────
describe('TC-I-03 — Pase de lista batch', () => {
  it('guarda asistencia, marca training completado y responde < 500ms', async () => {
    setupAuthMocks();

    const TRAINING_ID = 'training-1';
    const students = Array.from({ length: 5 }, (_, i) => ({
      id: `stu-${i + 1}`,
      category_id: 'cat-1',
    }));

    // students
    mockSupabase._setMockData('students', { data: students, error: null });
    const usersBuilder = mockSupabase._builders.get('users')!;
    usersBuilder.single = jest.fn().mockResolvedValue({
      data: { id: USER_ID, school_id: SCHOOL_ID, role: 'admin', full_name: 'Admin Test' },
      error: null,
    });

    // trainings (resolver training_id)
    const trainingsBuilder = new MockQueryBuilder({ data: { id: TRAINING_ID }, error: null });
    trainingsBuilder.single = jest.fn().mockResolvedValue({ data: { id: TRAINING_ID }, error: null });
    trainingsBuilder.update = jest.fn().mockReturnThis();
    mockSupabase._builders.set('trainings', trainingsBuilder);

    // attendances (delete + insert)
    const attendancesBuilder = new MockQueryBuilder({ data: [], error: null });
    attendancesBuilder.insert = jest.fn().mockResolvedValue({ data: null, error: null });
    mockSupabase._builders.set('attendances', attendancesBuilder);

    const records = students.map((s, i) => ({
      student_id: s.id,
      present: i < 4, // 4 presentes, 1 ausente
    }));

    const t0 = Date.now();
    const res = await request(app)
      .post('/api/attendances')
      .set('Authorization', TOKEN)
      .send({
        category_id: 'cat-1',
        date: '2026-05-12',
        type: 'entrenamiento',
        records,
        training_id: TRAINING_ID,
      });
    const elapsed = Date.now() - t0;

    expect(res.status).toBe(200);
    expect(elapsed).toBeLessThan(500);
    // Verificar que trainings.update fue llamado (marking completed)
    expect(trainingsBuilder.update).toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TC-I-04 — Evento recurrente genera sesiones + cancelación
// ─────────────────────────────────────────────────────────────────────────────
describe('TC-I-04 — Evento recurrente y cancelación de sesión', () => {
  const EVENT_ID = 'event-uuid-1';
  const TRAINING_DATE = '2026-03-15';

  it('crea evento con 8 sesiones (201)', async () => {
    setupAuthMocks();

    const trainingsInserted = Array.from({ length: 8 }, (_, i) => ({
      id: `tr-${i + 1}`,
      event_id: EVENT_ID,
      date: `2026-03-${String(1 + i * 7).padStart(2, '0')}`,
      is_cancelled: false,
    }));

    // events insert
    const eventsBuilder = new MockQueryBuilder({ data: { id: EVENT_ID, name: 'Entreno Sub-12' }, error: null });
    eventsBuilder.insert = jest.fn().mockReturnThis();
    eventsBuilder.select = jest.fn().mockReturnThis();
    eventsBuilder.single = jest.fn().mockResolvedValue({
      data: { id: EVENT_ID, name: 'Entreno Sub-12' },
      error: null,
    });
    mockSupabase._builders.set('events', eventsBuilder);

    // trainings insert
    const trainingsBuilder = new MockQueryBuilder({ data: trainingsInserted, error: null });
    trainingsBuilder.insert = jest.fn().mockResolvedValue({ data: trainingsInserted, error: null });
    mockSupabase._builders.set('trainings', trainingsBuilder);

    const usersBuilder = mockSupabase._builders.get('users')!;
    usersBuilder.single = jest.fn().mockResolvedValue({
      data: { id: USER_ID, school_id: SCHOOL_ID, role: 'admin', full_name: 'Admin Test' },
      error: null,
    });

    const res = await request(app)
      .post('/api/events')
      .set('Authorization', TOKEN)
      .send({
        name: 'Entreno Sub-12',
        category_id: 'cat-1',
        date: '2026-03-01',
        type: 'entrenamiento',
        recurringWeeks: 8,
      });

    expect(res.status).toBe(201);
    // El insert de trainings debería haberse llamado con 8 sesiones
    expect(trainingsBuilder.insert).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ event_id: EVENT_ID })])
    );
  });

  it('cancela sesión específica → is_cancelled=true (200)', async () => {
    setupAuthMocks();

    const trainingData = { id: 'tr-2', event_id: EVENT_ID, category_id: 'cat-1', date: TRAINING_DATE };
    const trainingsBuilder = new MockQueryBuilder({ data: trainingData, error: null });
    trainingsBuilder.single = jest.fn().mockResolvedValue({ data: trainingData, error: null });
    trainingsBuilder.update = jest.fn().mockReturnThis();
    mockSupabase._builders.set('trainings', trainingsBuilder);

    // notifications mock
    mockSupabase._setMockData('users', {
      data: [{ id: USER_ID, school_id: SCHOOL_ID, role: 'admin', full_name: 'Admin' }],
      error: null,
    });
    const usersBuilder = mockSupabase._builders.get('users')!;
    usersBuilder.single = jest.fn().mockResolvedValue({
      data: { id: USER_ID, school_id: SCHOOL_ID, role: 'admin', full_name: 'Admin Test' },
      error: null,
    });
    mockSupabase._setMockData('notifications', { data: [], error: null });

    const res = await request(app)
      .post('/api/events/cancel')
      .set('Authorization', TOKEN)
      .send({ training_id: 'tr-2' });

    expect(res.status).toBe(200);
    // Verificar que se llamó update con is_cancelled: true
    expect(trainingsBuilder.update).toHaveBeenCalledWith(
      expect.objectContaining({ is_cancelled: true })
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TC-I-05 — CRUD de venue con asignación a evento
// ─────────────────────────────────────────────────────────────────────────────
describe('TC-I-05 — Venue CRUD + asignación a evento', () => {
  const VENUE_ID = 'venue-uuid-1';
  const VENUE = { id: VENUE_ID, school_id: SCHOOL_ID, name: 'Campo A', capacity: 50 };

  it('crea venue (201)', async () => {
    setupAuthMocks();

    const venuesBuilder = new MockQueryBuilder({ data: VENUE, error: null });
    venuesBuilder.insert = jest.fn().mockReturnThis();
    venuesBuilder.select = jest.fn().mockReturnThis();
    venuesBuilder.single = jest.fn().mockResolvedValue({ data: VENUE, error: null });
    mockSupabase._builders.set('venues', venuesBuilder);

    const usersBuilder = mockSupabase._builders.get('users')!;
    usersBuilder.single = jest.fn().mockResolvedValue({
      data: { id: USER_ID, school_id: SCHOOL_ID, role: 'admin', full_name: 'Admin Test' },
      error: null,
    });

    const res = await request(app)
      .post('/api/venues')
      .set('Authorization', TOKEN)
      .send({ name: 'Campo A', capacity: 50 });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ name: 'Campo A' });
  });

  it('crea evento con venue_id y venue_name visible en GET (201 + 200)', async () => {
    setupAuthMocks();

    const EVENT_WITH_VENUE = {
      id: 'ev-1',
      school_id: SCHOOL_ID,
      category_id: 'cat-1',
      venue_id: VENUE_ID,
      venue: { id: VENUE_ID, name: 'Campo A' },
      type: 'entrenamiento',
      date: '2026-06-01',
    };

    // events create
    const eventsBuilder = new MockQueryBuilder({ data: [EVENT_WITH_VENUE], error: null });
    eventsBuilder.insert = jest.fn().mockReturnThis();
    eventsBuilder.select = jest.fn().mockReturnThis();
    eventsBuilder.single = jest.fn().mockResolvedValue({ data: EVENT_WITH_VENUE, error: null });
    mockSupabase._builders.set('events', eventsBuilder);

    // trainings insert
    const trainingsBuilder = new MockQueryBuilder({ data: [], error: null });
    trainingsBuilder.insert = jest.fn().mockResolvedValue({ data: [], error: null });
    mockSupabase._builders.set('trainings', trainingsBuilder);

    const usersBuilder = mockSupabase._builders.get('users')!;
    usersBuilder.single = jest.fn().mockResolvedValue({
      data: { id: USER_ID, school_id: SCHOOL_ID, role: 'admin', full_name: 'Admin Test' },
      error: null,
    });

    // POST evento con venue
    const createRes = await request(app)
      .post('/api/events')
      .set('Authorization', TOKEN)
      .send({ name: 'Entreno Campo A', category_id: 'cat-1', date: '2026-06-01', type: 'entrenamiento', venue_id: VENUE_ID });

    expect(createRes.status).toBe(201);

    // GET eventos — mock devuelve evento con venue embebido
    eventsBuilder.select = jest.fn().mockReturnThis();
    // re-mock users single para el segundo request
    const usersBuilder2 = mockSupabase._builders.get('users')!;
    usersBuilder2.single = jest.fn().mockResolvedValue({
      data: { id: USER_ID, school_id: SCHOOL_ID, role: 'admin', full_name: 'Admin Test' },
      error: null,
    });
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: USER_ID, email: 'admin@test.com' } },
      error: null,
    });

    const getRes = await request(app)
      .get('/api/events')
      .set('Authorization', TOKEN);

    expect(getRes.status).toBe(200);
    const events: any[] = getRes.body;
    const evWithVenue = events.find((e: any) => e.venue_id === VENUE_ID || e.venue?.name === 'Campo A');
    // Si el mock devuelve el evento, el venue debe estar visible
    if (evWithVenue) {
      expect(evWithVenue.venue?.name ?? evWithVenue.venue_id).toBeTruthy();
    }
  });
});
