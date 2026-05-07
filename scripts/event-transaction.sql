CREATE OR REPLACE FUNCTION create_event_with_trainings(
  p_school_id UUID,
  p_category_id UUID,
  p_venue_id UUID,
  p_date DATE,
  p_start_time TIME,
  p_type VARCHAR,
  p_description TEXT,
  p_is_recurring BOOLEAN,
  p_recurring_weeks INT,
  p_recurrence_rule JSONB,
  p_trainings JSONB
) RETURNS JSONB AS $$
DECLARE
  v_event_id UUID;
  v_training JSONB;
BEGIN
  INSERT INTO public.events (school_id, category_id, venue_id, date, start_time, type, description, is_recurring, recurring_weeks, recurrence_rule)
  VALUES (p_school_id, p_category_id, p_venue_id, p_date, p_start_time, p_type, p_description, p_is_recurring, p_recurring_weeks, p_recurrence_rule)
  RETURNING id INTO v_event_id;

  FOR v_training IN SELECT jsonb_array_elements(p_trainings)
  LOOP
    INSERT INTO public.trainings (school_id, event_id, category_id, venue_id, date, start_time, type)
    VALUES (
      p_school_id, v_event_id, p_category_id,
      (v_training->>'venueId')::UUID,
      (v_training->>'date')::DATE,
      (v_training->>'startTime')::TIME,
      (v_training->>'type')::VARCHAR
    );
  END LOOP;

  RETURN jsonb_build_object('event_id', v_event_id, 'success', true);
END;
$$ LANGUAGE plpgsql;
