-- Enables Supabase Realtime (postgres_changes) for the two tables
-- LiveCallDetail.tsx subscribes to. A table must be explicitly added to the
-- supabase_realtime publication before any client subscription receives
-- anything from it -- this is server-side configuration, not something
-- client code alone can turn on. RLS still applies to realtime broadcasts
-- (a subscriber only receives changes to rows they could otherwise SELECT),
-- so this does not widen who can see a call or its transcript.

ALTER PUBLICATION supabase_realtime ADD TABLE public.calls;
ALTER PUBLICATION supabase_realtime ADD TABLE public.transcript_segments;
