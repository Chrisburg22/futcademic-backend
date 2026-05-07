CREATE OR REPLACE FUNCTION save_attendance_batch(
  p_school_id UUID,
  p_training_id UUID,
  p_date DATE,
  p_type VARCHAR,
  p_teacher_id UUID,
  p_records JSONB
) RETURNS JSONB AS $$
DECLARE
  v_record JSONB;
  v_student_id UUID;
  v_present BOOLEAN;
BEGIN
  FOR v_record IN SELECT jsonb_array_elements(p_records)
  LOOP
    v_student_id := (v_record->>'studentId')::UUID;
    v_present := (v_record->>'present')::BOOLEAN;
    
    INSERT INTO public.attendances (school_id, student_id, category_id, teacher_id, training_id, date, type, present)
    SELECT p_school_id, v_student_id, s.category_id, p_teacher_id, p_training_id, p_date, p_type, v_present
    FROM public.students s WHERE s.id = v_student_id AND s.school_id = p_school_id
    ON CONFLICT (student_id, date, type) 
    DO UPDATE SET present = v_present, teacher_id = p_teacher_id, training_id = p_training_id;
  END LOOP;

  IF p_training_id IS NOT NULL THEN
    UPDATE public.trainings SET is_completed = true WHERE id = p_training_id AND school_id = p_school_id;
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql;
