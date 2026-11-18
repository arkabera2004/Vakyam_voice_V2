-- pgTAP tests for consent policy content immutability and approve_consent_policy().
-- Run with: npx supabase test db   (needs a local stack: npx supabase start)
BEGIN;
SELECT plan(11);

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

INSERT INTO public.consent_policies (id, org_id, version, disclosure_text, status) VALUES
  ('c0c0c0c0-c0c0-4c0c-8c0c-c0c0c0c0c0c0', '0a0a0a0a-0a0a-4a0a-8a0a-0a0a0a0a0a0a', 1, 'Version 1 wording.', 'draft'),
  ('c1c1c1c1-c1c1-4c1c-8c1c-c1c1c1c1c1c1', '0a0a0a0a-0a0a-4a0a-8a0a-0a0a0a0a0a0a', 2, 'Version 2 wording.', 'draft');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1","role":"authenticated"}', true);

-- ---- a draft's wording can be freely edited before approval
SELECT lives_ok($$ UPDATE public.consent_policies SET disclosure_text = 'Edited before approval.' WHERE id = 'c0c0c0c0-c0c0-4c0c-8c0c-c0c0c0c0c0c0' $$,
  'a draft policy''s wording can be edited');

-- ---- approving v1
SELECT results_eq($$ SELECT status FROM public.approve_consent_policy('c0c0c0c0-c0c0-4c0c-8c0c-c0c0c0c0c0c0') $$, $$ VALUES ('approved'::text) $$, 'v1 is approved');
SELECT is((SELECT count(*) FROM public.audit_log WHERE change LIKE 'consent_policy.approved%'), 1::bigint, 'approval is audited');

-- ---- an approved policy's wording is now frozen
SELECT throws_ok($$ UPDATE public.consent_policies SET disclosure_text = 'Changed after approval.' WHERE id = 'c0c0c0c0-c0c0-4c0c-8c0c-c0c0c0c0c0c0' $$,
  '0A000', 'an approved consent policy''s wording cannot be changed; approve a new version instead', 'an approved policy''s content is immutable');
SELECT throws_ok($$ UPDATE public.consent_policies SET requires_explicit_consent = false WHERE id = 'c0c0c0c0-c0c0-4c0c-8c0c-c0c0c0c0c0c0' $$,
  '0A000', NULL, 'requires_explicit_consent is also frozen once approved');

-- ---- approving v2 retires v1 automatically; only one approved policy at a time
SELECT lives_ok($$ SELECT public.approve_consent_policy('c1c1c1c1-c1c1-4c1c-8c1c-c1c1c1c1c1c1') $$, 'approving v2 does not throw');
SELECT is((SELECT status FROM public.consent_policies WHERE id = 'c0c0c0c0-c0c0-4c0c-8c0c-c0c0c0c0c0c0'), 'retired'::text, 'v1 is automatically retired when v2 is approved');
SELECT is((SELECT count(*) FROM public.consent_policies WHERE org_id = '0a0a0a0a-0a0a-4a0a-8a0a-0a0a0a0a0a0a' AND status = 'approved'), 1::bigint, 'exactly one approved policy exists');

-- ---- a retired policy cannot be re-approved
SELECT throws_ok($$ SELECT public.approve_consent_policy('c0c0c0c0-c0c0-4c0c-8c0c-c0c0c0c0c0c0') $$,
  'P0001', NULL, 'a retired policy cannot be re-approved');

-- ---- an agent (not a manager) cannot approve
SELECT set_config('request.jwt.claims', '{"sub":"c3c3c3c3-c3c3-4c3c-8c3c-c3c3c3c3c3c3","role":"authenticated"}', true);
SELECT throws_ok($$ SELECT public.approve_consent_policy('c1c1c1c1-c1c1-4c1c-8c1c-c1c1c1c1c1c1') $$,
  '42501', NULL, 'an agent cannot approve a consent policy');

-- ---- org B admin cannot approve org A's policy
SELECT set_config('request.jwt.claims', '{"sub":"d4d4d4d4-d4d4-4d4d-8d4d-d4d4d4d4d4d4","role":"authenticated"}', true);
SELECT throws_ok($$ SELECT public.approve_consent_policy('c1c1c1c1-c1c1-4c1c-8c1c-c1c1c1c1c1c1') $$,
  '42501', NULL, 'org B admin cannot approve org A''s policy');

SELECT * FROM finish();
ROLLBACK;
