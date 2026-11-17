-- Evaluation workflow (master-prompt Phase 6): submit_evaluation() computes
-- the weighted overall score from criterion scores and persists both
-- atomically; add_evaluation_review() lets a reviewer comment or override
-- without ever touching the original evaluation row -- the AI/human result
-- and the review are always two separate rows. RLS on evaluation_templates
-- and evaluation_criteria already lets reviewers (editors + qa_analyst)
-- create them directly (see 20261117100000); only the scoring workflow
-- itself needed a server-side home, to keep the weighted-average
-- computation out of every client that submits a score.
--
-- Scope note: evaluator_kind is always 'human' here. No AI evaluation
-- provider exists in this codebase yet, so nothing here claims one.
-- Additive on top of 20261118100000.

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

  -- The nested subquery scans transcripts, which also has a call_id column
  -- colliding with this function's own parameter; aliased and qualified for
  -- the same reason as the lookups above.
  INSERT INTO public.evaluations (org_id, call_id, transcript_id, template_id, status, evaluator_kind, overall_score, idempotency_key, completed_at)
  VALUES (
    c.org_id, c.id, (SELECT tr.id FROM public.transcripts tr WHERE tr.call_id = c.id), template_id,
    'completed', 'human', round(weighted_sum / total_weight, 2), idempotency_key, now()
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

-- A review never changes the evaluation row it reviews; it only ever adds
-- one of these. An AI or human result is permanent evidence once written.
CREATE OR REPLACE FUNCTION public.add_evaluation_review(
  evaluation_id UUID,
  comment TEXT DEFAULT '',
  override_overall NUMERIC DEFAULT NULL,
  override_scores JSONB DEFAULT NULL
)
RETURNS public.evaluation_reviews
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  ev public.evaluations;
  review public.evaluation_reviews;
BEGIN
  SELECT * INTO ev FROM public.evaluations WHERE id = evaluation_id;
  IF ev.id IS NULL THEN RAISE EXCEPTION 'evaluation not found' USING ERRCODE = 'P0002'; END IF;
  IF NOT public.can_review_org(ev.org_id) THEN
    RAISE EXCEPTION 'not allowed to review evaluations in this organisation' USING ERRCODE = '42501';
  END IF;
  IF override_overall IS NOT NULL AND override_overall NOT BETWEEN 0 AND 100 THEN
    RAISE EXCEPTION 'override_overall must be between 0 and 100' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.evaluation_reviews (org_id, evaluation_id, reviewer_id, comment, override_overall, override_scores)
  VALUES (ev.org_id, ev.id, auth.uid(), COALESCE(comment, ''), override_overall, override_scores)
  RETURNING * INTO review;

  PERFORM public.log_audit(ev.org_id, format('evaluation.reviewed %s by %s', ev.id, auth.uid()));
  RETURN review;
END;
$$;
GRANT EXECUTE ON FUNCTION public.add_evaluation_review(UUID, TEXT, NUMERIC, JSONB) TO authenticated;
