-- Retention support (Phase 7): legal hold on recordings and transcripts, a
-- soft-delete trail on transcripts matching the one recordings already has,
-- and a structured record of every sweep run (dry-run or live) for
-- operational evidence. Additive on top of 20261117100000.

ALTER TABLE public.recordings ADD COLUMN legal_hold BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.transcripts
  ADD COLUMN legal_hold BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN deleted_at TIMESTAMPTZ,
  ADD COLUMN deletion_reason TEXT;

-- Managers place or lift a legal hold; audited either way. SECURITY DEFINER
-- so it works across both tables without two near-identical RLS UPDATE paths.
CREATE OR REPLACE FUNCTION public.set_legal_hold(target TEXT, row_id UUID, hold BOOLEAN)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE row_org UUID;
BEGIN
  IF target NOT IN ('recording', 'transcript') THEN
    RAISE EXCEPTION 'target must be recording or transcript' USING ERRCODE = '22023';
  END IF;

  IF target = 'recording' THEN
    SELECT org_id INTO row_org FROM public.recordings WHERE id = row_id FOR UPDATE;
  ELSE
    SELECT org_id INTO row_org FROM public.transcripts WHERE id = row_id FOR UPDATE;
  END IF;
  IF row_org IS NULL THEN RAISE EXCEPTION '% not found', target USING ERRCODE = 'P0002'; END IF;
  IF NOT public.can_manage_org(row_org) THEN
    RAISE EXCEPTION 'not allowed to manage legal holds in this organisation' USING ERRCODE = '42501';
  END IF;

  IF target = 'recording' THEN
    UPDATE public.recordings SET legal_hold = hold WHERE id = row_id;
  ELSE
    UPDATE public.transcripts SET legal_hold = hold WHERE id = row_id;
  END IF;
  PERFORM public.log_audit(row_org, format('%s.legal_hold %s %s', target, row_id, hold));
  RETURN hold;
END;
$$;
GRANT EXECUTE ON FUNCTION public.set_legal_hold(TEXT, UUID, BOOLEAN) TO authenticated;

-- One row per (org, target) retention sweep. Written by the retention-sweep
-- function with the service role, which bypasses RLS, so only a read policy
-- is needed here; there is deliberately no client INSERT/UPDATE/DELETE path.
CREATE TABLE public.retention_runs (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    org_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
    target TEXT NOT NULL CHECK (target IN ('recording', 'transcript')),
    mode TEXT NOT NULL CHECK (mode IN ('dry-run', 'delete')),
    cutoff TIMESTAMPTZ NOT NULL,
    eligible_count INT NOT NULL DEFAULT 0,
    deleted_count INT NOT NULL DEFAULT 0,
    skipped JSONB NOT NULL DEFAULT '[]'::jsonb,
    error TEXT,
    run_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX retention_runs_org_idx ON public.retention_runs (org_id, run_at DESC);

ALTER TABLE public.retention_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reviewers read retention_runs" ON public.retention_runs
  FOR SELECT USING (public.can_review_org(org_id));
