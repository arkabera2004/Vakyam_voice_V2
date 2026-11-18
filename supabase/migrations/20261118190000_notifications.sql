-- Notifications (Phase 7): the table and its RLS have existed since
-- 20261117100000, but nothing has ever created a row. Wires the first real
-- trigger -- assigning a reviewer notifies them -- as a demonstrable,
-- end-to-end example; other trigger points (a call failing, an invitation
-- being accepted) are not wired yet and are tracked separately, not
-- invented here. Additive on top of 20261118180000.

CREATE OR REPLACE FUNCTION public.assign_evaluation_reviewer(target_evaluation_id UUID, new_reviewer_id UUID DEFAULT NULL)
RETURNS public.evaluations
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  ev public.evaluations;
  reviewer_status TEXT;
  previous_reviewer_id UUID;
BEGIN
  SELECT * INTO ev FROM public.evaluations WHERE id = target_evaluation_id;
  IF ev.id IS NULL THEN RAISE EXCEPTION 'evaluation not found' USING ERRCODE = 'P0002'; END IF;
  IF NOT public.can_review_org(ev.org_id) THEN
    RAISE EXCEPTION 'not allowed to assign reviewers in this organisation' USING ERRCODE = '42501';
  END IF;

  IF new_reviewer_id IS NOT NULL THEN
    SELECT om.status INTO reviewer_status FROM public.org_members om WHERE om.org_id = ev.org_id AND om.user_id = new_reviewer_id;
    IF reviewer_status IS NULL THEN
      RAISE EXCEPTION 'the chosen reviewer is not a member of this organisation' USING ERRCODE = 'P0002';
    END IF;
    IF reviewer_status <> 'active' THEN
      RAISE EXCEPTION 'the chosen reviewer is disabled' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  previous_reviewer_id := ev.assigned_reviewer_id;
  UPDATE public.evaluations SET assigned_reviewer_id = new_reviewer_id WHERE id = target_evaluation_id RETURNING * INTO ev;
  PERFORM public.log_audit(ev.org_id, format('evaluation.assigned %s to %s', ev.id, COALESCE(new_reviewer_id::text, 'nobody')));

  -- Only a genuine new assignment notifies, not a no-op reassignment to the
  -- same person or a clear (new_reviewer_id IS NULL).
  IF new_reviewer_id IS NOT NULL AND new_reviewer_id IS DISTINCT FROM previous_reviewer_id THEN
    INSERT INTO public.notifications (org_id, user_id, kind, title, body)
    VALUES (ev.org_id, new_reviewer_id, 'evaluation.assigned', 'A call was assigned to you for review', format('Evaluation %s needs your review.', ev.id));
  END IF;

  RETURN ev;
END;
$$;
