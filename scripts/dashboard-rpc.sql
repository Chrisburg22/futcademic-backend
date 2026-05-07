CREATE OR REPLACE FUNCTION get_pending_payments_count(p_school_id UUID)
RETURNS INT AS $$
  SELECT COUNT(*)::INT FROM public.students s
  WHERE s.school_id = p_school_id
    AND s.status = 'activo'
    AND s.id NOT IN (
      SELECT COALESCE(p.student_id, ps.student_id) FROM public.payments p
      LEFT JOIN public.payment_students ps ON ps.payment_id = p.id
      WHERE p.school_id = p_school_id
        AND p.payment_type = 'mensualidad'
        AND p.payment_month = EXTRACT(MONTH FROM CURRENT_DATE)
    );
$$ LANGUAGE SQL STABLE;
