-- pgTAP tests for submit_evaluation() and add_evaluation_review().
-- Run with: npx supabase test db   (needs a local stack: npx supabase start)
BEGIN;
SELECT plan(15);

INSERT INTO auth.users (id, email, instance_id, aud, role) VALUES
  ('a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1', 'admin@org-a.test', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
  ('b2b2b2b2-b2b2-4b2b-8b2b-b2b2b2b2b2b2', 'qa@org-a.test',    '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
  ('c3c3c3c3-c3c3-4c3c-8c3c-c3c3c3c3c3c3', 'agent@org-a.test', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
  ('d4d4d4d4-d4d4-4d4d-8d4d-d4d4d4d4d4d4', 'admin@org-b.test', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated');

INSERT INTO public.organisations (id, slug, name) VALUES
  ('0a0a0a0a-0a0a-4a0a-8a0a-0a0a0a0a0a0a', 'test-a', 'Test A'),
  ('0b0b0b0b-0b0b-4b0b-8b0b-0b0b0b0b0b0b', 'test-b', 'Test B');
INSERT INTO public.org_members (org_id, user_id, role) VALUES
  ('0a0a0a0a-0a0a-4a0a-8a0a-0a0a0a0a0a0a', 'a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1', 'org_admin'),
  ('0a0a0a0a-0a0a-4a0a-8a0a-0a0a0a0a0a0a', 'b2b2b2b2-b2b2-4b2b-8b2b-b2b2b2b2b2b2', 'qa_analyst'),
  ('0a0a0a0a-0a0a-4a0a-8a0a-0a0a0a0a0a0a', 'c3c3c3c3-c3c3-4c3c-8c3c-c3c3c3c3c3c3', 'agent'),
  ('0b0b0b0b-0b0b-4b0b-8b0b-0b0b0b0b0b0b', 'd4d4d4d4-d4d4-4d4d-8d4d-d4d4d4d4d4d4', 'org_admin');

INSERT INTO public.calls (id, org_id, caller_name, started_by) VALUES
  ('ca11ca11-ca11-4a11-8a11-ca11ca11ca11', '0a0a0a0a-0a0a-4a0a-8a0a-0a0a0a0a0a0a', 'Agent call', 'c3c3c3c3-c3c3-4c3c-8c3c-c3c3c3c3c3c3');
INSERT INTO public.evaluation_templates (id, org_id, name, version, status) VALUES
  ('e0e0e0e0-e0e0-4e0e-8e0e-e0e0e0e0e0e0', '0a0a0a0a-0a0a-4a0a-8a0a-0a0a0a0a0a0a', 'Standard rubric', 1, 'active'),
  ('e1e1e1e1-e1e1-4e1e-8e1e-e1e1e1e1e1e1', '0a0a0a0a-0a0a-4a0a-8a0a-0a0a0a0a0a0a', 'Draft rubric', 1, 'draft');
INSERT INTO public.evaluation_criteria (id, org_id, template_id, name, weight) VALUES
  ('cr1cr1cr-cr1c-4r1c-8r1c-cr1cr1cr1cr1', '0a0a0a0a-0a0a-4a0a-8a0a-0a0a0a0a0a0a', 'e0e0e0e0-e0e0-4e0e-8e0e-e0e0e0e0e0e0', 'Opening disclosure', 60),
  ('cr2cr2cr-cr2c-4r2c-8r2c-cr2cr2cr2cr2', '0a0a0a0a-0a0a-4a0a-8a0a-0a0a0a0a0a0a', 'e0e0e0e0-e0e0-4e0e-8e0e-e0e0e0e0e0e0', 'Issue resolution', 40);

SET LOCAL ROLE authenticated;

-- ---- an agent cannot submit an evaluation
SELECT set_config('request.jwt.claims', '{"sub":"c3c3c3c3-c3c3-4c3c-8c3c-c3c3c3c3c3c3","role":"authenticated"}', true);
SELECT throws_ok($$ SELECT public.submit_evaluation('ca11ca11-ca11-4a11-8a11-ca11ca11ca11', 'e0e0e0e0-e0e0-4e0e-8e0e-e0e0e0e0e0e0',
  '[{"criterion_id":"cr1cr1cr-cr1c-4r1c-8r1c-cr1cr1cr1cr1","score":90}]'::jsonb, 'idem-agent') $$,
  '42501', NULL, 'an agent cannot submit an evaluation');

SELECT set_config('request.jwt.claims', '{"sub":"b2b2b2b2-b2b2-4b2b-8b2b-b2b2b2b2b2b2","role":"authenticated"}', true);

-- ---- validation
SELECT throws_ok($$ SELECT public.submit_evaluation('ca11ca11-ca11-4a11-8a11-ca11ca11ca11', 'e1e1e1e1-e1e1-4e1e-8e1e-e1e1e1e1e1e1',
  '[{"criterion_id":"cr1cr1cr-cr1c-4r1c-8r1c-cr1cr1cr1cr1","score":90}]'::jsonb, 'idem-draft') $$,
  'P0001', NULL, 'a draft (not active) template is refused');
SELECT throws_ok($$ SELECT public.submit_evaluation('ca11ca11-ca11-4a11-8a11-ca11ca11ca11', 'e0e0e0e0-e0e0-4e0e-8e0e-e0e0e0e0e0e0',
  '[{"criterion_id":"cr1cr1cr-cr1c-4r1c-8r1c-cr1cr1cr1cr1","score":150}]'::jsonb, 'idem-range') $$,
  '22023', NULL, 'a score outside 0 to 100 is refused');
SELECT throws_ok($$ SELECT public.submit_evaluation('ca11ca11-ca11-4a11-8a11-ca11ca11ca11', 'e0e0e0e0-e0e0-4e0e-8e0e-e0e0e0e0e0e0',
  '[{"criterion_id":"00000000-0000-4000-8000-000000000099","score":90}]'::jsonb, 'idem-unknown') $$,
  'P0002', NULL, 'a criterion not on this template is refused');
SELECT throws_ok($$ SELECT public.submit_evaluation('ca11ca11-ca11-4a11-8a11-ca11ca11ca11', 'e0e0e0e0-e0e0-4e0e-8e0e-e0e0e0e0e0e0',
  '[{"criterion_id":"cr1cr1cr-cr1c-4r1c-8r1c-cr1cr1cr1cr1","score":90},{"criterion_id":"cr1cr1cr-cr1c-4r1c-8r1c-cr1cr1cr1cr1","score":50}]'::jsonb, 'idem-dup') $$,
  '22023', NULL, 'scoring the same criterion twice is refused');

-- ---- a qa_analyst submits a real evaluation; overall is the weighted average
SELECT results_eq(
  $$ SELECT status, evaluator_kind, overall_score FROM public.submit_evaluation('ca11ca11-ca11-4a11-8a11-ca11ca11ca11', 'e0e0e0e0-e0e0-4e0e-8e0e-e0e0e0e0e0e0',
     '[{"criterion_id":"cr1cr1cr-cr1c-4r1c-8r1c-cr1cr1cr1cr1","score":90,"rationale":"clear"},{"criterion_id":"cr2cr2cr-cr2c-4r2c-8r2c-cr2cr2cr2cr2","score":70}]'::jsonb, 'idem-real') $$,
  $$ VALUES ('completed'::text, 'human'::text, 82.00::numeric) $$,
  'weighted overall is 60% of 90 plus 40% of 70 = 82.00');
SELECT is((SELECT count(*) FROM public.evaluation_scores es JOIN public.evaluations e ON e.id = es.evaluation_id WHERE e.idempotency_key = 'idem-real'), 2::bigint, 'both criterion scores are persisted');

-- ---- idempotent replay returns the same row, not a duplicate
SELECT results_eq(
  $$ SELECT (SELECT count(*) FROM public.evaluations WHERE idempotency_key = 'idem-real') $$,
  $$ VALUES (1::bigint) $$,
  'exactly one evaluation exists for that key before the replay');
SELECT lives_ok($$ SELECT public.submit_evaluation('ca11ca11-ca11-4a11-8a11-ca11ca11ca11', 'e0e0e0e0-e0e0-4e0e-8e0e-e0e0e0e0e0e0',
  '[{"criterion_id":"cr1cr1cr-cr1c-4r1c-8r1c-cr1cr1cr1cr1","score":1}]'::jsonb, 'idem-real') $$,
  'resubmitting the same idempotency_key does not throw');
SELECT is((SELECT count(*) FROM public.evaluations WHERE idempotency_key = 'idem-real'), 1::bigint, 'the replay created no second row');
SELECT is((SELECT overall_score FROM public.evaluations WHERE idempotency_key = 'idem-real'), 82.00::numeric, 'the replay did not recompute the original score from the differing retry payload');

-- ---- review never changes the original evaluation
SELECT lives_ok($$ SELECT public.add_evaluation_review((SELECT id FROM public.evaluations WHERE idempotency_key = 'idem-real'), 'Agreed with the AI score', 85) $$,
  'a qa_analyst adds a review with an override');
SELECT is((SELECT overall_score FROM public.evaluations WHERE idempotency_key = 'idem-real'), 82.00::numeric, 'the original evaluation keeps its own score; the override lives only in evaluation_reviews');

SELECT set_config('request.jwt.claims', '{"sub":"c3c3c3c3-c3c3-4c3c-8c3c-c3c3c3c3c3c3","role":"authenticated"}', true);
SELECT throws_ok($$ SELECT public.add_evaluation_review((SELECT id FROM public.evaluations WHERE idempotency_key = 'idem-real'), 'x') $$,
  '42501', NULL, 'an agent cannot add a review');

-- ---- org B cannot see org A's evaluations
SELECT set_config('request.jwt.claims', '{"sub":"d4d4d4d4-d4d4-4d4d-8d4d-d4d4d4d4d4d4","role":"authenticated"}', true);
SELECT is((SELECT count(*) FROM public.evaluations), 0::bigint, 'org B sees none of org A''s evaluations');

SELECT * FROM finish();
ROLLBACK;
