-- pgTAP tests for create_recording().
-- Run with: npx supabase test db   (needs a local stack: npx supabase start)
BEGIN;
SELECT plan(9);

INSERT INTO auth.users (id, email, instance_id, aud, role) VALUES
  ('a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1', 'admin@org-a.test', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
  ('c3c3c3c3-c3c3-4c3c-8c3c-c3c3c3c3c3c3', 'agent@org-a.test', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
  ('c4c4c4c4-c4c4-4c4c-8c4c-c4c4c4c4c4c4', 'agent2@org-a.test', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
  ('d4d4d4d4-d4d4-4d4d-8d4d-d4d4d4d4d4d4', 'admin@org-b.test', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated');

INSERT INTO public.organisations (id, slug, name) VALUES
  ('0a0a0a0a-0a0a-4a0a-8a0a-0a0a0a0a0a0a', 'test-a', 'Test A'),
  ('0b0b0b0b-0b0b-4b0b-8b0b-0b0b0b0b0b0b', 'test-b', 'Test B');
INSERT INTO public.org_members (org_id, user_id, role) VALUES
  ('0a0a0a0a-0a0a-4a0a-8a0a-0a0a0a0a0a0a', 'a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1', 'org_admin'),
  ('0a0a0a0a-0a0a-4a0a-8a0a-0a0a0a0a0a0a', 'c3c3c3c3-c3c3-4c3c-8c3c-c3c3c3c3c3c3', 'agent'),
  ('0a0a0a0a-0a0a-4a0a-8a0a-0a0a0a0a0a0a', 'c4c4c4c4-c4c4-4c4c-8c4c-c4c4c4c4c4c4', 'agent'),
  ('0b0b0b0b-0b0b-4b0b-8b0b-0b0b0b0b0b0b', 'd4d4d4d4-d4d4-4d4d-8d4d-d4d4d4d4d4d4', 'org_admin');

INSERT INTO public.calls (id, org_id, caller_name, started_by, recording_allowed, consent_outcome) VALUES
  ('ca11ca11-ca11-4a11-8a11-ca11ca11ca11', '0a0a0a0a-0a0a-4a0a-8a0a-0a0a0a0a0a0a', 'Allowed call', 'c3c3c3c3-c3c3-4c3c-8c3c-c3c3c3c3c3c3', true, NULL),
  ('cb11cb11-cb11-4b11-8b11-cb11cb11cb11', '0a0a0a0a-0a0a-4a0a-8a0a-0a0a0a0a0a0a', 'Not allowed call', 'c3c3c3c3-c3c3-4c3c-8c3c-c3c3c3c3c3c3', false, NULL),
  ('cc11cc11-cc11-4c11-8c11-cc11cc11cc11', '0a0a0a0a-0a0a-4a0a-8a0a-0a0a0a0a0a0a', 'Second allowed call', 'c3c3c3c3-c3c3-4c3c-8c3c-c3c3c3c3c3c3', true, 'given');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"c3c3c3c3-c3c3-4c3c-8c3c-c3c3c3c3c3c3","role":"authenticated"}', true);

-- ---- the agent who started the call can create its recording
SELECT results_eq(
  $$ SELECT status, consent_outcome FROM public.create_recording('ca11ca11-ca11-4a11-8a11-ca11ca11ca11', 'org/0a0a0a0a-0a0a-4a0a-8a0a-0a0a0a0a0a0a/call/ca11ca11.webm', 'audio/webm', 240000, 404000, 'sha-abc') $$,
  $$ VALUES ('uploaded'::text, 'not_required'::text) $$,
  'the agent who started the call creates its recording');
SELECT is((SELECT count(*) FROM public.audit_log WHERE change LIKE 'recording.created%'), 1::bigint, 'recording creation is audited');

-- ---- recording is refused when the call does not allow it
SELECT throws_ok($$ SELECT public.create_recording('cb11cb11-cb11-4b11-8b11-cb11cb11cb11', 'org/0a0a0a0a-0a0a-4a0a-8a0a-0a0a0a0a0a0a/call/cb11cb11.webm') $$,
  'P0001', NULL, 'recording is refused when calls.recording_allowed is false');

-- ---- a path outside this call's organisation is refused
SELECT throws_ok($$ SELECT public.create_recording('ca11ca11-ca11-4a11-8a11-ca11ca11ca11', 'org/0b0b0b0b-0b0b-4b0b-8b0b-0b0b0b0b0b0b/call/x.webm') $$,
  '22023', NULL, 'a path outside the call''s own organisation is refused');

-- ---- an unknown call is refused
SELECT throws_ok($$ SELECT public.create_recording('00000000-0000-4000-8000-000000000099', 'org/0a0a0a0a-0a0a-4a0a-8a0a-0a0a0a0a0a0a/call/x.webm') $$,
  'P0002', NULL, 'an unknown call is refused');

-- ---- a different agent cannot create a recording for a call they did not start
SELECT set_config('request.jwt.claims', '{"sub":"c4c4c4c4-c4c4-4c4c-8c4c-c4c4c4c4c4c4","role":"authenticated"}', true);
SELECT throws_ok($$ SELECT public.create_recording('ca11ca11-ca11-4a11-8a11-ca11ca11ca11', 'org/0a0a0a0a-0a0a-4a0a-8a0a-0a0a0a0a0a0a/call/again.webm') $$,
  '42501', NULL, 'a different agent cannot create a recording for a call they did not start');

-- ---- org_admin (an editor) can create a recording for any call in the org,
-- including one they did not start, and 'given' consent carries through
SELECT set_config('request.jwt.claims', '{"sub":"a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1","role":"authenticated"}', true);
SELECT results_eq(
  $$ SELECT consent_outcome FROM public.create_recording('cc11cc11-cc11-4c11-8c11-cc11cc11cc11', 'org/0a0a0a0a-0a0a-4a0a-8a0a-0a0a0a0a0a0a/call/second.webm') $$,
  $$ VALUES ('given'::text) $$,
  'org_admin creates a recording for a call they did not start, and a given consent outcome carries through');

-- ---- org B admin cannot create a recording for org A's call
SELECT set_config('request.jwt.claims', '{"sub":"d4d4d4d4-d4d4-4d4d-8d4d-d4d4d4d4d4d4","role":"authenticated"}', true);
SELECT throws_ok($$ SELECT public.create_recording('ca11ca11-ca11-4a11-8a11-ca11ca11ca11', 'org/0a0a0a0a-0a0a-4a0a-8a0a-0a0a0a0a0a0a/call/x.webm') $$,
  '42501', NULL, 'org B admin cannot create a recording for org A''s call');

-- ---- the recording row carries the call's own org, enforcing isolation downstream
SELECT set_config('request.jwt.claims', '{"sub":"a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1","role":"authenticated"}', true);
SELECT is((SELECT org_id FROM public.recordings WHERE call_id = 'ca11ca11-ca11-4a11-8a11-ca11ca11ca11' LIMIT 1), '0a0a0a0a-0a0a-4a0a-8a0a-0a0a0a0a0a0a'::uuid, 'the recording row carries the call''s own organisation');

SELECT * FROM finish();
ROLLBACK;
