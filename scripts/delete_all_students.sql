-- Script para eliminar todos los alumnos de la escuela "M.R Master Fut"
-- school_id: ca4faf44-0091-4515-9dfe-8743f9985276

-- Primero, verificar cuántos alumnos se van a eliminar
SELECT COUNT(*) AS total_students
FROM public.students
WHERE school_id = 'ca4faf44-0091-4515-9dfe-8743f9985276';

-- Ver datos de los alumnos a eliminar
SELECT id, full_name, birth_date, created_at
FROM public.students
WHERE school_id = 'ca4faf44-0091-4515-9dfe-8743f9985276'
ORDER BY created_at;

-- Eliminar todos los alumnos
-- attendances se eliminan en cascada (ON DELETE CASCADE)
-- payments queda con student_id = NULL (ON DELETE SET NULL)
DELETE FROM public.students
WHERE school_id = 'ca4faf44-0091-4515-9dfe-8743f9985276';

-- Verificar que se eliminaron
SELECT COUNT(*) AS remaining_students
FROM public.students
WHERE school_id = 'ca4faf44-0091-4515-9dfe-8743f9985276';
