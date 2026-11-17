-- Voice platform entities (Phases 3, 6, 7, 8, 10, 11 of the product brief):
-- organisation settings, consent and retention policies, session events and
-- the state-transition function, recordings, transcripts, evaluations, the
-- CRM connector framework, usage, notifications, invitations, and the
-- private storage buckets. Additive on top of 20261116150000.

-- ---------------------------------------------------------------- settings
CREATE TABLE public.org_settings (
    org_id UUID NOT NULL PRIMARY KEY REFERENCES public.organisations(id) ON DELETE CASCADE,
    timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    locale TEXT NOT NULL DEFAULT 'en-IN',
    default_language TEXT NOT NULL DEFAULT 'hi-IN',
    default_voice TEXT NOT NULL DEFAULT 'en-IN-AartiIndicNeural',
    notification_prefs JSONB NOT NULL DEFAULT '{"failed_sessions": true, "processing_failures": true}'::jsonb,
    updated_by UUID REFERENCES auth.users(id),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Versioned recording disclosure / consent policy. Wording is the client's,
-- never generated. Only an approved version lets a session record.
CREATE TABLE public.consent_policies (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    org_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
    version INT NOT NULL CHECK (version > 0),
    disclosure_text TEXT NOT NULL CHECK (length(btrim(disclosure_text)) > 0),
    requires_explicit_consent BOOLEAN NOT NULL DEFAULT true,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'retired')),
    approved_by UUID REFERENCES auth.users(id),
    approved_at TIMESTAMPTZ,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (org_id, version)
);
CREATE UNIQUE INDEX consent_policies_one_approved_idx ON public.consent_policies (org_id) WHERE status = 'approved';

ALTER TABLE public.calls
  ADD CONSTRAINT calls_consent_policy_fkey FOREIGN KEY (consent_policy_id) REFERENCES public.consent_policies(id) ON DELETE SET NULL;

-- Separate, configurable retention per data class. Deletion stays disabled
-- (dry-run only) until explicitly approved for production.
CREATE TABLE public.retention_policies (
    org_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
    target TEXT NOT NULL CHECK (target IN ('recording', 'transcript')),
    retain_days INT NOT NULL DEFAULT 365 CHECK (retain_days BETWEEN 1 AND 3650),
    deletion_enabled BOOLEAN NOT NULL DEFAULT false,
    updated_by UUID REFERENCES auth.users(id),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (org_id, target)
);

-- ---------------------------------------------------------------- sessions
CREATE TABLE public.call_events (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    org_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
    call_id UUID NOT NULL REFERENCES public.calls(id) ON DELETE CASCADE,
    seq INT NOT NULL,
    type TEXT NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (call_id, seq)
);

-- The only way a session changes state. Mirrors src/domain/sessionState.ts.
-- Idempotent on a repeated state; raises on an illegal transition; stamps
-- ended_at/duration on terminal states and appends a call_events row.
CREATE OR REPLACE FUNCTION public.advance_call(call UUID, next_status TEXT, reason TEXT DEFAULT NULL)
RETURNS public.calls
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  c public.calls;
  allowed TEXT[];
BEGIN
  SELECT * INTO c FROM public.calls WHERE id = call FOR UPDATE;
  IF c.id IS NULL THEN RAISE EXCEPTION 'call % not found', call USING ERRCODE = 'P0002'; END IF;
  IF NOT public.can_edit_org(c.org_id) AND c.started_by IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'not allowed to change this call' USING ERRCODE = '42501';
  END IF;
  IF c.status = next_status THEN RETURN c; END IF;

  allowed := CASE c.status
    WHEN 'created'      THEN ARRAY['initializing', 'failed', 'cancelled']
    WHEN 'initializing' THEN ARRAY['active', 'failed', 'cancelled']
    WHEN 'active'       THEN ARRAY['interrupted', 'completed', 'failed', 'cancelled', 'abandoned']
    WHEN 'interrupted'  THEN ARRAY['active', 'completed', 'failed', 'cancelled', 'abandoned']
    ELSE ARRAY[]::TEXT[]
  END;
  IF NOT (next_status = ANY (allowed)) THEN
    RAISE EXCEPTION 'cannot go from % to %', c.status, next_status USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.calls SET
    status = next_status,
    last_event_at = now(),
    failure_reason = CASE WHEN next_status = 'failed' THEN reason ELSE failure_reason END,
    ended_at = CASE WHEN next_status IN ('completed', 'failed', 'cancelled', 'abandoned') THEN now() ELSE ended_at END,
    duration_ms = CASE WHEN next_status IN ('completed', 'failed', 'cancelled', 'abandoned')
                       THEN GREATEST(0, (EXTRACT(EPOCH FROM (now() - started_at)) * 1000)::INT) ELSE duration_ms END
  WHERE id = call RETURNING * INTO c;

  INSERT INTO public.call_events (org_id, call_id, seq, type, payload)
  VALUES (c.org_id, c.id,
          COALESCE((SELECT max(seq) FROM public.call_events WHERE call_id = c.id), 0) + 1,
          'status.' || next_status,
          jsonb_build_object('reason', reason, 'by', auth.uid()));
  RETURN c;
