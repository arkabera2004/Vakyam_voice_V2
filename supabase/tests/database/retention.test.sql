-- pgTAP tests for legal hold and retention_runs visibility.
-- Run with: npx supabase test db   (needs a local stack: npx supabase start)
BEGIN;
SELECT plan(9);

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
INSERT INTO public.recordings (id, org_id, call_id, object_path, consent_outcome) VALUES
  ('aa11aa11-aa11-4a11-8a11-aa11aa11aa11', '0a0a0a0a-0a0a-4a0a-8a0a-0a0a0a0a0a0a', 'ca11ca11-ca11-4a11-8a11-ca11ca11ca11', 'org/0a0a0a0a-0a0a-4a0a-8a0a-0a0a0a0a0a0a/call/x.webm', 'given');

-- ---- agent (not a manager) cannot place a legal hold
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"c3c3c3c3-c3c3-4c3c-8c3c-c3c3c3c3c3c3","role":"authenticated"}', true);
SELECT throws_ok($$ SELECT public.set_legal_hold('recording', 'aa11aa11-aa11-4a11-8a11-aa11aa11aa11', true) $$,
  '42501', NULL, 'agent cannot place a legal hold');

-- ---- org_admin of A can; org_admin of B cannot touch A's row
SELECT set_config('request.jwt.claims', '{"sub":"a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1","role":"authenticated"}', true);
SELECT is(public.set_legal_hold('recording', 'aa11aa11-aa11-4a11-8a11-aa11aa11aa11', true), true, 'org_admin places a legal hold');
SELECT is((SELECT legal_hold FROM public.recordings WHERE id = 'aa11aa11-aa11-4a11-8a11-aa11aa11aa11'), true, 'the hold is persisted');
SELECT is((SELECT count(*) FROM public.audit_log WHERE change LIKE 'recording.legal_hold%'), 1::bigint, 'the hold is audited');
SELECT is(public.set_legal_hold('recording', 'aa11aa11-aa11-4a11-8a11-aa11aa11aa11', false), false, 'org_admin lifts the hold');

SELECT set_config('request.jwt.claims', '{"sub":"d4d4d4d4-d4d4-4d4d-8d4d-d4d4d4d4d4d4","role":"authenticated"}', true);
SELECT throws_ok($$ SELECT public.set_legal_hold('recording', 'aa11aa11-aa11-4a11-8a11-aa11aa11aa11', true) $$,
  '42501', NULL, 'org_admin of a different org cannot place a hold on it');
SELECT throws_ok($$ SELECT public.set_legal_hold('widget', 'aa11aa11-aa11-4a11-8a11-aa11aa11aa11', true) $$,
  '22023', NULL, 'an unknown target is rejected');

-- ---- retention_runs: reviewers of the org read theirs, nothing else
RESET ROLE;
INSERT INTO public.retention_runs (org_id, target, mode, cutoff, eligible_count, skipped) VALUES
  ('0a0a0a0a-0a0a-4a0a-8a0a-0a0a0a0a0a0a', 'recording', 'dry-run', now(), 1, '[]'::jsonb);
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1","role":"authenticated"}', true);
SELECT is((SELECT count(*) FROM public.retention_runs), 1::bigint, 'org_admin of A sees the run');
SELECT set_config('request.jwt.claims', '{"sub":"d4d4d4d4-d4d4-4d4d-8d4d-d4d4d4d4d4d4","role":"authenticated"}', true);
SELECT is((SELECT count(*) FROM public.retention_runs), 0::bigint, 'org_admin of B sees none of it');

SELECT * FROM finish();
ROLLBACK;
