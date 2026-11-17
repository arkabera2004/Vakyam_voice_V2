-- Domain schema for the supervisor console, scoped by organisation (GAP-F-01).
-- Every row carries org_id; row level security lets members of that
-- organisation read it and admins or supervisors change it. The audit log is
-- append-only and written only through public.log_audit().

-- ---------------------------------------------------------------- tenancy
CREATE TABLE public.organisations (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    slug TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.org_members (
    org_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('super_admin', 'org_admin', 'supervisor', 'agent', 'qa_analyst')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (org_id, user_id)
);
CREATE INDEX org_members_user_idx ON public.org_members (user_id);

-- The caller's role in an organisation, or NULL. SECURITY DEFINER so policies
-- on org_members itself do not recurse.
CREATE OR REPLACE FUNCTION public.org_role(org UUID)
RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM public.org_members WHERE org_id = org AND user_id = auth.uid();
$$;

-- Permission tiers. Mirror of src/domain/roles.ts; change both together.
--   manage : organisation settings, members, policies, connectors
--   edit   : agents, calls, campaigns, knowledge (operational changes)
--   review : evaluations, recordings, audit exports
CREATE OR REPLACE FUNCTION public.can_manage_org(org UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.org_role(org) IN ('super_admin', 'org_admin');
$$;

CREATE OR REPLACE FUNCTION public.can_edit_org(org UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.org_role(org) IN ('super_admin', 'org_admin', 'supervisor');
$$;

CREATE OR REPLACE FUNCTION public.can_review_org(org UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.org_role(org) IN ('super_admin', 'org_admin', 'supervisor', 'qa_analyst');
$$;

ALTER TABLE public.organisations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members see their organisation" ON public.organisations
  FOR SELECT USING (public.org_role(id) IS NOT NULL);
CREATE POLICY "admins rename their organisation" ON public.organisations
  FOR UPDATE USING (public.can_manage_org(id)) WITH CHECK (public.can_manage_org(id));

ALTER TABLE public.org_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members see who is in their organisation" ON public.org_members
  FOR SELECT USING (public.org_role(org_id) IS NOT NULL);
CREATE POLICY "admins manage membership" ON public.org_members
  FOR ALL USING (public.can_manage_org(org_id)) WITH CHECK (public.can_manage_org(org_id));

-- ---------------------------------------------------------------- agents
CREATE TABLE public.agents (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    org_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    live_version TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.agent_versions (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    org_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
    agent_id UUID NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
    version TEXT NOT NULL,
    title TEXT NOT NULL DEFAULT '',
    prompt TEXT NOT NULL DEFAULT '',
    first_message TEXT NOT NULL DEFAULT '',
    voice TEXT NOT NULL DEFAULT 'aarti',
    speed NUMERIC(3,2) NOT NULL DEFAULT 1.05 CHECK (speed BETWEEN 0.8 AND 1.3),
    warmth INT NOT NULL DEFAULT 70 CHECK (warmth BETWEEN 0 AND 100),
    persona_tone TEXT NOT NULL DEFAULT '',
    persona_handoff TEXT NOT NULL DEFAULT '',
    dictionary JSONB NOT NULL DEFAULT '[]'::jsonb,
    qa_delta TEXT,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (agent_id, version)
);

-- ---------------------------------------------------------------- calls
-- One voice session. `status` follows the state machine in
-- src/domain/sessionState.ts; transitions are enforced by advance_call() below.
CREATE TABLE public.calls (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    org_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
    agent_id UUID REFERENCES public.agents(id) ON DELETE SET NULL,
    agent_version_id UUID REFERENCES public.agent_versions(id) ON DELETE SET NULL,
    channel TEXT NOT NULL DEFAULT 'browser' CHECK (channel IN ('browser', 'phone')),
    number INT,
    caller_name TEXT NOT NULL DEFAULT '',
    caller_tier TEXT,
    language TEXT,
    hindi_share INT CHECK (hindi_share BETWEEN 0 AND 100),
    step TEXT,
    step_hot BOOLEAN NOT NULL DEFAULT false,
    sentiment TEXT CHECK (sentiment IN ('Positive', 'Neutral', 'Frustrated')),
    status TEXT NOT NULL DEFAULT 'created'
      CHECK (status IN ('created', 'initializing', 'active', 'interrupted', 'completed', 'failed', 'cancelled', 'abandoned')),
    outcome TEXT,
    failure_reason TEXT,
    provider TEXT NOT NULL DEFAULT 'azure',
    provider_model TEXT,
    provider_voice TEXT,
    provider_region TEXT,
    consent_policy_id UUID,
    consent_outcome TEXT CHECK (consent_outcome IN ('given', 'declined', 'not_asked', 'unknown')),
    recording_allowed BOOLEAN NOT NULL DEFAULT false,
    recording_skip_reason TEXT,
    idempotency_key TEXT UNIQUE,
    taken_over_by UUID REFERENCES auth.users(id),
    started_by UUID REFERENCES auth.users(id),
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_event_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    ended_at TIMESTAMPTZ,
    duration_ms INT CHECK (duration_ms >= 0)
);
CREATE INDEX calls_org_status_idx ON public.calls (org_id, status, started_at DESC);
CREATE INDEX calls_org_started_idx ON public.calls (org_id, started_at DESC);

CREATE TABLE public.call_turns (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    org_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
    call_id UUID NOT NULL REFERENCES public.calls(id) ON DELETE CASCADE,
    at_ms INT NOT NULL DEFAULT 0,
    speaker TEXT NOT NULL,
    text TEXT NOT NULL,
    langs TEXT[] NOT NULL DEFAULT '{}',
    tool JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX call_turns_call_idx ON public.call_turns (call_id, at_ms);

CREATE TABLE public.transfers (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    org_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
    call_id UUID REFERENCES public.calls(id) ON DELETE CASCADE,
    state TEXT NOT NULL DEFAULT 'ringing' CHECK (state IN ('ringing', 'accepted', 'declined')),
    to_name TEXT,
    summary TEXT[] NOT NULL DEFAULT '{}',
    notes TEXT[] NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------- quality
CREATE TABLE public.rubrics (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    org_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
    version TEXT NOT NULL,
    weights JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (org_id, version)
);

CREATE TABLE public.qa_scores (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    org_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
    call_id UUID REFERENCES public.calls(id) ON DELETE CASCADE,
    call_number INT,
    member_name TEXT,
    member_tier TEXT,
    desk TEXT,
    criterion TEXT NOT NULL,
    score INT NOT NULL CHECK (score BETWEEN 0 AND 100),
    reviewer_name TEXT,
    coaching BOOLEAN NOT NULL DEFAULT false,
    scored_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX qa_scores_org_idx ON public.qa_scores (org_id, scored_at DESC);

-- ---------------------------------------------------------------- build
CREATE TABLE public.adapters (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    org_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN ('crm', 'ticketing', 'telephony')),
    server TEXT,
    verbs TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'Not connected'
      CHECK (status IN ('Connected', 'Not connected', 'Degraded 1 retry', 'Planned', 'Testing')),
    is_mock BOOLEAN NOT NULL DEFAULT true,
    UNIQUE (org_id, name)
);

CREATE TABLE public.campaigns (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    org_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    sub TEXT NOT NULL DEFAULT '',
    emoji TEXT NOT NULL DEFAULT '📣',
    dialed INT NOT NULL DEFAULT 0,
    total INT NOT NULL DEFAULT 0,
    connected INT NOT NULL DEFAULT 0,
    dlt TEXT,
    series TEXT,
    status TEXT NOT NULL DEFAULT 'Scheduled' CHECK (status IN ('Running', 'Scheduled', 'Completed', 'Paused')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.knowledge_sources (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    org_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    sub TEXT NOT NULL DEFAULT '',
    emoji TEXT NOT NULL DEFAULT '📄',
    live BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.policy_gates (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    org_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    sub TEXT NOT NULL DEFAULT '',
    approver TEXT,
    sla TEXT,
    enabled BOOLEAN NOT NULL DEFAULT true,
    triggered_7d INT NOT NULL DEFAULT 0,
    UNIQUE (org_id, name)
);

CREATE TABLE public.knowledge_versions (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    org_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
    label TEXT NOT NULL,
    published_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------- govern
CREATE TABLE public.disclosure_versions (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    org_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
    version TEXT NOT NULL,
    text TEXT NOT NULL,
    approved_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (org_id, version)
);

CREATE TABLE public.pii_settings (
    org_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
    field TEXT NOT NULL,
    redact BOOLEAN NOT NULL DEFAULT true,
    PRIMARY KEY (org_id, field)
);

CREATE TABLE public.deletion_requests (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    org_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
    ref TEXT NOT NULL,
    member_name TEXT NOT NULL,
    member_id TEXT,
    reason TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
    requested_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    closed_at TIMESTAMPTZ
);

CREATE TABLE public.audit_log (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    org_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
    actor_id UUID REFERENCES auth.users(id),
    actor_name TEXT NOT NULL,
    change TEXT NOT NULL,
    version TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX audit_log_org_idx ON public.audit_log (org_id, created_at DESC);

-- The only way clients write the audit log. Stamps the caller and their
-- profile name; refuses non-members.
CREATE OR REPLACE FUNCTION public.log_audit(org UUID, change TEXT, version TEXT DEFAULT '')
RETURNS public.audit_log
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  row public.audit_log;
  who TEXT;
BEGIN
  IF public.org_role(org) IS NULL THEN
    RAISE EXCEPTION 'not a member of this organisation' USING ERRCODE = '42501';
  END IF;
  SELECT COALESCE(display_name, email, 'Unknown') INTO who FROM public.profiles WHERE user_id = auth.uid();
  INSERT INTO public.audit_log (org_id, actor_id, actor_name, change, version)
  VALUES (org, auth.uid(), COALESCE(who, 'Unknown'), change, COALESCE(version, ''))
  RETURNING * INTO row;
  RETURN row;
END;
$$;

-- ---------------------------------------------------------------- RLS
-- Same shape for every org-scoped table: members read, admins and
-- supervisors write.
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'agents', 'agent_versions', 'calls', 'call_turns', 'transfers', 'rubrics', 'qa_scores',
    'adapters', 'campaigns', 'knowledge_sources', 'policy_gates', 'knowledge_versions',
    'disclosure_versions', 'pii_settings', 'deletion_requests'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY "members read %1$s" ON public.%1$I FOR SELECT USING (public.org_role(org_id) IS NOT NULL)', t);
    EXECUTE format('CREATE POLICY "editors insert %1$s" ON public.%1$I FOR INSERT WITH CHECK (public.can_edit_org(org_id))', t);
    EXECUTE format('CREATE POLICY "editors update %1$s" ON public.%1$I FOR UPDATE USING (public.can_edit_org(org_id)) WITH CHECK (public.can_edit_org(org_id))', t);
    EXECUTE format('CREATE POLICY "editors delete %1$s" ON public.%1$I FOR DELETE USING (public.can_edit_org(org_id))', t);
  END LOOP;
END $$;

-- Append-only: members read; no INSERT/UPDATE/DELETE policy exists, so the
-- only path in is log_audit(), which runs as the definer.
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read audit_log" ON public.audit_log
  FOR SELECT USING (public.org_role(org_id) IS NOT NULL);

GRANT EXECUTE ON FUNCTION public.org_role(UUID), public.can_edit_org(UUID), public.log_audit(UUID, TEXT, TEXT) TO authenticated;
