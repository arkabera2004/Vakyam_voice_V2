-- Resolves whether a call may record, at creation, mirroring
-- src/domain/consent.ts's decideRecording(): no approved policy -> no
-- recording; an approved policy that does not require explicit consent ->
-- recording allowed immediately; an approved policy that does require it ->
-- not yet allowed, since nothing in this call has captured a member's
-- 'given'/'declined' outcome yet. calls.consent_outcome is left NULL here on
-- purpose: it records what the member was actually asked and answered
-- (src/domain/consent.ts's ConsentOutcome), which has not happened yet at
-- creation; it is distinct from recordings.consent_outcome ('given' or
-- 'not_required'), the eventual recording's own audit field, set only once
-- a recording is actually created. Capturing a member's consent outcome
-- during a live voice call is a separate, still-open product question (see
-- docs/CONTINUATION_STATUS.md) and is not answered here. Additive on top of
-- 20261117140000.

CREATE OR REPLACE FUNCTION public.start_call(agent UUID DEFAULT NULL)
RETURNS public.calls
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  caller_org UUID;
  caller_role TEXT;
  chosen_agent public.agents;
  chosen_version public.agent_versions;
  approved_policy public.consent_policies;
  decided_recording_allowed BOOLEAN := false;
  decided_skip_reason TEXT := 'no consent policy configured';
  c public.calls;
BEGIN
  SELECT org_id INTO caller_org FROM public.org_members WHERE user_id = auth.uid() AND status = 'active' LIMIT 1;
  IF caller_org IS NULL THEN
    RAISE EXCEPTION 'you do not belong to an organisation' USING ERRCODE = 'P0003';
  END IF;
  caller_role := public.org_role(caller_org);

  -- Mirrors MATRIX["calls.operate"] in src/domain/roles.ts: editors + agent.
  IF NOT (public.can_edit_org(caller_org) OR caller_role = 'agent') THEN
    RAISE EXCEPTION 'your role cannot start a voice call' USING ERRCODE = '42501';
  END IF;

  IF agent IS NOT NULL THEN
    SELECT * INTO chosen_agent FROM public.agents WHERE id = agent AND org_id = caller_org;
    IF chosen_agent.id IS NULL THEN
      RAISE EXCEPTION 'agent not found in your organisation' USING ERRCODE = 'P0002';
    END IF;
  ELSE
    -- No agent picker exists in the product yet; every org has exactly one
    -- configured agent today. Picking the oldest keeps this stable once a
    -- second agent is added, until a real selector ships.
    SELECT * INTO chosen_agent FROM public.agents WHERE org_id = caller_org ORDER BY created_at LIMIT 1;
    IF chosen_agent.id IS NULL THEN
      RAISE EXCEPTION 'your organisation has no voice agent configured' USING ERRCODE = 'P0004';
    END IF;
  END IF;

  IF chosen_agent.live_version IS NOT NULL THEN
    SELECT * INTO chosen_version FROM public.agent_versions
      WHERE agent_id = chosen_agent.id AND version = chosen_agent.live_version;
  END IF;

  SELECT * INTO approved_policy FROM public.consent_policies WHERE org_id = caller_org AND status = 'approved';
  IF approved_policy.id IS NOT NULL THEN
    IF approved_policy.requires_explicit_consent THEN
      decided_skip_reason := 'explicit consent required and not yet given';
    ELSE
      decided_recording_allowed := true;
      decided_skip_reason := NULL;
    END IF;
  END IF;

  INSERT INTO public.calls (
    org_id, agent_id, agent_version_id, channel, started_by, provider,
    consent_policy_id, recording_allowed, recording_skip_reason
  )
  VALUES (
    caller_org, chosen_agent.id, chosen_version.id, 'browser', auth.uid(), 'azure',
    approved_policy.id, decided_recording_allowed, decided_skip_reason
  )
  RETURNING * INTO c;

  INSERT INTO public.call_events (org_id, call_id, seq, type, payload)
  VALUES (c.org_id, c.id, 1, 'status.created', jsonb_build_object('by', auth.uid()));

  RETURN c;
END;
$$;
