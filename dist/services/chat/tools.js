"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SENSITIVE_TOOLS = exports.CHAT_TOOLS = void 0;
exports.toolRoute = toolRoute;
exports.toolLabel = toolLabel;
const str = (description) => ({ type: 'string', description });
const num = (description) => ({ type: 'number', description });
const bool = (description) => ({ type: 'boolean', description });
// Extrae del input solo las claves indicadas que no sean undefined
const pick = (input, keys) => {
    const out = {};
    for (const k of keys) {
        if (input[k] !== undefined && input[k] !== null)
            out[k] = input[k];
    }
    return out;
};
const queryOf = (input, keys) => {
    const out = {};
    for (const k of keys) {
        if (input[k] !== undefined && input[k] !== null)
            out[k] = String(input[k]);
    }
    return out;
};
const TOOL_DEFS = [
    // ------------------------------------------------------------------ consulta
    {
        tool: {
            name: 'get_admin_dashboard',
            description: 'Obtiene el resumen general de la academia: alumnos activos/totales, ingresos del mes, pagos pendientes, próximos eventos y tasa de asistencia. Úsala para preguntas generales tipo "¿cómo va la academia?".',
            input_schema: { type: 'object', properties: {}, required: [] },
        },
        label: () => 'Consultando resumen de la academia',
        route: () => ({ method: 'GET', path: '/dashboard/admin' }),
    },
    {
        tool: {
            name: 'list_students',
            description: 'Lista los alumnos de la academia, con su categoría y padre vinculado. Úsala para buscar alumnos por nombre (filtra tú sobre el resultado) o para obtener sus UUID antes de otras operaciones.',
            input_schema: {
                type: 'object',
                properties: { category_id: str('UUID de categoría para filtrar (opcional)') },
                required: [],
            },
        },
        label: () => 'Consultando alumnos',
        route: (input) => ({ method: 'GET', path: '/students', query: queryOf(input, ['category_id']) }),
    },
    {
        tool: {
            name: 'get_student',
            description: 'Obtiene el detalle completo de un alumno por su UUID (datos personales, contacto, notas médicas).',
            input_schema: {
                type: 'object',
                properties: { student_id: str('UUID del alumno (obtener con list_students)') },
                required: ['student_id'],
            },
        },
        label: () => 'Consultando detalle de alumno',
        route: (input) => ({ method: 'GET', path: `/students/${input.student_id}` }),
    },
    {
        tool: {
            name: 'get_student_stats',
            description: 'Estadísticas de un alumno: racha de asistencia, entrenamientos del mes, logros desbloqueados.',
            input_schema: {
                type: 'object',
                properties: { student_id: str('UUID del alumno') },
                required: ['student_id'],
            },
        },
        label: () => 'Consultando estadísticas de alumno',
        route: (input) => ({ method: 'GET', path: `/students/${input.student_id}/stats` }),
    },
    {
        tool: {
            name: 'list_categories',
            description: 'Lista las categorías (equipos) de la academia con año de nacimiento, mensualidad y profesores asignados. Úsala siempre que necesites un category_id.',
            input_schema: { type: 'object', properties: {}, required: [] },
        },
        label: () => 'Consultando categorías',
        route: () => ({ method: 'GET', path: '/categories' }),
    },
    {
        tool: {
            name: 'list_events',
            description: 'Lista los eventos de la academia (entrenamientos recurrentes, partidos, torneos) con su categoría y sede.',
            input_schema: {
                type: 'object',
                properties: { category_id: str('UUID de categoría para filtrar (opcional)') },
                required: [],
            },
        },
        label: () => 'Consultando eventos',
        route: (input) => ({ method: 'GET', path: '/events', query: queryOf(input, ['category_id']) }),
    },
    {
        tool: {
            name: 'get_trainings_for_day',
            description: 'Lista los entrenamientos programados para una fecha concreta.',
            input_schema: {
                type: 'object',
                properties: {
                    date: str('Fecha YYYY-MM-DD (obligatoria)'),
                    category_id: str('UUID de categoría para filtrar (opcional)'),
                },
                required: ['date'],
            },
        },
        label: (i) => `Consultando entrenamientos del ${i.date}`,
        route: (input) => ({ method: 'GET', path: '/events/trainings', query: queryOf(input, ['date', 'category_id']) }),
    },
    {
        tool: {
            name: 'list_payments',
            description: 'Lista los pagos registrados (de alumnos y a profesores).',
            input_schema: {
                type: 'object',
                properties: {
                    type: str("Tipo de pago para filtrar, ej. 'pago_profesor' (opcional)"),
                    month: str('Mes YYYY-MM para filtrar (opcional)'),
                },
                required: [],
            },
        },
        label: () => 'Consultando pagos',
        route: (input) => ({ method: 'GET', path: '/payments', query: queryOf(input, ['type', 'month']) }),
    },
    {
        tool: {
            name: 'get_pending_payments',
            description: 'Lista los alumnos con mensualidad pendiente de pago en un mes. Úsala para "¿quién debe?", "morosos", "pagos pendientes".',
            input_schema: {
                type: 'object',
                properties: {
                    month: num('Mes 1-12 (opcional, por defecto el actual)'),
                    year: num('Año, ej. 2026 (opcional, por defecto el actual)'),
                },
                required: [],
            },
        },
        label: () => 'Consultando pagos pendientes',
        route: (input) => ({ method: 'GET', path: '/payments/pending', query: queryOf(input, ['month', 'year']) }),
    },
    {
        tool: {
            name: 'get_student_account_statement',
            description: 'Estado de cuenta de un alumno: mensualidad, saldo pendiente, historial de movimientos.',
            input_schema: {
                type: 'object',
                properties: { student_id: str('UUID del alumno') },
                required: ['student_id'],
            },
        },
        label: () => 'Consultando estado de cuenta',
        route: (input) => ({ method: 'GET', path: `/payments/account-statement/${input.student_id}` }),
    },
    {
        tool: {
            name: 'list_users',
            description: 'Lista los usuarios de la academia (profesores, padres, admins, alumnos-usuario). Úsala para obtener UUIDs de profesores o padres.',
            input_schema: {
                type: 'object',
                properties: { role: str("Filtrar por rol: 'profesor' | 'padre' | 'admin' | 'alumno' (opcional)") },
                required: [],
            },
        },
        label: () => 'Consultando usuarios',
        route: (input) => ({ method: 'GET', path: '/users', query: queryOf(input, ['role']) }),
    },
    {
        tool: {
            name: 'list_venues',
            description: 'Lista las sedes/canchas de la academia. Úsala para obtener venue_id.',
            input_schema: { type: 'object', properties: {}, required: [] },
        },
        label: () => 'Consultando sedes',
        route: () => ({ method: 'GET', path: '/venues' }),
    },
    {
        tool: {
            name: 'get_attendances_by_category',
            description: 'Lista las asistencias registradas de una categoría, opcionalmente en una fecha.',
            input_schema: {
                type: 'object',
                properties: {
                    category_id: str('UUID de la categoría'),
                    date: str('Fecha YYYY-MM-DD (opcional)'),
                },
                required: ['category_id'],
            },
        },
        label: () => 'Consultando asistencias',
        route: (input) => ({
            method: 'GET',
            path: `/attendances/category/${input.category_id}`,
            query: queryOf(input, ['date']),
        }),
    },
    // ----------------------------------------------------------- escritura directa
    {
        tool: {
            name: 'create_student',
            description: 'Crea un alumno nuevo en la academia. Si no conoces el category_id, usa list_categories primero. Devuelve también el username y contraseña temporal generados.',
            input_schema: {
                type: 'object',
                properties: {
                    full_name: str('Nombre completo del alumno'),
                    birth_date: str('Fecha de nacimiento YYYY-MM-DD'),
                    category_id: str('UUID de la categoría (obtener con list_categories)'),
                    parent_id: str('UUID del padre vinculado (opcional)'),
                },
                required: ['full_name', 'birth_date', 'category_id'],
            },
        },
        label: (i) => `Creando alumno "${i.full_name}"`,
        route: (input) => ({
            method: 'POST',
            path: '/students',
            body: pick(input, ['full_name', 'birth_date', 'category_id', 'parent_id']),
        }),
    },
    {
        tool: {
            name: 'update_student',
            description: 'Actualiza datos de un alumno existente (nombre, fecha de nacimiento, categoría, teléfono, dirección, contacto de emergencia, notas médicas). Solo envía los campos a cambiar.',
            input_schema: {
                type: 'object',
                properties: {
                    student_id: str('UUID del alumno'),
                    full_name: str('Nombre completo (opcional)'),
                    birth_date: str('Fecha de nacimiento YYYY-MM-DD (opcional)'),
                    category_id: str('UUID de nueva categoría (opcional)'),
                    parent_id: str('UUID del padre (opcional)'),
                    phone: str('Teléfono (opcional)'),
                    address: str('Dirección (opcional)'),
                    emergency_contact_name: str('Nombre del contacto de emergencia (opcional)'),
                    emergency_contact_phone: str('Teléfono del contacto de emergencia (opcional)'),
                    medical_notes: str('Notas médicas (opcional)'),
                },
                required: ['student_id'],
            },
        },
        label: () => 'Actualizando alumno',
        route: (input) => ({
            method: 'PUT',
            path: `/students/${input.student_id}`,
            body: pick(input, [
                'full_name',
                'birth_date',
                'category_id',
                'parent_id',
                'phone',
                'address',
                'emergency_contact_name',
                'emergency_contact_phone',
                'medical_notes',
            ]),
        }),
    },
    {
        tool: {
            name: 'update_student_status',
            description: "Cambia el estado de un alumno: 'activo', 'pendiente_pago', 'inactivo' o 'becado'.",
            input_schema: {
                type: 'object',
                properties: {
                    student_id: str('UUID del alumno'),
                    status: {
                        type: 'string',
                        enum: ['activo', 'pendiente_pago', 'inactivo', 'becado'],
                        description: 'Nuevo estado',
                    },
                },
                required: ['student_id', 'status'],
            },
        },
        label: (i) => `Cambiando estado del alumno a "${i.status}"`,
        route: (input) => ({
            method: 'PATCH',
            path: `/students/${input.student_id}/status`,
            body: { status: input.status },
        }),
    },
    {
        tool: {
            name: 'create_category',
            description: 'Crea una categoría (equipo) nueva, sin horario de entrenamiento.',
            input_schema: {
                type: 'object',
                properties: {
                    name: str("Nombre de la categoría, ej. 'Sub-10'"),
                    birth_year: num('Año de nacimiento de la categoría, ej. 2015'),
                    color: str('Color hex (opcional)'),
                    monthly_fee: num('Mensualidad (opcional)'),
                    teacher_ids: { type: 'array', items: { type: 'string' }, description: 'UUIDs de profesores asignados (opcional)' },
                },
                required: ['name', 'birth_year'],
            },
        },
        label: (i) => `Creando categoría "${i.name}"`,
        route: (input) => ({
            method: 'POST',
            path: '/categories',
            body: pick(input, ['name', 'birth_year', 'color', 'monthly_fee', 'teacher_ids']),
        }),
    },
    {
        tool: {
            name: 'create_full_category',
            description: 'Crea una categoría completa CON horario de entrenamiento recurrente (días, hora, sede) y genera los entrenamientos. Prefierela sobre create_category cuando el admin indique horario.',
            input_schema: {
                type: 'object',
                properties: {
                    name: str('Nombre de la categoría'),
                    birth_year: num('Año de nacimiento'),
                    color: str('Color hex (opcional)'),
                    monthly_fee: num('Mensualidad (opcional)'),
                    teacher_ids: { type: 'array', items: { type: 'string' }, description: 'UUIDs de profesores (opcional)' },
                    days: {
                        type: 'array',
                        items: { type: 'string' },
                        description: "Días de entrenamiento en inglés minúsculas: 'monday'...'sunday'",
                    },
                    start_time: str('Hora de inicio HH:MM (24h)'),
                    venue_id: str('UUID de la sede (obtener con list_venues, opcional)'),
                    duration_minutes: num('Duración en minutos (opcional)'),
                    recurrence_weeks: num('Semanas a generar (opcional)'),
                },
                required: ['name', 'birth_year'],
            },
        },
        label: (i) => `Creando categoría "${i.name}" con horario`,
        route: (input) => ({
            method: 'POST',
            path: '/categories/full',
            body: pick(input, [
                'name',
                'birth_year',
                'color',
                'monthly_fee',
                'teacher_ids',
                'days',
                'start_time',
                'venue_id',
                'duration_minutes',
                'recurrence_weeks',
            ]),
        }),
    },
    {
        tool: {
            name: 'update_category',
            description: 'Actualiza una categoría existente (nombre, año, color, mensualidad, profesores). Solo envía los campos a cambiar.',
            input_schema: {
                type: 'object',
                properties: {
                    category_id: str('UUID de la categoría'),
                    name: str('Nuevo nombre (opcional)'),
                    birth_year: num('Nuevo año (opcional)'),
                    color: str('Nuevo color (opcional)'),
                    monthly_fee: num('Nueva mensualidad (opcional)'),
                    teacher_ids: { type: 'array', items: { type: 'string' }, description: 'UUIDs de profesores; reemplaza las asignaciones (opcional)' },
                },
                required: ['category_id'],
            },
        },
        label: () => 'Actualizando categoría',
        route: (input) => ({
            method: 'PATCH',
            path: `/categories/${input.category_id}`,
            body: pick(input, ['name', 'birth_year', 'color', 'monthly_fee', 'teacher_ids']),
        }),
    },
    {
        tool: {
            name: 'create_event',
            description: 'Crea un evento (entrenamiento, partido, torneo) para una categoría. Puede ser recurrente semanal con recurringWeeks.',
            input_schema: {
                type: 'object',
                properties: {
                    name: str('Nombre del evento'),
                    category_id: str('UUID de la categoría'),
                    date: str('Fecha YYYY-MM-DD'),
                    type: str("Tipo: 'entrenamiento' | 'partido' | 'torneo'"),
                    start_time: str('Hora inicio HH:MM (opcional)'),
                    end_time: str('Hora fin HH:MM (opcional)'),
                    description: str('Descripción (opcional)'),
                    recurringWeeks: num('Semanas de recurrencia (opcional)'),
                    venue_id: str('UUID de la sede (opcional)'),
                },
                required: ['name', 'category_id', 'date', 'type'],
            },
        },
        label: (i) => `Creando evento "${i.name}"`,
        route: (input) => ({
            method: 'POST',
            path: '/events',
            body: pick(input, [
                'name',
                'category_id',
                'date',
                'type',
                'start_time',
                'end_time',
                'description',
                'recurringWeeks',
                'venue_id',
            ]),
        }),
    },
    {
        tool: {
            name: 'update_event',
            description: 'Actualiza un evento existente. Solo envía los campos a cambiar.',
            input_schema: {
                type: 'object',
                properties: {
                    event_id: str('UUID del evento'),
                    name: str('Nuevo nombre (opcional)'),
                    category_id: str('UUID de categoría (opcional)'),
                    description: str('Descripción (opcional)'),
                    venue_id: str('UUID de sede (opcional)'),
                    start_time: str('Hora inicio HH:MM (opcional)'),
                    end_time: str('Hora fin HH:MM (opcional)'),
                },
                required: ['event_id'],
            },
        },
        label: () => 'Actualizando evento',
        route: (input) => ({
            method: 'PUT',
            path: `/events/${input.event_id}`,
            body: pick(input, ['name', 'category_id', 'description', 'venue_id', 'start_time', 'end_time']),
        }),
    },
    {
        tool: {
            name: 'cancel_training',
            description: 'Cancela UNA sesión de entrenamiento concreta (no borra el evento). Pasa training_id, o event_id + date.',
            input_schema: {
                type: 'object',
                properties: {
                    training_id: str('UUID del entrenamiento (opcional si pasas event_id + date)'),
                    event_id: str('UUID del evento maestro (opcional)'),
                    date: str('Fecha YYYY-MM-DD de la sesión (junto con event_id)'),
                },
                required: [],
            },
        },
        label: () => 'Cancelando entrenamiento',
        route: (input) => ({
            method: 'POST',
            path: '/events/cancel',
            body: pick(input, ['training_id', 'event_id', 'date']),
        }),
    },
    {
        tool: {
            name: 'save_attendances',
            description: 'Registra la asistencia de una categoría en una fecha. records es la lista completa de alumnos con present true/false (reemplaza lo previo de ese día).',
            input_schema: {
                type: 'object',
                properties: {
                    category_id: str('UUID de la categoría'),
                    date: str('Fecha YYYY-MM-DD'),
                    type: str("Tipo, normalmente 'entrenamiento'"),
                    records: {
                        type: 'array',
                        description: 'Lista de asistencia por alumno',
                        items: {
                            type: 'object',
                            properties: {
                                student_id: { type: 'string', description: 'UUID del alumno' },
                                present: { type: 'boolean', description: 'true si asistió' },
                            },
                            required: ['student_id', 'present'],
                        },
                    },
                    training_id: str('UUID del entrenamiento (opcional)'),
                },
                required: ['category_id', 'date', 'type', 'records'],
            },
        },
        label: () => 'Registrando asistencias',
        route: (input) => ({
            method: 'POST',
            path: '/attendances',
            body: pick(input, ['category_id', 'date', 'type', 'records', 'training_id']),
        }),
    },
    {
        tool: {
            name: 'create_venue',
            description: 'Crea una sede/cancha nueva.',
            input_schema: {
                type: 'object',
                properties: {
                    name: str('Nombre de la sede'),
                    address: str('Dirección (opcional)'),
                    notes: str('Notas (opcional)'),
                    surface_type: str('Tipo de superficie (opcional)'),
                    capacity: num('Capacidad (opcional)'),
                    has_lighting: bool('Tiene iluminación (opcional)'),
                    is_covered: bool('Es techada (opcional)'),
                },
                required: ['name'],
            },
        },
        label: (i) => `Creando sede "${i.name}"`,
        route: (input) => ({
            method: 'POST',
            path: '/venues',
            body: pick(input, ['name', 'address', 'notes', 'surface_type', 'capacity', 'has_lighting', 'is_covered']),
        }),
    },
    {
        tool: {
            name: 'update_venue',
            description: 'Actualiza una sede existente. Solo envía los campos a cambiar.',
            input_schema: {
                type: 'object',
                properties: {
                    venue_id: str('UUID de la sede'),
                    name: str('Nuevo nombre (opcional)'),
                    address: str('Dirección (opcional)'),
                    notes: str('Notas (opcional)'),
                    surface_type: str('Superficie (opcional)'),
                    capacity: num('Capacidad (opcional)'),
                    has_lighting: bool('Iluminación (opcional)'),
                    is_covered: bool('Techada (opcional)'),
                },
                required: ['venue_id'],
            },
        },
        label: () => 'Actualizando sede',
        route: (input) => ({
            method: 'PATCH',
            path: `/venues/${input.venue_id}`,
            body: pick(input, ['name', 'address', 'notes', 'surface_type', 'capacity', 'has_lighting', 'is_covered']),
        }),
    },
    {
        tool: {
            name: 'update_school',
            description: 'Cambia el nombre de la academia.',
            input_schema: {
                type: 'object',
                properties: { name: str('Nuevo nombre de la academia') },
                required: ['name'],
            },
        },
        label: (i) => `Renombrando academia a "${i.name}"`,
        route: (input, ctx) => ({
            method: 'PUT',
            path: `/schools/${ctx.schoolId}`,
            body: { name: input.name },
        }),
    },
    // ------------------------------------------------- sensibles (confirmación)
    {
        tool: {
            name: 'delete_student',
            description: 'ELIMINA un alumno de la academia (se archiva en la papelera de eliminados). Acción destructiva: el usuario deberá confirmarla.',
            input_schema: {
                type: 'object',
                properties: { student_id: str('UUID del alumno a eliminar') },
                required: ['student_id'],
            },
        },
        sensitive: true,
        label: () => 'Eliminar alumno',
        route: (input) => ({ method: 'DELETE', path: `/students/${input.student_id}` }),
    },
    {
        tool: {
            name: 'register_student_payment',
            description: 'Registra un pago de mensualidad u otro concepto de uno o varios alumnos. Acción sensible: el usuario deberá confirmarla. Notifica a los padres.',
            input_schema: {
                type: 'object',
                properties: {
                    amount: num('Monto del pago'),
                    payment_date: str('Fecha del pago YYYY-MM-DD'),
                    student_id: str('UUID del alumno (pago individual)'),
                    student_ids: { type: 'array', items: { type: 'string' }, description: 'UUIDs de alumnos (pago grupal, alternativa a student_id)' },
                    description: str('Concepto del pago (opcional)'),
                    payment_month: str('Mes que cubre, YYYY-MM (opcional)'),
                },
                required: ['amount', 'payment_date'],
            },
        },
        sensitive: true,
        label: (i) => `Registrar pago de $${i.amount}`,
        route: (input) => ({
            method: 'POST',
            path: '/payments/students',
            body: pick(input, ['amount', 'payment_date', 'student_id', 'student_ids', 'description', 'payment_month']),
        }),
    },
    {
        tool: {
            name: 'register_teacher_payment',
            description: 'Registra un pago A un profesor. Acción sensible: el usuario deberá confirmarla.',
            input_schema: {
                type: 'object',
                properties: {
                    amount: num('Monto del pago'),
                    payment_date: str('Fecha del pago YYYY-MM-DD'),
                    teacher_id: str('UUID del profesor (obtener con list_users role=profesor)'),
                },
                required: ['amount', 'payment_date', 'teacher_id'],
            },
        },
        sensitive: true,
        label: (i) => `Pagar $${i.amount} a profesor`,
        route: (input) => ({
            method: 'POST',
            path: '/payments/teachers',
            body: pick(input, ['amount', 'payment_date', 'teacher_id']),
        }),
    },
    {
        tool: {
            name: 'delete_event',
            description: 'ELIMINA un evento y sus entrenamientos. Acción destructiva: el usuario deberá confirmarla.',
            input_schema: {
                type: 'object',
                properties: { event_id: str('UUID del evento a eliminar') },
                required: ['event_id'],
            },
        },
        sensitive: true,
        label: () => 'Eliminar evento',
        route: (input) => ({ method: 'DELETE', path: `/events/${input.event_id}` }),
    },
    {
        tool: {
            name: 'delete_venue',
            description: 'ELIMINA una sede. Acción destructiva: el usuario deberá confirmarla.',
            input_schema: {
                type: 'object',
                properties: { venue_id: str('UUID de la sede a eliminar') },
                required: ['venue_id'],
            },
        },
        sensitive: true,
        label: () => 'Eliminar sede',
        route: (input) => ({ method: 'DELETE', path: `/venues/${input.venue_id}` }),
    },
    {
        tool: {
            name: 'invite_teacher',
            description: 'Invita a un profesor nuevo por email (recibe un correo de invitación). Acción sensible: el usuario deberá confirmarla.',
            input_schema: {
                type: 'object',
                properties: {
                    email: str('Email del profesor'),
                    fullName: str('Nombre completo'),
                    phone: str('Teléfono (opcional)'),
                    categoryIds: { type: 'array', items: { type: 'string' }, description: 'UUIDs de categorías a asignar (opcional)' },
                },
                required: ['email', 'fullName'],
            },
        },
        sensitive: true,
        label: (i) => `Invitar profesor ${i.email}`,
        route: (input) => ({
            method: 'POST',
            path: '/auth/invite-teacher',
            body: pick(input, ['email', 'fullName', 'phone', 'categoryIds']),
        }),
    },
    {
        tool: {
            name: 'invite_parent',
            description: 'Invita a un padre/tutor por email. Acción sensible: el usuario deberá confirmarla.',
            input_schema: {
                type: 'object',
                properties: {
                    email: str('Email del padre'),
                    fullName: str('Nombre completo'),
                    phone: str('Teléfono (opcional)'),
                },
                required: ['email', 'fullName'],
            },
        },
        sensitive: true,
        label: (i) => `Invitar padre ${i.email}`,
        route: (input) => ({
            method: 'POST',
            path: '/auth/invite-parent',
            body: pick(input, ['email', 'fullName', 'phone']),
        }),
    },
    {
        tool: {
            name: 'invite_admin',
            description: 'Crea otro administrador de la academia con contraseña temporal. Acción sensible: el usuario deberá confirmarla.',
            input_schema: {
                type: 'object',
                properties: {
                    email: str('Email del nuevo admin'),
                    fullName: str('Nombre completo'),
                },
                required: ['email', 'fullName'],
            },
        },
        sensitive: true,
        label: (i) => `Crear admin ${i.email}`,
        route: (input) => ({
            method: 'POST',
            path: '/auth/invite-admin',
            body: pick(input, ['email', 'fullName']),
        }),
    },
];
// ----------------------------------------------------------------- exports
const byName = new Map(TOOL_DEFS.map((d) => [d.tool.name, d]));
exports.CHAT_TOOLS = TOOL_DEFS.map((d) => d.tool);
exports.SENSITIVE_TOOLS = new Set(TOOL_DEFS.filter((d) => d.sensitive).map((d) => d.tool.name));
function toolRoute(name, input, ctx) {
    const def = byName.get(name);
    return def ? def.route(input, ctx) : null;
}
function toolLabel(name, input) {
    const def = byName.get(name);
    return def ? def.label(input) : name;
}
