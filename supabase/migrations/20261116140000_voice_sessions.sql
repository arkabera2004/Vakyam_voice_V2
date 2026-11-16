-- Every token issued by the realtime-token function is recorded here, so the
-- function can refuse a caller who has minted too many sessions in the last
-- hour (GAP-S-02). Rows are written with the caller's own JWT under RLS.
CREATE TABLE public.voice_sessions (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
    kind TEXT NOT NULL CHECK (kind IN ('realtime', 'speech')),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX voice_sessions_user_created_idx ON public.voice_sessions (user_id, created_at DESC);

ALTER TABLE public.voice_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can see their own voice sessions"
ON public.voice_sessions FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can record their own voice sessions"
ON public.voice_sessions FOR INSERT
WITH CHECK (auth.uid() = user_id);
