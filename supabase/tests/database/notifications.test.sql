-- pgTAP tests for the notification created by assign_evaluation_reviewer().
-- Run with: npx supabase test db   (needs a local stack: npx supabase start)
BEGIN;
SELECT plan(6);

INSERT INTO auth.users (id, email, instance_id, aud, role) VALUES
  ('a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1', 'admin@org-a.test', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
  ('b2b2b2b2-b2b2-4b2b-8b2b-b2b2b2b2b2b2', 'qa@org-a.test', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
  ('b3b3b3b3-b3b3-4b3b-8b3b-b3b3b3b3b3b3', 'qa2@org-a.test', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
  ('c3c3c3c3-c3c3-4c3c-8c3c-c3c3c3c3c3c3', 'agent@org-a.test', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated');

INSERT INTO public.organisations (id, slug, name) VALUES ('0a0a0a0a-0a0a-4a0a-8a0a-0a0a0a0a0a0a', 'test-a', 'Test A');
INSERT INTO public.org_members (org_id, user_id, role) VALUES
  ('0a0a0a0a-0a0a-4a0a-8a0a-0a0a0a0a0a0a', 'a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1', 'org_admin'),
  ('0a0a0a0a-0a0a-4a0a-8a0a-0a0a0a0a0a0a', 'b2b2b2b2-b2b2-4b2b-8b2b-b2b2b2b2b2b2', 'qa_analyst'),
  ('0a0a0a0a-0a0a-4a0a-8a0a-0a0a0a0a0a0a', 'b3b3b3b3-b3b3-4b3b-8b3b-b3b3b3b3b3b3', 'qa_analyst'),
  ('0a0a0a0a-0a0a-4a0a-8a0a-0a0a0a0a0a0a', 'c3c3c3c3-c3c3-4c3c-8c3c-c3c3c3c3c3c3', 'agent');

INSERT INTO public.calls (id, org_id, caller_name, started_by) VALUES
  ('ca11ca11-ca11-4a11-8a11-ca11ca11ca11', '0a0a0a0a-0a0a-4a0a-8a0a-0a0a0a0a0a0a', 'Agent call', 'c3c3c3c3-c3c3-4c3c-8c3c-c3c3c3c3c3c3');
INSERT INTO public.evaluation_templates (id, org_id, name, version, status) VALUES
  ('d0d0d0d0-d0d0-4d0d-8d0d-d0d0d0d0d0d0', '0a0a0a0a-0a0a-4a0a-8a0a-0a0a0a0a0a0a', 'Rubric', 1, 'active');
INSERT INTO public.evaluations (id, org_id, call_id, template_id, status, evaluator_kind, idempotency_key) VALUES
  ('e0e0e0e0-e0e0-4e0e-8e0e-e0e0e0e0e0e0', '0a0a0a0a-0a0a-4a0a-8a0a-0a0a0a0a0a0a', 'ca11ca11-ca11-4a11-8a11-ca11ca11ca11', 'd0d0d0d0-d0d0-4d0d-8d0d-d0d0d0d0d0d0', 'completed', 'human', 'idem-notif');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1","role":"authenticated"}', true);

-- ---- assigning a reviewer notifies them
SELECT public.assign_evaluation_reviewer('e0e0e0e0-e0e0-4e0e-8e0e-e0e0e0e0e0e0', 'b2b2b2b2-b2b2-4b2b-8b2b-b2b2b2b2b2b2');
SELECT is((SELECT count(*) FROM public.notifications WHERE user_id = 'b2b2b2b2-b2b2-4b2b-8b2b-b2b2b2b2b2b2' AND kind = 'evaluation.assigned'), 1::bigint, 'the newly-assigned reviewer gets exactly one notification');
SELECT is((SELECT read_at FROM public.notifications WHERE user_id = 'b2b2b2b2-b2b2-4b2b-8b2b-b2b2b2b2b2b2'), NULL, 'the notification starts unread');

-- ---- reassigning to the same person does not notify again
SELECT public.assign_evaluation_reviewer('e0e0e0e0-e0e0-4e0e-8e0e-e0e0e0e0e0e0', 'b2b2b2b2-b2b2-4b2b-8b2b-b2b2b2b2b2b2');
SELECT is((SELECT count(*) FROM public.notifications WHERE user_id = 'b2b2b2b2-b2b2-4b2b-8b2b-b2b2b2b2b2b2'), 1::bigint, 'reassigning to the same reviewer does not create a second notification');

-- ---- reassigning to someone else notifies the new person, not the old one again
SELECT public.assign_evaluation_reviewer('e0e0e0e0-e0e0-4e0e-8e0e-e0e0e0e0e0e0', 'b3b3b3b3-b3b3-4b3b-8b3b-b3b3b3b3b3b3');
SELECT is((SELECT count(*) FROM public.notifications WHERE user_id = 'b3b3b3b3-b3b3-4b3b-8b3b-b3b3b3b3b3b3'), 1::bigint, 'the newly-assigned second reviewer is notified');
SELECT is((SELECT count(*) FROM public.notifications WHERE user_id = 'b2b2b2b2-b2b2-4b2b-8b2b-b2b2b2b2b2b2'), 1::bigint, 'the previous reviewer''s notification count is unchanged');

-- ---- clearing the assignment does not notify anyone
SELECT public.assign_evaluation_reviewer('e0e0e0e0-e0e0-4e0e-8e0e-e0e0e0e0e0e0', NULL);
SELECT is((SELECT count(*) FROM public.notifications), 2::bigint, 'clearing the assignment creates no notification');

SELECT * FROM finish();
ROLLBACK;
