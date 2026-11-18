-- Reviewer assignment and flagging (master-prompt Phase 6, continued): a
-- queue of evaluations needing human attention needs two things the schema
-- did not have -- who is working on it, and whether it needs attention at
-- all. assign_evaluation_reviewer() is the one path that sets or clears the
-- assignment; submit_evaluation() now also flags an evaluation that falls
-- below its template's pass_threshold, instead of every client re-deriving
-- that from the template on every read. Additive on top of 20261118120000.

ALTER TABLE public.evaluations
  ADD COLUMN assigned_reviewer_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN flagged BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX evaluations_org_flagged_idx ON public.evaluations (org_id, flagged) WHERE flagged;

CREATE OR REPLACE FUNCTION public.assign_evaluation_reviewer(target_evaluation_id UUID, new_reviewer_id UUID DEFAULT NULL)
RETURNS public.evaluations
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  ev public.evaluations;
  reviewer_status TEXT;
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

  UPDATE public.evaluations SET assigned_reviewer_id = new_reviewer_id WHERE id = target_evaluation_id RETURNING * INTO ev;
  PERFORM public.log_audit(ev.org_id, format('evaluation.assigned %s to %s', ev.id, COALESCE(new_reviewer_id::text, 'nobody')));
  RETURN ev;
END;
$$;
GRANT EXECUTE ON FUNCTION public.assign_evaluation_reviewer(UUID, UUID) TO authenticated;

-- Carries the same weighted-score and idempotency logic as before; only the
-- flagged computation is new. Replacing in full rather than diffing avoids
-- a second, easy-to-miss ambiguous-column review of a partial edit.
CREATE OR REPLACE FUNCTION public.submit_evaluation(
  call_id UUID,
  template_id UUID,
  scores JSONB,
  idempotency_key TEXT
)
RETURNS public.evaluations
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  c public.calls;
  tmpl public.evaluation_templates;
  total_weight INT := 0;
  weighted_sum NUMERIC := 0;
  eval_row public.evaluations;
  item JSONB;
  crit public.evaluation_criteria;
  seen_criteria UUID[] := '{}';
  computed_overall NUMERIC;
BEGIN
  SELECT * INTO eval_row FROM public.evaluations ev WHERE ev.idempotency_key = submit_evaluation.idempotency_key;
  IF eval_row.id IS NOT NULL THEN RETURN eval_row; END IF;

  SELECT * INTO c FROM public.calls WHERE id = call_id;
  IF c.id IS NULL THEN RAISE EXCEPTION 'call not found' USING ERRCODE = 'P0002'; END IF;
  IF NOT public.can_review_org(c.org_id) THEN
    RAISE EXCEPTION 'not allowed to evaluate calls in this organisation' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO tmpl FROM public.evaluation_templates WHERE id = template_id AND org_id = c.org_id;
  IF tmpl.id IS NULL THEN RAISE EXCEPTION 'evaluation template not found' USING ERRCODE = 'P0002'; END IF;
  IF tmpl.status <> 'active' THEN RAISE EXCEPTION 'evaluation template % is % not active', template_id, tmpl.status USING ERRCODE = 'P0001'; END IF;

  IF scores IS NULL OR jsonb_typeof(scores) <> 'array' OR jsonb_array_length(scores) = 0 THEN
    RAISE EXCEPTION 'at least one score is required' USING ERRCODE = '22023';
  END IF;

  FOR item IN SELECT * FROM jsonb_array_elements(scores) LOOP
    IF NOT (item ? 'criterion_id' AND item ? 'score') THEN
      RAISE EXCEPTION 'each score needs criterion_id and score' USING ERRCODE = '22023';
    END IF;
    IF (item->>'criterion_id')::uuid = ANY (seen_criteria) THEN
      RAISE EXCEPTION 'criterion % was scored more than once', item->>'criterion_id' USING ERRCODE = '22023';
    END IF;
    seen_criteria := seen_criteria || (item->>'criterion_id')::uuid;

    -- Aliased and qualified: template_id is both this function's parameter
    -- and a real column on evaluation_criteria, which PL/pgSQL treats as
    -- ambiguous (variable_conflict defaults to 'error') unless disambiguated.
    SELECT * INTO crit FROM public.evaluation_criteria ec WHERE ec.id = (item->>'criterion_id')::uuid AND ec.template_id = submit_evaluation.template_id;
    IF crit.id IS NULL THEN
      RAISE EXCEPTION 'criterion % does not belong to this template', item->>'criterion_id' USING ERRCODE = 'P0002';
    END IF;
    IF (item->>'score')::int NOT BETWEEN 0 AND 100 THEN
      RAISE EXCEPTION 'score must be between 0 and 100' USING ERRCODE = '22023';
    END IF;
    total_weight := total_weight + crit.weight;
    weighted_sum := weighted_sum + crit.weight * (item->>'score')::numeric;
  END LOOP;
  IF total_weight = 0 THEN
    RAISE EXCEPTION 'the scored criteria have zero total weight' USING ERRCODE = '22023';
  END IF;
  computed_overall := round(weighted_sum / total_weight, 2);

  -- The nested subquery scans transcripts, which also has a call_id column
  -- colliding with this function's own parameter; aliased and qualified for
  -- the same reason as the lookups above.
  INSERT INTO public.evaluations (org_id, call_id, transcript_id, template_id, status, evaluator_kind, overall_score, idempotency_key, completed_at, flagged)
  VALUES (
    c.org_id, c.id, (SELECT tr.id FROM public.transcripts tr WHERE tr.call_id = c.id), template_id,
    'completed', 'human', computed_overall, idempotency_key, now(), computed_overall < tmpl.pass_threshold
  )
  RETURNING * INTO eval_row;

  FOR item IN SELECT * FROM jsonb_array_elements(scores) LOOP
    INSERT INTO public.evaluation_scores (org_id, evaluation_id, criterion_id, score, rationale, evidence_segment_ids)
    VALUES (
      c.org_id, eval_row.id, (item->>'criterion_id')::uuid, (item->>'score')::int,
      COALESCE(item->>'rationale', ''),
      COALESCE((SELECT array_agg(x::uuid) FROM jsonb_array_elements_text(COALESCE(item->'evidence_segment_ids', '[]'::jsonb)) x), '{}')
    );
  END LOOP;

  PERFORM public.log_audit(c.org_id, 'evaluation.submitted ' || eval_row.id::text, template_id::text);
  RETURN eval_row;
END;
$$;
GRANT EXECUTE ON FUNCTION public.submit_evaluation(UUID, UUID, JSONB, TEXT) TO authenticated;