END;
$$;

-- Sweeper for sessions the browser never finalised (e.g. tab closed).
CREATE OR REPLACE FUNCTION public.abandon_stale_calls(older_than INTERVAL DEFAULT '15 minutes')
RETURNS INT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n INT := 0; r RECORD;
BEGIN
  FOR r IN SELECT id FROM public.calls WHERE status IN ('active', 'interrupted') AND last_event_at < now() - older_than LOOP
    PERFORM public.advance_call(r.id, 'abandoned', 'no events for ' || older_than::TEXT);
    n := n + 1;
  END LOOP;
  RETURN n;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.abandon_stale_calls(INTERVAL) FROM PUBLIC, authenticated;

-- ---------------------------------------------------------------- recordings
CREATE TABLE public.recordings (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    org_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
    call_id UUID NOT NULL UNIQUE REFERENCES public.calls(id) ON DELETE CASCADE,
    bucket TEXT NOT NULL DEFAULT 'recordings',
    object_path TEXT NOT NULL UNIQUE,
    format TEXT NOT NULL DEFAULT 'audio/webm',
    size_bytes BIGINT CHECK (size_bytes >= 0),
    duration_ms INT CHECK (duration_ms >= 0),
    checksum TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'uploaded', 'verified', 'failed', 'deleted')),
    consent_policy_id UUID REFERENCES public.consent_policies(id) ON DELETE SET NULL,
    consent_outcome TEXT NOT NULL CHECK (consent_outcome IN ('given', 'not_required')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    verified_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ,
    deletion_reason TEXT,
    CONSTRAINT recordings_path_in_org CHECK (object_path LIKE 'org/' || org_id::TEXT || '/%')
);
CREATE INDEX recordings_org_created_idx ON public.recordings (org_id, created_at);

-- ---------------------------------------------------------------- transcripts
CREATE TABLE public.transcripts (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    org_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
    call_id UUID NOT NULL UNIQUE REFERENCES public.calls(id) ON DELETE CASCADE,
    provider TEXT NOT NULL DEFAULT 'azure',
    model TEXT,
    language TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'partial', 'final', 'failed')),
    error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.transcript_segments (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    org_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
    transcript_id UUID NOT NULL REFERENCES public.transcripts(id) ON DELETE CASCADE,
    seq INT NOT NULL,
    speaker TEXT NOT NULL CHECK (speaker IN ('agent', 'caller', 'system')),
    start_ms INT NOT NULL CHECK (start_ms >= 0),
    end_ms INT CHECK (end_ms >= start_ms),
    text TEXT NOT NULL,
    language TEXT,
    confidence NUMERIC(4,3) CHECK (confidence BETWEEN 0 AND 1),
    is_final BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (transcript_id, seq)
);

-- ---------------------------------------------------------------- evaluation
CREATE TABLE public.evaluation_templates (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    org_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    version INT NOT NULL CHECK (version > 0),
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'retired')),
    pass_threshold INT NOT NULL DEFAULT 75 CHECK (pass_threshold BETWEEN 0 AND 100),
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (org_id, name, version)
);

CREATE TABLE public.evaluation_criteria (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    org_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
    template_id UUID NOT NULL REFERENCES public.evaluation_templates(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    weight INT NOT NULL CHECK (weight BETWEEN 0 AND 100),
    position INT NOT NULL DEFAULT 0,
    UNIQUE (template_id, name)
);

CREATE TABLE public.evaluations (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    org_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
    call_id UUID NOT NULL REFERENCES public.calls(id) ON DELETE CASCADE,
    transcript_id UUID REFERENCES public.transcripts(id) ON DELETE SET NULL,
    template_id UUID NOT NULL REFERENCES public.evaluation_templates(id),
    status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'completed', 'failed')),
    evaluator_kind TEXT NOT NULL DEFAULT 'ai' CHECK (evaluator_kind IN ('ai', 'human')),
    provider TEXT,
    model TEXT,
    overall_score NUMERIC(5,2) CHECK (overall_score BETWEEN 0 AND 100),
    error TEXT,
    attempts INT NOT NULL DEFAULT 0,
    idempotency_key TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ
);
CREATE INDEX evaluations_org_call_idx ON public.evaluations (org_id, call_id, created_at DESC);

