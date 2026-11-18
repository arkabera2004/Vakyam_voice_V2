-- pgTAP tests for agent_version_score_summary().
-- Run with: npx supabase test db   (needs a local stack: npx supabase start)
BEGIN;
SELECT plan(8);

INSERT INTO auth.users (id, email, instance_id, aud, role) VALUES
  ('a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1', 'admin@org-a.test', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
  ('c3c3c3c3-c3c3-4c3c-8c3c-c3c3c3c3c3c3', 'agent@org-a.test', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
  ('d4d4d4d4-d4d4-4d4d-8d4d-d4d4d4d4d4d4', 'admin@org-b.test', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
  ('e5e5e5e5-e5e5-4e5e-8e5e-e5e5e5e5e5e5', 'nobody@nowhere.test', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated');

INSERT INTO public.organisations (id, slug, name) VALUES
  ('0a0a0a0a-0a0a-4a0a-8a0a-0a0a0a0a0a0a', 'test-a', 'Test A'),
  ('0b0b0b0b-0b0b-4b0b-8b0b-0b0b0b0b0b0b', 'test-b', 'Test B');
INSERT INTO public.org_members (org_id, user_id, role) VALUES
  ('0a0a0a0a-0a0a-4a0a-8a0a-0a0a0a0a0a0a', 'a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1', 'org_admin'),
  ('0a0a0a0a-0a0a-4a0a-8a0a-0a0a0a0a0a0a', 'c3c3c3c3-c3c3-4c3c-8c3c-c3c3c3c3c3c3', 'agent'),
  ('0b0b0b0b-0b0b-4b0b-8b0b-0b0b0b0b0b0b', 'd4d4d4d4-d4d4-4d4d-8d4d-d4d4d4d4d4d4', 'org_admin');

INSERT INTO public.agents (id, org_id, name) VALUES
  ('f0f0f0f0-f0f0-4f0f-8f0f-f0f0f0f0f0f0', '0a0a0a0a-0a0a-4a0a-8a0a-0a0a0a0a0a0a', 'Meera');
INSERT INTO public.agent_versions (id, org_id, agent_id, version, prompt) VALUES
  ('e0e0e0e0-e0e0-4e0e-8e0e-e0e0e0e0e0e0', '0a0a0a0a-0a0a-4a0a-8a0a-0a0a0a0a0a0a', 'f0f0f0f0-f0f0-4f0f-8f0f-f0f0f0f0f0f0', 'v1', 'Be warm.'),
  ('e1e1e1e1-e1e1-4e1e-8e1e-e1e1e1e1e1e1', '0a0a0a0a-0a0a-4a0a-8a0a-0a0a0a0a0a0a', 'f0f0f0f0-f0f0-4f0f-8f0f-f0f0f0f0f0f0', 'v2', 'Be brief.');

-- v1: two evaluated calls (90, 90 -> avg 90) plus one unevaluated call (excluded)
INSERT INTO public.calls (id, org_id, agent_id, agent_version_id, caller_name, started_by) VALUES
  ('ca000001-0001-4001-8001-000000000001', '0a0a0a0a-0a0a-4a0a-8a0a-0a0a0a0a0a0a', 'f0f0f0f0-f0f0-4f0f-8f0f-f0f0f0f0f0f0', 'e0e0e0e0-e0e0-4e0e-8e0e-e0e0e0e0e0e0', 'Caller 1', 'c3c3c3c3-c3c3-4c3c-8c3c-c3c3c3c3c3c3'),
  ('ca000002-0002-4002-8002-000000000002', '0a0a0a0a-0a0a-4a0a-8a0a-0a0a0a0a0a0a', 'f0f0f0f0-f0f0-4f0f-8f0f-f0f0f0f0f0f0', 'e0e0e0e0-e0e0-4e0e-8e0e-e0e0e0e0e0e0', 'Caller 2', 'c3c3c3c3-c3c3-4c3c-8c3c-c3c3c3c3c3c3'),
  ('ca000003-0003-4003-8003-000000000003', '0a0a0a0a-0a0a-4a0a-8a0a-0a0a0a0a0a0a', 'f0f0f0f0-f0f0-4f0f-8f0f-f0f0f0f0f0f0', 'e0e0e0e0-e0e0-4e0e-8e0e-e0e0e0e0e0e0', 'Caller 3, no evaluation yet', 'c3c3c3c3-c3c3-4c3c-8c3c-c3c3c3c3c3c3'),
  -- v2: one evaluated call at 70
  ('ca000004-0004-4004-8004-000000000004', '0a0a0a0a-0a0a-4a0a-8a0a-0a0a0a0a0a0a', 'f0f0f0f0-f0f0-4f0f-8f0f-f0f0f0f0f0f0', 'e1e1e1e1-e1e1-4e1e-8e1e-e1e1e1e1e1e1', 'Caller 4', 'c3c3c3c3-c3c3-4c3c-8c3c-c3c3c3c3c3c3'),
  -- v2: one call whose evaluation has a NULL overall_score (e.g. still running), excluded
  ('ca000005-0005-4005-8005-000000000005', '0a0a0a0a-0a0a-4a0a-8a0a-0a0a0a0a0a0a', 'f0f0f0f0-f0f0-4f0f-8f0f-f0f0f0f0f0f0', 'e1e1e1e1-e1e1-4e1e-8e1e-e1e1e1e1e1e1', 'Caller 5, evaluation still running', 'c3c3c3c3-c3c3-4c3c-8c3c-c3c3c3c3c3c3');

INSERT INTO public.evaluation_templates (id, org_id, name, version, status) VALUES
  ('d0d0d0d0-d0d0-4d0d-8d0d-d0d0d0d0d0d0', '0a0a0a0a-0a0a-4a0a-8a0a-0a0a0a0a0a0a', 'Rubric', 1, 'active');
INSERT INTO public.evaluations (org_id, call_id, template_id, status, evaluator_kind, overall_score, idempotency_key) VALUES
  ('0a0a0a0a-0a0a-4a0a-8a0a-0a0a0a0a0a0a', 'ca000001-0001-4001-8001-000000000001', 'd0d0d0d0-d0d0-4d0d-8d0d-d0d0d0d0d0d0', 'completed', 'human', 90, 'score-v1-a'),
  ('0a0a0a0a-0a0a-4a0a-8a0a-0a0a0a0a0a0a', 'ca000002-0002-4002-8002-000000000002', 'd0d0d0d0-d0d0-4d0d-8d0d-d0d0d0d0d0d0', 'completed', 'human', 90, 'score-v1-b'),
  ('0a0a0a0a-0a0a-4a0a-8a0a-0a0a0a0a0a0a', 'ca000004-0004-4004-8004-000000000004', 'd0d0d0d0-d0d0-4d0d-8d0d-d0d0d0d0d0d0', 'completed', 'human', 70, 'score-v2-a'),
  ('0a0a0a0a-0a0a-4a0a-8a0a-0a0a0a0a0a0a', 'ca000005-0005-4005-8005-000000000005', 'd0d0d0d0-d0d0-4d0d-8d0d-d0d0d0d0d0d0', 'running',   'human', NULL, 'score-v2-b');

SET LOCAL ROLE authenticated;

-- ---- averages are correct per version; unevaluated and NULL-score calls are excluded
SELECT set_config('request.jwt.claims', '{"sub":"a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1","role":"authenticated"}', true);
SELECT results_eq(
  $$ SELECT version, average_score, evaluation_count FROM public.agent_version_score_summary('f0f0f0f0-f0f0-4f0f-8f0f-f0f0f0f0f0f0') ORDER BY version $$,
  $$ VALUES ('v1'::text, 90.00::numeric, 2::bigint), ('v2'::text, 70.00::numeric, 1::bigint) $$,
  'v1 averages 90 across 2 evaluated calls; v2 averages 70 across 1, excluding the unevaluated and NULL-score calls');

-- ---- an agent-role member (any org member) can also read the summary
SELECT set_config('request.jwt.claims', '{"sub":"c3c3c3c3-c3c3-4c3c-8c3c-c3c3c3c3c3c3","role":"authenticated"}', true);
SELECT is((SELECT count(*) FROM public.agent_version_score_summary('f0f0f0f0-f0f0-4f0f-8f0f-f0f0f0f0f0f0')), 2::bigint, 'any org member, not just an editor, can read the summary');

-- ---- validation
SELECT throws_ok($$ SELECT * FROM public.agent_version_score_summary('00000000-0000-4000-8000-000000000099') $$,
  'P0002', NULL, 'an unknown agent id is refused');
SELECT set_config('request.jwt.claims', '{"sub":"e5e5e5e5-e5e5-4e5e-8e5e-e5e5e5e5e5e5","role":"authenticated"}', true);
SELECT throws_ok($$ SELECT * FROM public.agent_version_score_summary('f0f0f0f0-f0f0-4f0f-8f0f-f0f0f0f0f0f0') $$,
  '42501', NULL, 'a user with no organisation membership is refused');

-- ---- org B cannot see org A's agent's summary
SELECT set_config('request.jwt.claims', '{"sub":"d4d4d4d4-d4d4-4d4d-8d4d-d4d4d4d4d4d4","role":"authenticated"}', true);
SELECT throws_ok($$ SELECT * FROM public.agent_version_score_summary('f0f0f0f0-f0f0-4f0f-8f0f-f0f0f0f0f0f0') $$,
  '42501', NULL, 'org B admin cannot read org A''s agent summary');

-- ---- a version with no evaluated calls at all is simply absent, not a zero row
INSERT INTO public.agent_versions (id, org_id, agent_id, version, prompt) VALUES
  ('e2e2e2e2-e2e2-4e2e-8e2e-e2e2e2e2e2e2', '0a0a0a0a-0a0a-4a0a-8a0a-0a0a0a0a0a0a', 'f0f0f0f0-f0f0-4f0f-8f0f-f0f0f0f0f0f0', 'v3', 'Untested draft.');
SELECT set_config('request.jwt.claims', '{"sub":"a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1","role":"authenticated"}', true);
SELECT is((SELECT count(*) FROM public.agent_version_score_summary('f0f0f0f0-f0f0-4f0f-8f0f-f0f0f0f0f0f0') WHERE version = 'v3'), 0::bigint, 'a version with no evaluated calls has no row at all, not a zero average');
SELECT is((SELECT count(*) FROM public.agent_version_score_summary('f0f0f0f0-f0f0-4f0f-8f0f-f0f0f0f0f0f0')), 2::bigint, 'the untested draft version does not add a row to the summary');

-- ---- an agent belonging to another organisation is refused regardless of caller role
INSERT INTO public.agents (id, org_id, name) VALUES ('f1f1f1f1-f1f1-4f1f-8f1f-f1f1f1f1f1f1', '0b0b0b0b-0b0b-4b0b-8b0b-0b0b0b0b0b0b', 'Other org agent');
SELECT throws_ok($$ SELECT * FROM public.agent_version_score_summary('f1f1f1f1-f1f1-4f1f-8f1f-f1f1f1f1f1f1') $$,
  '42501', NULL, 'org A admin cannot read a summary for an agent belonging to org B');

SELECT * FROM finish();
ROLLBACK;
