-- Recording upload (Phase 1): create_recording() is the one path that
-- writes a recordings metadata row, because the plain "editors insert
-- recordings" RLS (super_admin/org_admin/supervisor only) has the same gap
-- already fixed for transcripts in append_transcript_segment() -- an agent
-- who personally ran the call could never register its own recording.
-- Fails safe: refuses when calls.recording_allowed is false, the same
-- consent decision start_call() already made, never re-derived or
-- trusted from the client. The storage INSERT policy on the 'recordings'
-- bucket gets the matching exception, so an agent can actually upload the
-- bytes before calling this function. Additive on top of 20261118170000.

CREATE OR REPLACE FUNCTION public.create_recording(
  target_call_id UUID,
  recording_object_path TEXT,
  recording_format TEXT DEFAULT 'audio/webm',
  recording_size_bytes BIGINT DEFAULT NULL,
  recording_duration_ms INT DEFAULT NULL,
  recording_checksum TEXT DEFAULT NULL
)
RETURNS public.recordings
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  c public.calls;
  rec public.recordings;
BEGIN
  SELECT * INTO c FROM public.calls WHERE id = target_call_id;
  IF c.id IS NULL THEN RAISE EXCEPTION 'call not found' USING ERRCODE = 'P0002'; END IF;
  IF c.started_by IS DISTINCT FROM auth.uid() AND NOT public.can_edit_org(c.org_id) THEN
    RAISE EXCEPTION 'not allowed to create a recording for this call' USING ERRCODE = '42501';
  END IF;
  IF NOT c.recording_allowed THEN
    RAISE EXCEPTION 'recording is not allowed for this call: %', COALESCE(c.recording_skip_reason, 'consent not satisfied') USING ERRCODE = 'P0001';
  END IF;
  IF recording_object_path NOT LIKE ('org/' || c.org_id::TEXT || '/%') THEN
    RAISE EXCEPTION 'object_path must live under this call''s own organisation' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.recordings (org_id, call_id, object_path, format, size_bytes, duration_ms, checksum, status, consent_policy_id, consent_outcome)
  VALUES (
    c.org_id, c.id, recording_object_path, recording_format, recording_size_bytes, recording_duration_ms, recording_checksum,
    'uploaded', c.consent_policy_id, CASE WHEN c.consent_outcome = 'given' THEN 'given' ELSE 'not_required' END
  )
  RETURNING * INTO rec;

  PERFORM public.log_audit(c.org_id, format('recording.created for call %s', c.id));
  RETURN rec;
END;
$$;
GRANT EXECUTE ON FUNCTION public.create_recording(UUID, TEXT, TEXT, BIGINT, INT, TEXT) TO authenticated;

-- Matches the same ownership exception as create_recording(): the agent who
-- started a call may upload bytes under their own organisation's recordings
-- folder, not only editors. create_recording() above is the real guard
-- against writing a row for someone else's call; this only bounds where
-- the raw object may land.
DROP POLICY IF EXISTS "editors upload org recordings" ON storage.objects;
CREATE POLICY "authorised upload org recordings" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'recordings' AND (public.can_edit_org(public.object_org(name)) OR public.org_role(public.object_org(name)) = 'agent'));