CREATE TABLE public.evaluation_scores (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    org_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
    evaluation_id UUID NOT NULL REFERENCES public.evaluations(id) ON DELETE CASCADE,
    criterion_id UUID NOT NULL REFERENCES public.evaluation_criteria(id),
    score INT NOT NULL CHECK (score BETWEEN 0 AND 100),
    rationale TEXT NOT NULL DEFAULT '',
    evidence_segment_ids UUID[] NOT NULL DEFAULT '{}',
    UNIQUE (evaluation_id, criterion_id)
);

-- Human review of an AI evaluation; the AI result is never overwritten.
CREATE TABLE public.evaluation_reviews (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    org_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
    evaluation_id UUID NOT NULL REFERENCES public.evaluations(id) ON DELETE CASCADE,
    reviewer_id UUID NOT NULL REFERENCES auth.users(id),
    comment TEXT NOT NULL DEFAULT '',
    override_overall NUMERIC(5,2) CHECK (override_overall BETWEEN 0 AND 100),
    override_scores JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------- CRM framework
CREATE TABLE public.crm_integrations (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    org_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    provider_key TEXT NOT NULL,            -- e.g. 'mock'; vendor keys added when a connector exists
    status TEXT NOT NULL DEFAULT 'disabled' CHECK (status IN ('disabled', 'enabled', 'error')),
    credential_ref TEXT,                   -- name of the server-side secret, never the secret
    config JSONB NOT NULL DEFAULT '{}'::jsonb,
    last_test_at TIMESTAMPTZ,
    last_test_ok BOOLEAN,
    last_error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (org_id, name)
);

CREATE TABLE public.crm_field_mappings (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    org_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
    integration_id UUID NOT NULL REFERENCES public.crm_integrations(id) ON DELETE CASCADE,
    source_field TEXT NOT NULL,
    target_field TEXT NOT NULL,
    transform TEXT,
    UNIQUE (integration_id, source_field)
);

CREATE TABLE public.crm_sync_jobs (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    org_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
    integration_id UUID NOT NULL REFERENCES public.crm_integrations(id) ON DELETE CASCADE,
    trigger TEXT NOT NULL,                 -- e.g. 'call.completed'
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'succeeded', 'failed', 'dead')),
    attempts INT NOT NULL DEFAULT 0,
    next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_error TEXT,
    idempotency_key TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX crm_sync_jobs_due_idx ON public.crm_sync_jobs (status, next_attempt_at);

