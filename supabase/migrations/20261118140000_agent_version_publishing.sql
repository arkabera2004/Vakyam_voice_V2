-- Agent version immutability and publishing (Agent Studio Phase 1):
-- agent_versions rows are snapshots a call can be permanently tied to via
-- calls.agent_version_id, but nothing before this stopped an editor from
-- updating one in place -- which would silently reinterpret what every
-- past call using it actually said and sounded like. The RLS added in
-- 20261116150000 (editors update agent_versions) allowed exactly that;
-- this migration removes it and replaces it with a trigger that refuses
-- every UPDATE, so "editing" a published or historical version is
-- structurally impossible, not just discouraged. A new configuration is
-- always a new row (create_agent_version-equivalent insert, RLS-protected,
-- no RPC needed for that part); only pointing agents.live_version at one is
-- a workflow with validation worth a function. Additive on top of
-- 20261118130000.

DROP POLICY IF EXISTS "editors update agent_versions" ON public.agent_versions;

CREATE OR REPLACE FUNCTION public.forbid_agent_version_update()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'agent_versions rows are immutable once created; publish a new version instead' USING ERRCODE = '0A000';
END;
$$;
CREATE TRIGGER agent_versions_immutable
  BEFORE UPDATE ON public.agent_versions
  FOR EACH ROW EXECUTE FUNCTION public.forbid_agent_version_update();

-- The only path that changes which version is live. agents.live_version is
-- a pointer, not a snapshot, so updating it (unlike agent_versions itself)
-- is safe; this function only adds the validation a raw UPDATE could skip.
CREATE OR REPLACE FUNCTION public.publish_agent_version(target_agent_id UUID, target_version TEXT)
RETURNS public.agents
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  agent_row public.agents;
  version_row public.agent_versions;
BEGIN
  SELECT * INTO agent_row FROM public.agents WHERE id = target_agent_id;
  IF agent_row.id IS NULL THEN RAISE EXCEPTION 'agent not found' USING ERRCODE = 'P0002'; END IF;
  IF NOT public.can_edit_org(agent_row.org_id) THEN
    RAISE EXCEPTION 'not allowed to publish versions for this agent' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO version_row FROM public.agent_versions av WHERE av.agent_id = target_agent_id AND av.version = target_version;
  IF version_row.id IS NULL THEN
    RAISE EXCEPTION 'version % does not exist for this agent', target_version USING ERRCODE = 'P0002';
  END IF;
  IF agent_row.live_version = target_version THEN RETURN agent_row; END IF;

  UPDATE public.agents SET live_version = target_version WHERE id = target_agent_id RETURNING * INTO agent_row;
  PERFORM public.log_audit(agent_row.org_id, format('agent.published %s version %s', agent_row.name, target_version), target_version);
  RETURN agent_row;
END;
$$;
GRANT EXECUTE ON FUNCTION public.publish_agent_version(UUID, TEXT) TO authenticated;
