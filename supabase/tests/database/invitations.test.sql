-- pgTAP tests for the invitation lifecycle: role guard, acceptance on email
-- confirmation, expiry, and member deactivation.
-- Run with: npx supabase test db   (needs a local stack: npx supabase start)
BEGIN;
SELECT plan(14);

INSERT INTO auth.users (id, email, instance_id, aud, role, email_confirmed_at) VALUES
  ('a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1', 'admin@org-a.test', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', now()),
  ('c3c3c3c3-c3c3-4c3c-8c3c-c3c3c3c3c3c3', 'agent@org-a.test', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', now());
INSERT INTO public.organisations (id, slug, name) VALUES ('0a0a0a0a-0a0a-4a0a-8a0a-0a0a0a0a0a0a', 'test-a', 'Test A');
INSERT INTO public.org_members (org_id, user_id, role) VALUES
  ('0a0a0a0a-0a0a-4a0a-8a0a-0a0a0a0a0a0a', 'a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1', 'org_admin'),
  ('0a0a0a0a-0a0a-4a0a-8a0a-0a0a0a0a0a0a', 'c3c3c3c3-c3c3-4c3c-8c3c-c3c3c3c3c3c3', 'agent');

-- ---- as the org_admin
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1","role":"authenticated"}', true);

SELECT lives_ok($$ INSERT INTO public.invitations (org_id, email, role, invited_by) VALUES ('0a0a0a0a-0a0a-4a0a-8a0a-0a0a0a0a0a0a', 'New.Agent@org-a.test', 'agent', 'a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1') $$,
  'org_admin invites an agent');
SELECT throws_ok($$ INSERT INTO public.invitations (org_id, email, role) VALUES ('0a0a0a0a-0a0a-4a0a-8a0a-0a0a0a0a0a0a', 'new.agent@org-a.test', 'supervisor') $$,
  '23505', NULL, 'a second pending invitation for the same address (any case) is refused');
SELECT throws_ok($$ INSERT INTO public.invitations (org_id, email, role) VALUES ('0a0a0a0a-0a0a-4a0a-8a0a-0a0a0a0a0a0a', 'boss@org-a.test', 'super_admin') $$,
  '42501', NULL, 'org_admin cannot invite a super_admin');
SELECT lives_ok($$ INSERT INTO public.invitations (org_id, email, role, expires_at) VALUES ('0a0a0a0a-0a0a-4a0a-8a0a-0a0a0a0a0a0a', 'late@org-a.test', 'qa_analyst', now() - interval '1 day') $$,
  'an already-expired invitation can exist (for the expiry test)');
SELECT is((SELECT expires_at > now() + interval '6 days' FROM public.invitations WHERE email = 'new.agent@org-a.test'), true, 'invitations expire in seven days by default');

-- ---- deactivation
SELECT throws_ok($$ SELECT public.set_member_status('0a0a0a0a-0a0a-4a0a-8a0a-0a0a0a0a0a0a', 'a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1', 'disabled') $$,
  'P0001', NULL, 'an admin cannot disable themselves');
SELECT lives_ok($$ SELECT public.set_member_status('0a0a0a0a-0a0a-4a0a-8a0a-0a0a0a0a0a0a', 'c3c3c3c3-c3c3-4c3c-8c3c-c3c3c3c3c3c3', 'disabled') $$,
  'org_admin disables the agent');
SELECT is((SELECT count(*) FROM public.audit_log WHERE change LIKE 'member.disabled %'), 1::bigint, 'deactivation is audited');

-- ---- as the disabled agent: no role, no rows
SELECT set_config('request.jwt.claims', '{"sub":"c3c3c3c3-c3c3-4c3c-8c3c-c3c3c3c3c3c3","role":"authenticated"}', true);
SELECT is(public.org_role('0a0a0a0a-0a0a-4a0a-8a0a-0a0a0a0a0a0a'), NULL, 'a disabled member has no role');
SELECT is((SELECT count(*) FROM public.organisations), 0::bigint, 'a disabled member sees no organisation');
SELECT throws_ok($$ SELECT public.set_member_status('0a0a0a0a-0a0a-4a0a-8a0a-0a0a0a0a0a0a', 'a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1', 'disabled') $$,
  '42501', NULL, 'a non-manager cannot change membership status');

-- ---- acceptance happens when Auth confirms the invited address
RESET ROLE;
INSERT INTO auth.users (id, email, instance_id, aud, role) VALUES
  ('e5e5e5e5-e5e5-4e5e-8e5e-e5e5e5e5e5e5', 'new.agent@org-a.test', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
  ('f6f6f6f6-f6f6-4f6f-8f6f-f6f6f6f6f6f6', 'late@org-a.test',      '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated');
SELECT is((SELECT count(*) FROM public.org_members WHERE user_id = 'e5e5e5e5-e5e5-4e5e-8e5e-e5e5e5e5e5e5'), 0::bigint, 'an unconfirmed invitee has no membership');

UPDATE auth.users SET email_confirmed_at = now() WHERE id IN ('e5e5e5e5-e5e5-4e5e-8e5e-e5e5e5e5e5e5', 'f6f6f6f6-f6f6-4f6f-8f6f-f6f6f6f6f6f6');
SELECT results_eq(
  $$ SELECT role, status FROM public.org_members WHERE user_id = 'e5e5e5e5-e5e5-4e5e-8e5e-e5e5e5e5e5e5' $$,
  $$ VALUES ('agent'::text, 'active'::text) $$,
  'confirmation creates the membership with the invited role');
SELECT results_eq(
  $$ SELECT status, accepted_user_id FROM public.invitations WHERE email = 'new.agent@org-a.test' $$,
  $$ VALUES ('accepted'::text, 'e5e5e5e5-e5e5-4e5e-8e5e-e5e5e5e5e5e5'::uuid) $$,
  'the invitation is marked accepted by that user');
SELECT results_eq(
  $$ SELECT i.status, (SELECT count(*) FROM public.org_members m WHERE m.user_id = 'f6f6f6f6-f6f6-4f6f-8f6f-f6f6f6f6f6f6') FROM public.invitations i WHERE i.email = 'late@org-a.test' $$,
  $$ VALUES ('expired'::text, 0::bigint) $$,
  'an expired invitation is marked expired and grants no membership');

SELECT * FROM finish();
ROLLBACK;