-- ---------------------------------------------------------------- usage, notifications, invitations
CREATE TABLE public.usage_records (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    org_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
    call_id UUID REFERENCES public.calls(id) ON DELETE SET NULL,
    provider TEXT NOT NULL,
    metric TEXT NOT NULL,                  -- e.g. 'realtime_seconds', 'tts_characters'
    quantity NUMERIC(14,3) NOT NULL CHECK (quantity >= 0),
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX usage_records_org_time_idx ON public.usage_records (org_id, recorded_at DESC);

CREATE TABLE public.notifications (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    org_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    kind TEXT NOT NULL,
    title TEXT NOT NULL,
    body TEXT NOT NULL DEFAULT '',
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX notifications_user_idx ON public.notifications (user_id, read_at, created_at DESC);

CREATE TABLE public.invitations (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    org_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
    email TEXT NOT NULL CHECK (position('@' IN email) > 1),
    role TEXT NOT NULL CHECK (role IN ('super_admin', 'org_admin', 'supervisor', 'agent', 'qa_analyst')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'revoked', 'failed')),
    invited_by UUID REFERENCES auth.users(id),
    accepted_user_id UUID REFERENCES auth.users(id),
    error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    accepted_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX invitations_pending_email_idx ON public.invitations (org_id, lower(email)) WHERE status = 'pending';

-- ---------------------------------------------------------------- RLS
DO $$
DECLARE t TEXT;
BEGIN
  -- members read; editors (super_admin, org_admin, supervisor) write
  FOREACH t IN ARRAY ARRAY['call_events', 'recordings', 'transcripts', 'transcript_segments', 'usage_records'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY "members read %1$s" ON public.%1$I FOR SELECT USING (public.org_role(org_id) IS NOT NULL)', t);
    EXECUTE format('CREATE POLICY "editors insert %1$s" ON public.%1$I FOR INSERT WITH CHECK (public.can_edit_org(org_id))', t);
    EXECUTE format('CREATE POLICY "editors update %1$s" ON public.%1$I FOR UPDATE USING (public.can_edit_org(org_id)) WITH CHECK (public.can_edit_org(org_id))', t);
  END LOOP;
  -- members read; reviewers (editors + qa_analyst) write
  FOREACH t IN ARRAY ARRAY['evaluation_templates', 'evaluation_criteria', 'evaluations', 'evaluation_scores', 'evaluation_reviews'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY "members read %1$s" ON public.%1$I FOR SELECT USING (public.org_role(org_id) IS NOT NULL)', t);
    EXECUTE format('CREATE POLICY "reviewers insert %1$s" ON public.%1$I FOR INSERT WITH CHECK (public.can_review_org(org_id))', t);
    EXECUTE format('CREATE POLICY "reviewers update %1$s" ON public.%1$I FOR UPDATE USING (public.can_review_org(org_id)) WITH CHECK (public.can_review_org(org_id))', t);
  END LOOP;
  -- members read; managers (super_admin, org_admin) write
  FOREACH t IN ARRAY ARRAY['org_settings', 'consent_policies', 'retention_policies', 'crm_integrations', 'crm_field_mappings', 'crm_sync_jobs', 'invitations'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY "members read %1$s" ON public.%1$I FOR SELECT USING (public.org_role(org_id) IS NOT NULL)', t);
    EXECUTE format('CREATE POLICY "managers insert %1$s" ON public.%1$I FOR INSERT WITH CHECK (public.can_manage_org(org_id))', t);
    EXECUTE format('CREATE POLICY "managers update %1$s" ON public.%1$I FOR UPDATE USING (public.can_manage_org(org_id)) WITH CHECK (public.can_manage_org(org_id))', t);
    EXECUTE format('CREATE POLICY "managers delete %1$s" ON public.%1$I FOR DELETE USING (public.can_manage_org(org_id))', t);
  END LOOP;
END $$;

-- Recordings are never deleted by clients; only the retention job (service role) may.
-- Evaluation reviews belong to their reviewer.
CREATE POLICY "reviewers own their reviews" ON public.evaluation_reviews
  FOR DELETE USING (reviewer_id = auth.uid() AND public.can_review_org(org_id));

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users read their notifications" ON public.notifications FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "users mark their notifications" ON public.notifications FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

GRANT EXECUTE ON FUNCTION public.can_manage_org(UUID), public.can_review_org(UUID), public.advance_call(UUID, TEXT, TEXT) TO authenticated;

-- ---------------------------------------------------------------- storage
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('recordings', 'recordings', false, 104857600, ARRAY['audio/webm', 'audio/ogg', 'audio/wav', 'audio/mpeg']),
  ('exports', 'exports', false, 52428800, ARRAY['text/csv', 'application/json', 'application/pdf'])
ON CONFLICT (id) DO NOTHING;

-- Objects live under org/<org_id>/...; the second path segment is the org.
CREATE OR REPLACE FUNCTION public.object_org(name TEXT)
RETURNS UUID
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN split_part(name, '/', 1) = 'org' THEN NULLIF(split_part(name, '/', 2), '')::UUID END;
$$;

CREATE POLICY "reviewers read org recordings" ON storage.objects
  FOR SELECT USING (bucket_id = 'recordings' AND public.can_review_org(public.object_org(name)));
CREATE POLICY "editors upload org recordings" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'recordings' AND public.can_edit_org(public.object_org(name)));
CREATE POLICY "reviewers read org exports" ON storage.objects
  FOR SELECT USING (bucket_id = 'exports' AND public.can_review_org(public.object_org(name)));
CREATE POLICY "reviewers write org exports" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'exports' AND public.can_review_org(public.object_org(name)));
-- No client DELETE policy on either bucket: deletion is the retention job's.

-- ---------------------------------------------------------------- demo org defaults
INSERT INTO public.org_settings (org_id) VALUES ('00000000-0000-4000-8000-000000000001') ON CONFLICT DO NOTHING;
INSERT INTO public.retention_policies (org_id, target) VALUES
  ('00000000-0000-4000-8000-000000000001', 'recording'),
  ('00000000-0000-4000-8000-000000000001', 'transcript')
ON CONFLICT DO NOTHING;
-- No consent policy is seeded on purpose: wording must come from the client,
-- and without an approved policy sessions do not record.
