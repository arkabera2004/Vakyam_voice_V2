-- pgTAP tests for enqueue_crm_sync().
-- Run with: npx supabase test db   (needs a local stack: npx supabase start)
BEGIN;
SELECT plan(9);

INSERT INTO auth.users (id, email, instance_id, aud, role) VALUES
  ('a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1', 'admin@org-a.test', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
  ('b2b2b2b2-b2b2-4b2b-8b2b-b2b2b2b2b2b2', 'qa@org-a.test',    '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
  ('d4d4d4d4-d4d4-4d4d-8d4d-d4d4d4d4d4d4', 'admin@org-b.test', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated');

INSERT INTO public.organisations (id, slug, name) VALUES
  ('0a0a0a0a-0a0a-4a0a-8a0a-0a0a0a0a0a0a', 'test-a', 'Test A'),
  ('0b0b0b0b-0b0b-4b0b-8b0b-0b0b0b0b0b0b', 'test-b', 'Test B');
INSERT INTO public.org_members (org_id, user_id, role) VALUES
  ('0a0a0a0a-0a0a-4a0a-8a0a-0a0a0a0a0a0a', 'a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1', 'org_admin'),
  ('0a0a0a0a-0a0a-4a0a-8a0a-0a0a0a0a0a0a', 'b2b2b2b2-b2b2-4b2b-8b2b-b2b2b2b2b2b2', 'qa_analyst'),
  ('0b0b0b0b-0b0b-4b0b-8b0b-0b0b0b0b0b0b', 'd4d4d4d4-d4d4-4d4d-8d4d-d4d4d4d4d4d4', 'org_admin');

INSERT INTO public.crm_integrations (id, org_id, name, provider_key, status) VALUES
  ('f0f0f0f0-f0f0-4f0f-8f0f-f0f0f0f0f0f0', '0a0a0a0a-0a0a-4a0a-8a0a-0a0a0a0a0a0a', 'Mock CRM', 'mock', 'enabled'),
  ('f1f1f1f1-f1f1-4f1f-8f1f-f1f1f1f1f1f1', '0a0a0a0a-0a0a-4a0a-8a0a-0a0a0a0a0a0a', 'Disabled CRM', 'mock', 'disabled');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1","role":"authenticated"}', true);

-- ---- validation
SELECT throws_ok($$ SELECT public.enqueue_crm_sync('f1f1f1f1-f1f1-4f1f-8f1f-f1f1f1f1f1f1', 'call.completed') $$,
  'P0001', NULL, 'a disabled integration refuses a sync job');
SELECT throws_ok($$ SELECT public.enqueue_crm_sync('00000000-0000-4000-8000-000000000099', 'call.completed') $$,
  'P0002', NULL, 'an unknown integration is refused');
SELECT throws_ok($$ SELECT public.enqueue_crm_sync('f0f0f0f0-f0f0-4f0f-8f0f-f0f0f0f0f0f0', '') $$,
  '22023', NULL, 'an empty trigger is refused');

-- ---- a qa_analyst cannot enqueue a sync (can_edit_org is managers + supervisor only)
SELECT set_config('request.jwt.claims', '{"sub":"b2b2b2b2-b2b2-4b2b-8b2b-b2b2b2b2b2b2","role":"authenticated"}', true);
SELECT throws_ok($$ SELECT public.enqueue_crm_sync('f0f0f0f0-f0f0-4f0f-8f0f-f0f0f0f0f0f0', 'call.completed') $$,
  '42501', NULL, 'a qa_analyst cannot enqueue a sync job');

-- ---- org_admin enqueues a real job
SELECT set_config('request.jwt.claims', '{"sub":"a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1","role":"authenticated"}', true);
SELECT results_eq(
  $$ SELECT integration_id, trigger, status, attempts FROM public.enqueue_crm_sync('f0f0f0f0-f0f0-4f0f-8f0f-f0f0f0f0f0f0', 'call.completed', '{"call_id":"x"}'::jsonb, 'job-1') $$,
  $$ VALUES ('f0f0f0f0-f0f0-4f0f-8f0f-f0f0f0f0f0f0'::uuid, 'call.completed'::text, 'queued'::text, 0) $$,
  'a real job is queued with the given trigger and payload');

-- ---- a generated idempotency key is used when none is given
SELECT isnt((SELECT idempotency_key FROM public.enqueue_crm_sync('f0f0f0f0-f0f0-4f0f-8f0f-f0f0f0f0f0f0', 'call.completed')), NULL, 'a generated idempotency key is used when none is given');

-- ---- replaying the same key returns the original job, not a duplicate
SELECT is((SELECT count(*) FROM public.crm_sync_jobs WHERE idempotency_key = 'job-1'), 1::bigint, 'exactly one job exists for job-1 before the replay');
SELECT lives_ok($$ SELECT public.enqueue_crm_sync('f0f0f0f0-f0f0-4f0f-8f0f-f0f0f0f0f0f0', 'call.completed', '{}'::jsonb, 'job-1') $$,
  'replaying the same idempotency key does not throw');
SELECT is((SELECT count(*) FROM public.crm_sync_jobs WHERE idempotency_key = 'job-1'), 1::bigint, 'the replay created no second job');

SELECT * FROM finish();
ROLLBACK;
