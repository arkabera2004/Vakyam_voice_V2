-- pgTAP tests for start_call(): org/agent resolution, the calls.operate
-- permission tier (editors + agent, not qa_analyst), and consent resolution
-- at creation (mirrors src/domain/consent.ts's decideRecording()).
-- Run with: npx supabase test db   (needs a local stack: npx supabase start)
BEGIN;
SELECT plan(12);

INSERT INTO auth.users (id, email, instance_id, aud, role) VALUES
  ('a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1', 'admin@org-a.test', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
  ('b2b2b2b2-b2b2-4b2b-8b2b-b2b2b2b2b2b2', 'qa@org-a.test',    '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
  ('c3c3c3c3-c3c3-4c3c-8c3c-c3c3c3c3c3c3', 'agent@org-a.test', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
  ('e5e5e5e5-e5e5-4e5e-8e5e-e5e5e5e5e5e5', 'nobody@nowhere.test', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated');

INSERT INTO public.organisations (id, slug, name) VALUES
  ('0a0a0a0a-0a0a-4a0a-8a0a-0a0a0a0a0a0a', 'test-a', 'Test A'),
  ('0b0b0b0b-0b0b-4b0b-8b0b-0b0b0b0b0b0b', 'test-b', 'Test B');
INSERT INTO public.org_members (org_id, user_id, role) VALUES
  ('0a0a0a0a-0a0a-4a0a-8a0a-0a0a0a0a0a0a', 'a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1', 'org_admin'),
  ('0a0a0a0a-0a0a-4a0a-8a0a-0a0a0a0a0a0a', 'b2b2b2b2-b2b2-4b2b-8b2b-b2b2b2b2b2b2', 'qa_analyst'),
  ('0a0a0a0a-0a0a-4a0a-8a0a-0a0a0a0a0a0a', 'c3c3c3c3-c3c3-4c3c-8c3c-c3c3c3c3c3c3', 'agent');

INSERT INTO public.agents (id, org_id, name, live_version) VALUES
  ('f0f0f0f0-f0f0-4f0f-8f0f-f0f0f0f0f0f0', '0a0a0a0a-0a0a-4a0a-8a0a-0a0a0a0a0a0a', 'Meera', 'v1'),
  ('f1f1f1f1-f1f1-4f1f-8f1f-f1f1f1f1f1f1', '0b0b0b0b-0b0b-4b0b-8b0b-0b0b0b0b0b0b', 'Other org agent', NULL);
INSERT INTO public.agent_versions (org_id, agent_id, version) VALUES
  ('0a0a0a0a-0a0a-4a0a-8a0a-0a0a0a0a0a0a', 'f0f0f0f0-f0f0-4f0f-8f0f-f0f0f0f0f0f0', 'v1');

SET LOCAL ROLE authenticated;

-- ---- qa_analyst cannot start a call
SELECT set_config('request.jwt.claims', '{"sub":"b2b2b2b2-b2b2-4b2b-8b2b-b2b2b2b2b2b2","role":"authenticated"}', true);
SELECT throws_ok($$ SELECT public.start_call() $$, '42501', NULL, 'qa_analyst cannot start a call');

-- ---- a user with no organisation cannot start a call
SELECT set_config('request.jwt.claims', '{"sub":"e5e5e5e5-e5e5-4e5e-8e5e-e5e5e5e5e5e5","role":"authenticated"}', true);
SELECT throws_ok($$ SELECT public.start_call() $$, 'P0003', NULL, 'a user with no organisation cannot start a call');

-- ---- an agent in org A starts a call against the default (oldest) agent
SELECT set_config('request.jwt.claims', '{"sub":"c3c3c3c3-c3c3-4c3c-8c3c-c3c3c3c3c3c3","role":"authenticated"}', true);
SELECT results_eq(
  $$ SELECT org_id, agent_id, agent_version_id, status, channel, started_by FROM public.start_call() $$,
  $$ VALUES (
      '0a0a0a0a-0a0a-4a0a-8a0a-0a0a0a0a0a0a'::uuid,
      'f0f0f0f0-f0f0-4f0f-8f0f-f0f0f0f0f0f0'::uuid,
      (SELECT id FROM public.agent_versions WHERE agent_id = 'f0f0f0f0-f0f0-4f0f-8f0f-f0f0f0f0f0f0' AND version = 'v1'),
      'created'::text, 'browser'::text, 'c3c3c3c3-c3c3-4c3c-8c3c-c3c3c3c3c3c3'::uuid
    ) $$,
  'agent starts a call bound to the org''s default agent and its live version');
SELECT is((SELECT count(*) FROM public.calls WHERE org_id = '0a0a0a0a-0a0a-4a0a-8a0a-0a0a0a0a0a0a' AND started_by = 'c3c3c3c3-c3c3-4c3c-8c3c-c3c3c3c3c3c3'), 1::bigint, 'exactly one call row was created');
SELECT results_eq(
  $$ SELECT type, seq FROM public.call_events ce JOIN public.calls c ON c.id = ce.call_id WHERE c.started_by = 'c3c3c3c3-c3c3-4c3c-8c3c-c3c3c3c3c3c3' $$,
  $$ VALUES ('status.created'::text, 1) $$,
  'a status.created event is logged at seq 1');
SELECT results_eq(
  $$ SELECT recording_allowed, consent_outcome, recording_skip_reason, consent_policy_id FROM public.calls WHERE started_by = 'c3c3c3c3-c3c3-4c3c-8c3c-c3c3c3c3c3c3' $$,
  $$ VALUES (false, NULL::text, 'no consent policy configured'::text, NULL::uuid) $$,
  'with no approved consent policy, the call fails safe: no recording');

-- ---- org_admin can also start a call
SELECT set_config('request.jwt.claims', '{"sub":"a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1","role":"authenticated"}', true);
SELECT lives_ok($$ SELECT public.start_call() $$, 'org_admin can start a call too');

-- ---- an approved disclosure-only policy allows recording immediately
RESET ROLE;
INSERT INTO public.consent_policies (id, org_id, version, disclosure_text, requires_explicit_consent, status) VALUES
  ('c0c0c0c0-c0c0-4c0c-8c0c-c0c0c0c0c0c0', '0a0a0a0a-0a0a-4a0a-8a0a-0a0a0a0a0a0a', 1, 'This call is recorded for quality.', false, 'approved');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1","role":"authenticated"}', true);
SELECT results_eq(
  $$ SELECT recording_allowed, consent_outcome, recording_skip_reason, consent_policy_id FROM public.start_call() $$,
  $$ VALUES (true, NULL::text, NULL::text, 'c0c0c0c0-c0c0-4c0c-8c0c-c0c0c0c0c0c0'::uuid) $$,
  'a disclosure-only approved policy allows recording at creation; consent_outcome stays NULL, no member consent was asked');

-- ---- the same policy, switched to require explicit consent, allows nothing yet
RESET ROLE;
UPDATE public.consent_policies SET requires_explicit_consent = true WHERE id = 'c0c0c0c0-c0c0-4c0c-8c0c-c0c0c0c0c0c0';
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1","role":"authenticated"}', true);
SELECT results_eq(
  $$ SELECT recording_allowed, consent_outcome, recording_skip_reason FROM public.start_call() $$,
  $$ VALUES (false, NULL::text, 'explicit consent required and not yet given'::text) $$,
  'a policy requiring explicit consent does not allow recording at creation');

-- ---- an org with no agents configured refuses to start a call
INSERT INTO public.organisations (id, slug, name) VALUES ('0c0c0c0c-0c0c-4c0c-8c0c-0c0c0c0c0c0c', 'test-c', 'Test C');
INSERT INTO public.org_members (org_id, user_id, role) VALUES ('0c0c0c0c-0c0c-4c0c-8c0c-0c0c0c0c0c0c', 'a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1', 'org_admin');
RESET ROLE;
DELETE FROM public.org_members WHERE org_id = '0a0a0a0a-0a0a-4a0a-8a0a-0a0a0a0a0a0a' AND user_id = 'a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1';
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1","role":"authenticated"}', true);
SELECT throws_ok($$ SELECT public.start_call() $$, 'P0004', NULL, 'an organisation with no agents refuses to start a call');

-- ---- an explicit agent id from another organisation is rejected
SELECT throws_ok($$ SELECT public.start_call('f1f1f1f1-f1f1-4f1f-8f1f-f1f1f1f1f1f1') $$, 'P0002', NULL, 'an agent id belonging to another organisation is rejected');

-- ---- org B sees none of org A's calls or events
RESET ROLE;
INSERT INTO auth.users (id, email, instance_id, aud, role) VALUES ('d4d4d4d4-d4d4-4d4d-8d4d-d4d4d4d4d4d4', 'admin@org-b.test', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated');
INSERT INTO public.org_members (org_id, user_id, role) VALUES ('0b0b0b0b-0b0b-4b0b-8b0b-0b0b0b0b0b0b', 'd4d4d4d4-d4d4-4d4d-8d4d-d4d4d4d4d4d4', 'org_admin');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"d4d4d4d4-d4d4-4d4d-8d4d-d4d4d4d4d4d4","role":"authenticated"}', true);
SELECT is((SELECT count(*) FROM public.calls WHERE org_id = '0a0a0a0a-0a0a-4a0a-8a0a-0a0a0a0a0a0a'), 0::bigint, 'org B cannot see org A''s calls');

SELECT * FROM finish();
ROLLBACK;
