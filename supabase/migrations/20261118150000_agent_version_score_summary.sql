-- Cross-version QA comparison (Agent Studio follow-up): the average
-- evaluated score per agent version, computed server-side because plain
-- PostgREST has no GROUP BY. Replaces the old demo's fictional "compare v7
-- with v6" table with a real aggregation of calls.agent_version_id joined
-- to evaluations.overall_score. Read-only: any org member may call it,
-- matching "members read" on agents/agent_versions elsewhere; it exposes
-- nothing an org member could not already see by reading those tables and
-- evaluations directly. Additive on top of 20261118140000.

CREATE OR REPLACE FUNCTION public.agent_version_score_summary(target_agent_id UUID)
RETURNS TABLE (version TEXT, average_score NUMERIC, evaluation_count BIGINT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  agent_row public.agents;
BEGIN
  SELECT * INTO agent_row FROM public.agents WHERE id = target_agent_id;
  IF agent_row.id IS NULL THEN RAISE EXCEPTION 'agent not found' USING ERRCODE = 'P0002'; END IF;
  IF public.org_role(agent_row.org_id) IS NULL THEN
    RAISE EXCEPTION 'not a member of this organisation' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT av.version, round(avg(e.overall_score), 2) AS average_score, count(e.id) AS evaluation_count
  FROM public.agent_versions av
  JOIN public.calls c ON c.agent_version_id = av.id
  JOIN public.evaluations e ON e.call_id = c.id AND e.overall_score IS NOT NULL
  WHERE av.agent_id = target_agent_id
  GROUP BY av.version
  ORDER BY av.version;
END;
$$;
GRANT EXECUTE ON FUNCTION public.agent_version_score_summary(UUID) TO authenticated;
