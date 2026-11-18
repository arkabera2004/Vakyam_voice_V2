-- pgTAP tests for agent_versions immutability and publish_agent_version().
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

INSERT INTO public.agents (id, org_id, name, live_version) VALUES
  ('f0f0f0f0-f0f0-4f0f-8f0f-f0f0f0f0f0f0', '0a0a0a0a-0a0a-4a0a-8a0a-0a0a0a0a0a0a', 'Meera', 'v1');
INSERT INTO public.agent_versions (id, org_id, agent_id, version, prompt) VALUES
  ('e0e0e0e0-e0e0-4e0e-8e0e-e0e0e0e0e0e0', '0a0a0a0a-0a0a-4a0a-8a0a-0a0a0a0a0a0a', 'f0f0f0f0-f0f0-4f0f-8f0f-f0f0f0f0f0f0', 'v1', 'Be warm.'),
  ('e1e1e1e1-e1e1-4e1e-8e1e-e1e1e1e1e1e1', '0a0a0a0a-0a0a-4a0a-8a0a-0a0a0a0a0a0a', 'f0f0f0f0-f0f0-4f0f-8f0f-f0f0f0f0f0f0', 'v2', 'Be warm and brief.');

SET LOCAL ROLE authenticated;

-- ---- immutability: no one, not even the org_admin who created it, can update a version
SELECT set_config('request.jwt.claims', '{"sub":"a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1","role":"authenticated"}', true);
SELECT throws_ok($$ UPDATE public.agent_versions SET prompt = 'Changed after the fact' WHERE id = 'e0e0e0e0-e0e0-4e0e-8e0e-e0e0e0e0e0e0' $$,
  '0A000', 'agent_versions rows are immutable once created; publish a new version instead', 'updating any agent_versions row is refused, published or not');
SELECT is((SELECT prompt FROM public.agent_versions WHERE id = 'e0e0e0e0-e0e0-4e0e-8e0e-e0e0e0e0e0e0'), 'Be warm.', 'the row is unchanged after the refused update');

-- ---- a new configuration is a new row, not an edit (RLS already permits this insert)
SELECT lives_ok($$ INSERT INTO public.agent_versions (org_id, agent_id, version, prompt) VALUES ('0a0a0a0a-0a0a-4a0a-8a0a-0a0a0a0a0a0a', 'f0f0f0f0-f0f0-4f0f-8f0f-f0f0f0f0f0f0', 'v3', 'Be concise.') $$,
  'creating a new version is a plain insert, unaffected by the immutability trigger');

-- ---- publish_agent_version
SELECT is((SELECT live_version FROM public.agents WHERE id = 'f0f0f0f0-f0f0-4f0f-8f0f-f0f0f0f0f0f0'), 'v1', 'the agent starts live on v1');
SELECT results_eq($$ SELECT live_version FROM public.publish_agent_version('f0f0f0f0-f0f0-4f0f-8f0f-f0f0f0f0f0f0', 'v2') $$, $$ VALUES ('v2'::text) $$, 'org_admin publishes v2');
SELECT is((SELECT count(*) FROM public.audit_log WHERE change LIKE 'agent.published%'), 1::bigint, 'publishing is audited');
SELECT lives_ok($$ SELECT public.publish_agent_version('f0f0f0f0-f0f0-4f0f-8f0f-f0f0f0f0f0f0', 'v1') $$, 'rolling back to an earlier version is the same operation');
SELECT is((SELECT live_version FROM public.agents WHERE id = 'f0f0f0f0-f0f0-4f0f-8f0f-f0f0f0f0f0f0'), 'v1', 'the rollback took effect');

-- ---- validation
SELECT throws_ok($$ SELECT public.publish_agent_version('f0f0f0f0-f0f0-4f0f-8f0f-f0f0f0f0f0f0', 'v99') $$,
  'P0002', NULL, 'publishing a version that does not exist is refused');

-- ---- an agent (not an editor) cannot publish
SELECT set_config('request.jwt.claims', '{"sub":"c3c3c3c3-c3c3-4c3c-8c3c-c3c3c3c3c3c3","role":"authenticated"}', true);
SELECT throws_ok($$ SELECT public.publish_agent_version('f0f0f0f0-f0f0-4f0f-8f0f-f0f0f0f0f0f0', 'v2') $$,
  '42501', NULL, 'an agent-role member cannot publish a version');

-- ---- org B cannot publish for org A's agent
SELECT set_config('request.jwt.claims', '{"sub":"d4d4d4d4-d4d4-4d4d-8d4d-d4d4d4d4d4d4","role":"authenticated"}', true);
SELECT throws_ok($$ SELECT public.publish_agent_version('f0f0f0f0-f0f0-4f0f-8f0f-f0f0f0f0f0f0', 'v2') $$,
  '42501', NULL, 'org B admin cannot publish a version for org A''s agent');

SELECT * FROM finish();
ROLLBACK;
