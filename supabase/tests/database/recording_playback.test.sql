-- pgTAP tests for can_play_recording_object(), which the storage RLS policy
-- on the 'recordings' bucket now uses directly.
-- Run with: npx supabase test db   (needs a local stack: npx supabase start)
BEGIN;
SELECT plan(7);

INSERT INTO auth.users (id, email, instance_id, aud, role) VALUES
  ('b2b2b2b2-b2b2-4b2b-8b2b-b2b2b2b2b2b2', 'qa@org-a.test',     '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
  ('c3c3c3c3-c3c3-4c3c-8c3c-c3c3c3c3c3c3', 'agent@org-a.test',  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
  ('c4c4c4c4-c4c4-4c4c-8c4c-c4c4c4c4c4c4', 'agent2@org-a.test', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
  ('d4d4d4d4-d4d4-4d4d-8d4d-d4d4d4d4d4d4', 'admin@org-b.test',  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated');

INSERT INTO public.organisations (id, slug, name) VALUES
  ('0a0a0a0a-0a0a-4a0a-8a0a-0a0a0a0a0a0a', 'test-a', 'Test A'),
  ('0b0b0b0b-0b0b-4b0b-8b0b-0b0b0b0b0b0b', 'test-b', 'Test B');
INSERT INTO public.org_members (org_id, user_id, role) VALUES
  ('0a0a0a0a-0a0a-4a0a-8a0a-0a0a0a0a0a0a', 'b2b2b2b2-b2b2-4b2b-8b2b-b2b2b2b2b2b2', 'qa_analyst'),
  ('0a0a0a0a-0a0a-4a0a-8a0a-0a0a0a0a0a0a', 'c3c3c3c3-c3c3-4c3c-8c3c-c3c3c3c3c3c3', 'agent'),
  ('0a0a0a0a-0a0a-4a0a-8a0a-0a0a0a0a0a0a', 'c4c4c4c4-c4c4-4c4c-8c4c-c4c4c4c4c4c4', 'agent'),
  ('0b0b0b0b-0b0b-4b0b-8b0b-0b0b0b0b0b0b', 'd4d4d4d4-d4d4-4d4d-8d4d-d4d4d4d4d4d4', 'org_admin');

INSERT INTO public.calls (id, org_id, caller_name, started_by) VALUES
  ('ca11ca11-ca11-4a11-8a11-ca11ca11ca11', '0a0a0a0a-0a0a-4a0a-8a0a-0a0a0a0a0a0a', 'Agent call', 'c3c3c3c3-c3c3-4c3c-8c3c-c3c3c3c3c3c3');
INSERT INTO public.recordings (org_id, call_id, object_path, consent_outcome) VALUES
  ('0a0a0a0a-0a0a-4a0a-8a0a-0a0a0a0a0a0a', 'ca11ca11-ca11-4a11-8a11-ca11ca11ca11', 'org/0a0a0a0a-0a0a-4a0a-8a0a-0a0a0a0a0a0a/call/ca11ca11.webm', 'given');

SET LOCAL ROLE authenticated;

-- ---- a qa_analyst (a reviewer) can play any recording in their org
SELECT set_config('request.jwt.claims', '{"sub":"b2b2b2b2-b2b2-4b2b-8b2b-b2b2b2b2b2b2","role":"authenticated"}', true);
SELECT is(public.can_play_recording_object('org/0a0a0a0a-0a0a-4a0a-8a0a-0a0a0a0a0a0a/call/ca11ca11.webm'), true, 'a qa_analyst (reviewer tier) can play any recording in their org');

-- ---- the agent who started the call can play their own recording
SELECT set_config('request.jwt.claims', '{"sub":"c3c3c3c3-c3c3-4c3c-8c3c-c3c3c3c3c3c3","role":"authenticated"}', true);
SELECT is(public.can_play_recording_object('org/0a0a0a0a-0a0a-4a0a-8a0a-0a0a0a0a0a0a/call/ca11ca11.webm'), true, 'the agent who started the call can play their own recording');

-- ---- a different agent in the same org cannot play a call they did not start
SELECT set_config('request.jwt.claims', '{"sub":"c4c4c4c4-c4c4-4c4c-8c4c-c4c4c4c4c4c4","role":"authenticated"}', true);
SELECT is(public.can_play_recording_object('org/0a0a0a0a-0a0a-4a0a-8a0a-0a0a0a0a0a0a/call/ca11ca11.webm'), false, 'a different agent cannot play a call they did not start');

-- ---- org B admin cannot play org A's recording
SELECT set_config('request.jwt.claims', '{"sub":"d4d4d4d4-d4d4-4d4d-8d4d-d4d4d4d4d4d4","role":"authenticated"}', true);
SELECT is(public.can_play_recording_object('org/0a0a0a0a-0a0a-4a0a-8a0a-0a0a0a0a0a0a/call/ca11ca11.webm'), false, 'org B admin cannot play org A''s recording');

-- ---- an unrecognised object path is refused, not mistakenly allowed
SELECT set_config('request.jwt.claims', '{"sub":"b2b2b2b2-b2b2-4b2b-8b2b-b2b2b2b2b2b2","role":"authenticated"}', true);
SELECT is(public.can_play_recording_object('not-a-recognised-path'), false, 'a path with no recognisable org segment is refused');

-- ---- a non-member cannot play any recording, even one that exists
RESET ROLE;
INSERT INTO auth.users (id, email, instance_id, aud, role) VALUES ('e5e5e5e5-e5e5-4e5e-8e5e-e5e5e5e5e5e5', 'nobody@nowhere.test', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"e5e5e5e5-e5e5-4e5e-8e5e-e5e5e5e5e5e5","role":"authenticated"}', true);
SELECT is(public.can_play_recording_object('org/0a0a0a0a-0a0a-4a0a-8a0a-0a0a0a0a0a0a/call/ca11ca11.webm'), false, 'a user with no organisation membership cannot play the recording');

-- ---- an agent trying a path for a recording that does not exist gets false, not an error
SELECT is(public.can_play_recording_object('org/0a0a0a0a-0a0a-4a0a-8a0a-0a0a0a0a0a0a/call/does-not-exist.webm'), false, 'a nonexistent recording path returns false rather than raising');

SELECT * FROM finish();
ROLLBACK;
