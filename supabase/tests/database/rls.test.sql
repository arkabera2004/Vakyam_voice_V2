-- pgTAP row-level-security tests for the organisation-scoped schema.
-- Run with: npx supabase test db   (needs a local stack: npx supabase start)
BEGIN;
SELECT plan(15);

-- Two users, two organisations.
INSERT INTO auth.users (id, email, instance_id, aud, role)
VALUES
  ('11111111-1111-4111-8111-111111111111', 'alice@example.test', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
  ('22222222-2222-4222-8222-222222222222', 'bob@example.test',   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
  ('33333333-3333-4333-8333-333333333333', 'carol@example.test', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated');

INSERT INTO public.organisations (id, slug, name)
VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'org-a', 'Org A'),
       ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'org-b', 'Org B');

INSERT INTO public.org_members (org_id, user_id, role)
VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '11111111-1111-4111-8111-111111111111', 'supervisor'),
       ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '22222222-2222-4222-8222-222222222222', 'supervisor'),
       ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '33333333-3333-4333-8333-333333333333', 'agent');

INSERT INTO public.policy_gates (org_id, name) VALUES
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Gate A'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Gate B');
INSERT INTO public.calls (org_id, caller_name) VALUES
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Caller A'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Caller B');
INSERT INTO public.audit_log (org_id, actor_name, change) VALUES
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'seed', 'A seeded'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'seed', 'B seeded');

-- ---- Alice (supervisor of A)
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}', true);

SELECT is((SELECT count(*) FROM public.organisations), 1::bigint, 'Alice sees only her organisation');
SELECT is((SELECT count(*) FROM public.policy_gates), 1::bigint, 'Alice sees only org A gates');
SELECT is((SELECT name FROM public.policy_gates), 'Gate A', 'and it is Gate A');
SELECT is((SELECT count(*) FROM public.calls), 1::bigint, 'Alice sees only org A calls');
SELECT is((SELECT count(*) FROM public.audit_log), 1::bigint, 'Alice sees only org A audit rows');

SELECT lives_ok($$ UPDATE public.policy_gates SET enabled = false WHERE name = 'Gate A' $$, 'a supervisor can edit her org gates');
SELECT is((SELECT count(*) FROM public.policy_gates WHERE org_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'), 0::bigint, 'cross-org rows are invisible, not just read-only');
SELECT throws_ok($$ INSERT INTO public.policy_gates (org_id, name) VALUES ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Smuggled') $$,
  '42501', NULL, 'Alice cannot insert into org B');
SELECT throws_ok($$ INSERT INTO public.audit_log (org_id, actor_name, change) VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'alice', 'direct') $$,
  '42501', NULL, 'the audit log cannot be written directly');
SELECT lives_ok($$ SELECT public.log_audit('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'via rpc', 'T1') $$, 'log_audit writes for a member');
SELECT is((SELECT actor_id FROM public.audit_log WHERE change = 'via rpc'), '11111111-1111-4111-8111-111111111111'::uuid, 'log_audit stamps auth.uid()');
SELECT throws_ok($$ SELECT public.log_audit('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'sneaky', 'T2') $$,
  '42501', NULL, 'log_audit refuses a non-member');

-- ---- Carol (agent of A): reads, cannot write
SELECT set_config('request.jwt.claims', '{"sub":"33333333-3333-4333-8333-333333333333","role":"authenticated"}', true);
SELECT is((SELECT count(*) FROM public.policy_gates), 1::bigint, 'an agent reads her org gates');
-- An UPDATE blocked by a USING policy silently matches no rows, so count them.
SELECT is((WITH u AS (UPDATE public.policy_gates SET enabled = true WHERE name = 'Gate A' RETURNING 1) SELECT count(*) FROM u),
  0::bigint, 'an agent cannot update gates');
SELECT is((SELECT enabled FROM public.policy_gates WHERE name = 'Gate A'), false, 'and the gate is unchanged');

SELECT * FROM finish();
ROLLBACK;
