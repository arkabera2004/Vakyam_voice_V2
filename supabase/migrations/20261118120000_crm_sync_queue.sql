-- CRM connector framework (master-prompt Phase 8): enqueue_crm_sync() is the
-- one path that creates a sync job, so permission checks and idempotency
-- live in one place. No vendor has been selected; crm-test-connection and
-- crm-sync-worker (Edge Functions) only implement the 'mock' provider_key
-- honestly, and refuse any other provider rather than pretending to
-- support it. Additive on top of 20261118110000.
--
-- Every parameter below is named to avoid exactly matching any column on
-- crm_sync_jobs (integration_id, trigger, payload, idempotency_key), which
-- is what caused the ambiguous-column bugs fixed in bbeb511; table
-- references are also aliased and qualified as a second layer of defence.

CREATE OR REPLACE FUNCTION public.enqueue_crm_sync(
  integ_id UUID,
  sync_trigger TEXT,
  sync_payload JSONB DEFAULT '{}'::jsonb,
  sync_idempotency_key TEXT DEFAULT NULL
)
RETURNS public.crm_sync_jobs
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  integ public.crm_integrations;
  job public.crm_sync_jobs;
  resolved_key TEXT := COALESCE(sync_idempotency_key, gen_random_uuid()::text);
BEGIN
  SELECT * INTO job FROM public.crm_sync_jobs j WHERE j.idempotency_key = resolved_key;
  IF job.id IS NOT NULL THEN RETURN job; END IF;

  SELECT * INTO integ FROM public.crm_integrations ci WHERE ci.id = integ_id;
  IF integ.id IS NULL THEN RAISE EXCEPTION 'integration not found' USING ERRCODE = 'P0002'; END IF;
  IF NOT public.can_edit_org(integ.org_id) THEN
    RAISE EXCEPTION 'not allowed to sync integrations in this organisation' USING ERRCODE = '42501';
  END IF;
  IF integ.status <> 'enabled' THEN
    RAISE EXCEPTION 'integration % is % not enabled', integ.name, integ.status USING ERRCODE = 'P0001';
  END IF;
  IF length(btrim(sync_trigger)) = 0 THEN
    RAISE EXCEPTION 'sync_trigger must not be empty' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.crm_sync_jobs (org_id, integration_id, trigger, payload, idempotency_key)
  VALUES (integ.org_id, integ.id, sync_trigger, sync_payload, resolved_key)
  RETURNING * INTO job;
  RETURN job;
END;
$$;
GRANT EXECUTE ON FUNCTION public.enqueue_crm_sync(UUID, TEXT, JSONB, TEXT) TO authenticated;
