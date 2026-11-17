-- pgTAP tests for append_transcript_segment() and transcript finalisation on
-- a terminal call state.
-- Run with: npx supabase test db   (needs a local stack: npx supabase start)
BEGIN;
SELECT plan(10);

INSERT INTO auth.users (id, email, instance_id, aud, role) VALUES
  ('a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1', 'admin@org-a.test', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
  ('c3c3c3c3-c3c3-4c3c-8c3c-c3c3c3c3c3c3', 'agent@org-a.test', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
  ('d4d4d4d4-d4d4-4d4d-8d4d-d4d4d4d4d4d4', 'admin@org-b.test', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated');

INSERT INTO public.organisations (id, slug, name) VALUES
  ('0a0a0a0a-0a0a-4a0a-8a0a-0a0a0a0a0a0a', 'test-a', 'Test A'),
  ('0b0b0b0b-0b0b-4b0b-8b0b-0b0b0b0b0b0b', 'test-b', 'Test B');
INSERT INTO public.org_members (org_id, user_id, role) VALUES
  ('0a0a0a0a-0a0a-4a0a-8a0a-0a0a0a0a0a0a', 'a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1', 'org_admin'),
  ('0a0a0a0a-0a0a-4a0a-8a0a-0a0a0a0a0a0a', 'c3c3c3c3-c3c3-4c3c-8c3c-c3c3c3c3c3c3', 'agent'),
  ('0b0b0b0b-0b0b-4b0b-8b0b-0b0b0b0b0b0b', 'd4d4d4d4-d4d4-4d4d-8d4d-d4d4d4d4d4d4', 'org_admin');

INSERT INTO public.calls (id, org_id, caller_name, started_by) VALUES
  ('ca11ca11-ca11-4a11-8a11-ca11ca11ca11', '0a0a0a0a-0a0a-4a0a-8a0a-0a0a0a0a0a0a', 'Agent call', 'c3c3c3c3-c3c3-4c3c-8c3c-c3c3c3c3c3c3');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"c3c3c3c3-c3c3-4c3c-8c3c-c3c3c3c3c3c3","role":"authenticated"}', true);

-- ---- first segment creates the transcript
SELECT lives_ok($$ SELECT public.append_transcript_segment('ca11ca11-ca11-4a11-8a11-ca11ca11ca11', 'agent', 'Namaste, this is Meera.') $$,
  'the call owner appends the first segment');
SELECT results_eq(
  $$ SELECT call_id, status FROM public.transcripts WHERE call_id = 'ca11ca11-ca11-4a11-8a11-ca11ca11ca11' $$,
  $$ VALUES ('ca11ca11-ca11-4a11-8a11-ca11ca11ca11'::uuid, 'partial'::text) $$,
  'a transcript is created automatically, starting partial');
SELECT results_eq(
  $$ SELECT seq, speaker, text, is_final FROM public.transcript_segments s JOIN public.transcripts t ON t.id = s.transcript_id WHERE t.call_id = 'ca11ca11-ca11-4a11-8a11-ca11ca11ca11' $$,
  $$ VALUES (1, 'agent'::text, 'Namaste, this is Meera.'::text, true) $$,
  'the segment is recorded at seq 1');

-- ---- a second segment continues the sequence on the same transcript
SELECT lives_ok($$ SELECT public.append_transcript_segment('ca11ca11-ca11-4a11-8a11-ca11ca11ca11', 'agent', 'How can I help today?') $$,
  'a second segment is appended');
SELECT is((SELECT count(*) FROM public.transcripts WHERE call_id = 'ca11ca11-ca11-4a11-8a11-ca11ca11ca11'), 1::bigint, 'still exactly one transcript for the call');
SELECT is((SELECT seq FROM public.transcript_segments s JOIN public.transcripts t ON t.id = s.transcript_id WHERE t.call_id = 'ca11ca11-ca11-4a11-8a11-ca11ca11ca11' ORDER BY seq DESC LIMIT 1), 2, 'the second segment continues the sequence');

-- ---- validation
SELECT throws_ok($$ SELECT public.append_transcript_segment('ca11ca11-ca11-4a11-8a11-ca11ca11ca11', 'translator', 'x') $$,
  '22023', NULL, 'an unknown speaker is rejected');
SELECT throws_ok($$ SELECT public.append_transcript_segment('ca11ca11-ca11-4a11-8a11-ca11ca11ca11', 'agent', '   ') $$,
  '22023', NULL, 'blank text is rejected');

-- ---- someone else in another organisation cannot write to this call
SELECT set_config('request.jwt.claims', '{"sub":"d4d4d4d4-d4d4-4d4d-8d4d-d4d4d4d4d4d4","role":"authenticated"}', true);
SELECT throws_ok($$ SELECT public.append_transcript_segment('ca11ca11-ca11-4a11-8a11-ca11ca11ca11', 'agent', 'x') $$,
  '42501', NULL, 'an org_admin of a different organisation cannot write to this call');

-- ---- finalised when the call reaches a terminal state
SELECT set_config('request.jwt.claims', '{"sub":"c3c3c3c3-c3c3-4c3c-8c3c-c3c3c3c3c3c3","role":"authenticated"}', true);
SELECT public.advance_call('ca11ca11-ca11-4a11-8a11-ca11ca11ca11', 'initializing');
SELECT public.advance_call('ca11ca11-ca11-4a11-8a11-ca11ca11ca11', 'active');
SELECT public.advance_call('ca11ca11-ca11-4a11-8a11-ca11ca11ca11', 'completed');
SELECT is((SELECT status FROM public.transcripts WHERE call_id = 'ca11ca11-ca11-4a11-8a11-ca11ca11ca11'), 'final'::text, 'the transcript is finalised once the call completes');

SELECT * FROM finish();
ROLLBACK;
