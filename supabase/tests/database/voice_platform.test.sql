-- pgTAP tests for the voice-platform migration: role tiers, the call state
-- machine, consent/recording invariants and storage path ownership.
-- Run with: npx supabase test db   (needs a local stack: npx supabase start)
BEGIN;
SELECT plan(18);

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

-- ---- role check constraint
SELECT throws_ok($$ INSERT INTO public.org_members (org_id, user_id, role) VALUES ('0b0b0b0b-0b0b-4b0b-8b0b-0b0b0b0b0b0b', 'a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1', 'admin') $$,
  '23514', NULL, 'the legacy admin role is rejected');

-- ---- qa_analyst: reviews yes, manages no
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"b2b2b2b2-b2b2-4b2b-8b2b-b2b2b2b2b2b2","role":"authenticated"}', true);
SELECT is(public.can_review_org('0a0a0a0a-0a0a-4a0a-8a0a-0a0a0a0a0a0a'), true, 'qa_analyst can review');
SELECT is(public.can_edit_org('0a0a0a0a-0a0a-4a0a-8a0a-0a0a0a0a0a0a'), false, 'qa_analyst cannot edit');
SELECT is(public.can_manage_org('0a0a0a0a-0a0a-4a0a-8a0a-0a0a0a0a0a0a'), false, 'qa_analyst cannot manage');
SELECT lives_ok($$ INSERT INTO public.evaluation_templates (org_id, name, version) VALUES ('0a0a0a0a-0a0a-4a0a-8a0a-0a0a0a0a0a0a', 'Rubric', 1) $$,
  'qa_analyst can create an evaluation template');
SELECT throws_ok($$ INSERT INTO public.consent_policies (org_id, version, disclosure_text) VALUES ('0a0a0a0a-0a0a-4a0a-8a0a-0a0a0a0a0a0a', 1, 'x') $$,
  '42501', NULL, 'qa_analyst cannot create a consent policy');

-- ---- org_admin: manages, and only one approved consent policy at a time
SELECT set_config('request.jwt.claims', '{"sub":"a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1","role":"authenticated"}', true);
SELECT lives_ok($$ INSERT INTO public.consent_policies (org_id, version, disclosure_text, status) VALUES ('0a0a0a0a-0a0a-4a0a-8a0a-0a0a0a0a0a0a', 1, 'Client wording v1', 'approved') $$,
  'org_admin approves a consent policy');
SELECT throws_ok($$ INSERT INTO public.consent_policies (org_id, version, disclosure_text, status) VALUES ('0a0a0a0a-0a0a-4a0a-8a0a-0a0a0a0a0a0a', 2, 'Client wording v2', 'approved') $$,
  '23505', NULL, 'a second approved policy is refused');
SELECT is((SELECT count(*) FROM public.consent_policies), 1::bigint, 'org_admin of A sees only A policies');

-- ---- state machine
SELECT lives_ok($$ SELECT public.advance_call('ca11ca11-ca11-4a11-8a11-ca11ca11ca11', 'initializing') $$, 'created -> initializing');
SELECT lives_ok($$ SELECT public.advance_call('ca11ca11-ca11-4a11-8a11-ca11ca11ca11', 'active') $$, 'initializing -> active');
SELECT lives_ok($$ SELECT public.advance_call('ca11ca11-ca11-4a11-8a11-ca11ca11ca11', 'active') $$, 'repeating a state is a no-op');
SELECT throws_ok($$ SELECT public.advance_call('ca11ca11-ca11-4a11-8a11-ca11ca11ca11', 'created') $$, 'P0001', NULL, 'active -> created is illegal');
SELECT lives_ok($$ SELECT public.advance_call('ca11ca11-ca11-4a11-8a11-ca11ca11ca11', 'completed') $$, 'active -> completed');
SELECT is((SELECT count(*) FROM public.call_events WHERE call_id = 'ca11ca11-ca11-4a11-8a11-ca11ca11ca11'), 3::bigint, 'three transitions logged three events');
SELECT isnt((SELECT ended_at FROM public.calls WHERE id = 'ca11ca11-ca11-4a11-8a11-ca11ca11ca11'), NULL, 'completion stamps ended_at');

-- ---- recording path must belong to its organisation
SELECT throws_ok($$ INSERT INTO public.recordings (org_id, call_id, object_path, consent_outcome) VALUES ('0a0a0a0a-0a0a-4a0a-8a0a-0a0a0a0a0a0a', 'ca11ca11-ca11-4a11-8a11-ca11ca11ca11', 'org/0b0b0b0b-0b0b-4b0b-8b0b-0b0b0b0b0b0b/call/x.webm', 'given') $$,
  '23514', NULL, 'a recording path under another org is rejected');

-- ---- org B admin sees nothing of A
SELECT set_config('request.jwt.claims', '{"sub":"d4d4d4d4-d4d4-4d4d-8d4d-d4d4d4d4d4d4","role":"authenticated"}', true);
SELECT is((SELECT count(*) FROM public.call_events), 0::bigint, 'org B sees no org A events');

SELECT * FROM finish();
ROLLBACK;
