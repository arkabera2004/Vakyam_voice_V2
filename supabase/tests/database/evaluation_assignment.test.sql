-- pgTAP tests for assign_evaluation_reviewer() and the flagged computation
-- in submit_evaluation().
-- Run with: npx supabase test db   (needs a local stack: npx supabase start)
BEGIN;
SELECT plan(10);

INSERT INTO auth.users (id, email, instance_id, aud, role) VALUES
  ('a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1', 'admin@org-a.test', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
  ('b2b2b2b2-b2b2-4b2b-8b2b-b2b2b2b2b2b2', 'qa@org-a.test',    '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
  ('c3c3c3c3-c3c3-4c3c-8c3c-c3c3c3c3c3c3', 'agent@org-a.test', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
  ('d4d4d4d4-d4d4-4d4d-8d4d-d4d4d4d4d4d4', 'admin@org-b.test', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
  ('e5e5e5e5-e5e5-4e5e-8e5e-e5e5e5e5e5e5', 'disabled@org-a.test', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated');

INSERT INTO public.organisations (id, slug, name) VALUES
  ('0a0a0a0a-0a0a-4a0a-8a0a-0a0a0a0a0a0a', 'test-a', 'Test A'),
  ('0b0b0b0b-0b0b-4b0b-8b0b-0b0b0b0b0b0b', 'test-b', 'Test B');
INSERT INTO public.org_members (org_id, user_id, role, status) VALUES
  ('0a0a0a0a-0a0a-4a0a-8a0a-0a0a0a0a0a0a', 'a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1', 'org_admin', 'active'),
  ('0a0a0a0a-0a0a-4a0a-8a0a-0a0a0a0a0a0a', 'b2b2b2b2-b2b2-4b2b-8b2b-b2b2b2b2b2b2', 'qa_analyst', 'active'),
  ('0a0a0a0a-0a0a-4a0a-8a0a-0a0a0a0a0a0a', 'c3c3c3c3-c3c3-4c3c-8c3c-c3c3c3c3c3c3', 'agent', 'active'),
  ('0a0a0a0a-0a0a-4a0a-8a0a-0a0a0a0a0a0a', 'e5e5e5e5-e5e5-4e5e-8e5e-e5e5e5e5e5e5', 'qa_analyst', 'disabled'),
  ('0b0b0b0b-0b0b-4b0b-8b0b-0b0b0b0b0b0b', 'd4d4d4d4-d4d4-4d4d-8d4d-d4d4d4d4d4d4', 'org_admin', 'active');

INSERT INTO public.calls (id, org_id, caller_name, started_by) VALUES
  ('ca11ca11-ca11-4a11-8a11-ca11ca11ca11', '0a0a0a0a-0a0a-4a0a-8a0a-0a0a0a0a0a0a', 'Agent call', 'c3c3c3c3-c3c3-4c3c-8c3c-c3c3c3c3c3c3');
INSERT INTO public.evaluation_templates (id, org_id, name, version, status, pass_threshold) VALUES
  ('e0e0e0e0-e0e0-4e0e-8e0e-e0e0e0e0e0e0', '0a0a0a0a-0a0a-4a0a-8a0a-0a0a0a0a0a0a', 'Standard rubric', 1, 'active', 75);
INSERT INTO public.evaluation_criteria (id, org_id, template_id, name, weight) VALUES
  ('cr1cr1cr-cr1c-4r1c-8r1c-cr1cr1cr1cr1', '0a0a0a0a-0a0a-4a0a-8a0a-0a0a0a0a0a0a', 'e0e0e0e0-e0e0-4e0e-8e0e-e0e0e0e0e0e0', 'Opening disclosure', 100);

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"b2b2b2b2-b2b2-4b2b-8b2b-b2b2b2b2b2b2","role":"authenticated"}', true);

-- ---- flagging: below the pass_threshold flags; at or above does not
SELECT is((SELECT flagged FROM public.submit_evaluation('ca11ca11-ca11-4a11-8a11-ca11ca11ca11', 'e0e0e0e0-e0e0-4e0e-8e0e-e0e0e0e0e0e0',
  '[{"criterion_id":"cr1cr1cr-cr1c-4r1c-8r1c-cr1cr1cr1cr1","score":60}]'::jsonb, 'idem-low')), true, 'a score below pass_threshold (75) is flagged');
SELECT is((SELECT flagged FROM public.submit_evaluation('ca11ca11-ca11-4a11-8a11-ca11ca11ca11', 'e0e0e0e0-e0e0-4e0e-8e0e-e0e0e0e0e0e0',
  '[{"criterion_id":"cr1cr1cr-cr1c-4r1c-8r1c-cr1cr1cr1cr1","score":80}]'::jsonb, 'idem-high')), false, 'a score at or above pass_threshold is not flagged');

-- ---- assignment
SELECT is((SELECT assigned_reviewer_id FROM public.evaluations WHERE idempotency_key = 'idem-low'), NULL, 'a new evaluation starts unassigned');
SELECT is((SELECT assigned_reviewer_id FROM public.assign_evaluation_reviewer((SELECT id FROM public.evaluations WHERE idempotency_key = 'idem-low'), 'b2b2b2b2-b2b2-4b2b-8b2b-b2b2b2b2b2b2')),
  'b2b2b2b2-b2b2-4b2b-8b2b-b2b2b2b2b2b2'::uuid, 'a reviewer assigns the flagged evaluation to themselves');
SELECT is((SELECT count(*) FROM public.audit_log WHERE change LIKE 'evaluation.assigned%'), 1::bigint, 'the assignment is audited');
SELECT is((SELECT assigned_reviewer_id FROM public.assign_evaluation_reviewer((SELECT id FROM public.evaluations WHERE idempotency_key = 'idem-low'), NULL)),
  NULL, 'passing NULL clears the assignment');

-- ---- validation
SELECT throws_ok($$ SELECT public.assign_evaluation_reviewer((SELECT id FROM public.evaluations WHERE idempotency_key = 'idem-low'), 'd4d4d4d4-d4d4-4d4d-8d4d-d4d4d4d4d4d4') $$,
  'P0002', NULL, 'assigning someone outside the organisation is refused');
SELECT throws_ok($$ SELECT public.assign_evaluation_reviewer((SELECT id FROM public.evaluations WHERE idempotency_key = 'idem-low'), 'e5e5e5e5-e5e5-4e5e-8e5e-e5e5e5e5e5e5') $$,
  'P0001', NULL, 'assigning a disabled member is refused');

SELECT set_config('request.jwt.claims', '{"sub":"c3c3c3c3-c3c3-4c3c-8c3c-c3c3c3c3c3c3","role":"authenticated"}', true);
SELECT throws_ok($$ SELECT public.assign_evaluation_reviewer((SELECT id FROM public.evaluations WHERE idempotency_key = 'idem-low'), 'c3c3c3c3-c3c3-4c3c-8c3c-c3c3c3c3c3c3') $$,
  '42501', NULL, 'an agent cannot assign reviewers');

-- ---- org B cannot assign on org A's evaluation
SELECT set_config('request.jwt.claims', '{"sub":"d4d4d4d4-d4d4-4d4d-8d4d-d4d4d4d4d4d4","role":"authenticated"}', true);
SELECT throws_ok($$ SELECT public.assign_evaluation_reviewer((SELECT id FROM public.evaluations WHERE idempotency_key = 'idem-low'), 'd4d4d4d4-d4d4-4d4d-8d4d-d4d4d4d4d4d4') $$,
  '42501', NULL, 'org B admin cannot assign reviewers on org A''s evaluation');

SELECT * FROM finish();
ROLLBACK;
