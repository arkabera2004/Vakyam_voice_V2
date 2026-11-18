-- Fixes a real gap between documented and enforced access: src/domain/roles.ts's
-- canPlayRecording() explicitly allows an agent to play back the recording
-- of a call they personally started ("agents may play their own calls"),
-- but the storage RLS policy added in 20261117100000 only ever checked
-- can_review_org(), with no such exception -- an agent could never actually
-- hear their own call's recording. can_play_recording_object() mirrors
-- canPlayRecording()'s exact rule in SQL, and replaces the storage policy
-- with it. Additive on top of 20261118160000.

CREATE OR REPLACE FUNCTION public.can_play_recording_object(object_name TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  recording_org UUID := public.object_org(object_name);
  caller_role TEXT;
  owns_call BOOLEAN;
BEGIN
  IF recording_org IS NULL THEN RETURN false; END IF;
  IF public.can_review_org(recording_org) THEN RETURN true; END IF;

  caller_role := public.org_role(recording_org);
  IF caller_role IS DISTINCT FROM 'agent' THEN RETURN false; END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.recordings rec
    JOIN public.calls c ON c.id = rec.call_id
    WHERE rec.object_path = object_name AND rec.org_id = recording_org AND c.started_by = auth.uid()
  ) INTO owns_call;
  RETURN COALESCE(owns_call, false);
END;
$$;

DROP POLICY IF EXISTS "reviewers read org recordings" ON storage.objects;
CREATE POLICY "authorised read org recordings" ON storage.objects
  FOR SELECT USING (bucket_id = 'recordings' AND public.can_play_recording_object(name));
