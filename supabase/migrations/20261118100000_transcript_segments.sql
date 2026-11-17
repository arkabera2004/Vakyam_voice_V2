-- append_transcript_segment(): the only way a client writes a transcript
-- segment. Creates the call's transcripts row on first use. Only usable by
-- the call's own owner or an org editor, consistent with advance_call()'s
-- ownership check. Additive on top of 20261117150000.
--
-- Scope note: today only the agent's spoken turns can be captured this way,
-- from the text events the text + Azure-Speech voice path already emits
-- (src/hooks/useVoiceAgent.ts). The caller's (member's) turns require Azure
-- Realtime's input_audio_transcription to be requested in the session, a
-- live-Azure-only change not verified in this environment; see
-- docs/CONTINUATION_STATUS.md.

CREATE OR REPLACE FUNCTION public.append_transcript_segment(
  call_id UUID,
  speaker TEXT,
  segment_text TEXT,
  start_ms INT DEFAULT 0,
  is_final BOOLEAN DEFAULT true,
  language TEXT DEFAULT NULL
)
RETURNS public.transcript_segments
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  c public.calls;
  t public.transcripts;
  next_seq INT;
  seg public.transcript_segments;
BEGIN
  SELECT * INTO c FROM public.calls WHERE id = call_id;
  IF c.id IS NULL THEN
    RAISE EXCEPTION 'call not found' USING ERRCODE = 'P0002';
  END IF;
  IF c.started_by IS DISTINCT FROM auth.uid() AND NOT public.can_edit_org(c.org_id) THEN
    RAISE EXCEPTION 'not allowed to add a transcript segment to this call' USING ERRCODE = '42501';
  END IF;
  IF speaker NOT IN ('agent', 'caller', 'system') THEN
    RAISE EXCEPTION 'speaker must be agent, caller or system' USING ERRCODE = '22023';
  END IF;
  IF length(btrim(segment_text)) = 0 THEN
    RAISE EXCEPTION 'segment_text must not be empty' USING ERRCODE = '22023';
  END IF;

  -- Aliased and qualified: call_id is both this function's parameter and a
  -- real column on transcripts, which PL/pgSQL treats as ambiguous
  -- (variable_conflict defaults to 'error') unless disambiguated.
  SELECT * INTO t FROM public.transcripts tr WHERE tr.call_id = c.id;
  IF t.id IS NULL THEN
    INSERT INTO public.transcripts (org_id, call_id, provider, language, status)
    VALUES (c.org_id, c.id, 'azure', language, 'partial')
    RETURNING * INTO t;
  END IF;

  SELECT COALESCE(max(tseq.seq), 0) + 1 INTO next_seq FROM public.transcript_segments tseq WHERE tseq.transcript_id = t.id;
  INSERT INTO public.transcript_segments (org_id, transcript_id, seq, speaker, start_ms, text, language, is_final)
  VALUES (c.org_id, t.id, next_seq, speaker, start_ms, segment_text, language, is_final)
  RETURNING * INTO seg;

  RETURN seg;
END;
$$;
GRANT EXECUTE ON FUNCTION public.append_transcript_segment(UUID, TEXT, TEXT, INT, BOOLEAN, TEXT) TO authenticated;

-- A transcript with any segments is "final" once its call reaches a
-- terminal state: nothing further will ever be appended to it.
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

  IF next_status IN ('completed', 'failed', 'cancelled', 'abandoned') THEN
    UPDATE public.transcripts SET status = 'final', updated_at = now() WHERE call_id = c.id AND status = 'partial';
  END IF;

  INSERT INTO public.call_events (org_id, call_id, seq, type, payload)
  VALUES (c.org_id, c.id,
          COALESCE((SELECT max(seq) FROM public.call_events WHERE call_id = c.id), 0) + 1,
          'status.' || next_status,
          jsonb_build_object('reason', reason, 'by', auth.uid()));
  RETURN c;
END;
$$;
