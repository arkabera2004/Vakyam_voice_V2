import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Avatar, Panel, PanelHeader, Pill } from "@/console/ui";
import { supabase } from "@/integrations/supabase/client";

type CallInfo = { id: string; callerName: string; status: string; language: string | null; sentiment: string | null; startedAt: string };
type Segment = { seq: number; speaker: "agent" | "caller" | "system"; text: string };

const speakerLabel: Record<Segment["speaker"], string> = { agent: "Agent", caller: "Caller", system: "System" };

/**
 * Real call info and a live transcript via Supabase Realtime. No whisper,
 * barge-in or takeover controls: this product is single-party browser
 * calls, with no server-side audio-mixing architecture that could let a
 * supervisor join or inject audio into one. No tool trace either: the
 * realtime agent has no tools wired yet (see GAP-B-02 in the production
 * gap register).
 */
export default function LiveCallDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [call, setCall] = useState<CallInfo | null>(null);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    void (async () => {
      setLoading(true);
      setLoadError(null);
      const { data: callRow, error: callError } = await supabase.from("calls").select("id, caller_name, status, language, sentiment, started_at").eq("id", id).maybeSingle();
      if (cancelled) return;
      if (callError) {
        setLoadError(callError.message);
        setLoading(false);
        return;
      }
      if (!callRow) {
        setLoading(false);
        return;
      }
      setCall({ id: callRow.id, callerName: callRow.caller_name || "Unknown caller", status: callRow.status, language: callRow.language, sentiment: callRow.sentiment, startedAt: callRow.started_at });

      const { data: transcriptRow } = await supabase.from("transcripts").select("id").eq("call_id", id).maybeSingle();
      if (cancelled || !transcriptRow) {
        setLoading(false);
        return;
      }
      const { data: segmentRows } = await supabase.from("transcript_segments").select("seq, speaker, text").eq("transcript_id", transcriptRow.id).order("seq");
      if (cancelled) return;
      setSegments((segmentRows ?? []).map((s) => ({ seq: s.seq, speaker: s.speaker, text: s.text })));
      setLoading(false);

      // New segments and call status changes stream in live while the call is on this page.
      channel = supabase
        .channel(`live-call-${id}`)
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "transcript_segments", filter: `transcript_id=eq.${transcriptRow.id}` }, (payload) => {
          const row = payload.new as { seq: number; speaker: Segment["speaker"]; text: string };
          setSegments((prev) => (prev.some((s) => s.seq === row.seq) ? prev : [...prev, { seq: row.seq, speaker: row.speaker, text: row.text }]));
        })
        .on("postgres_changes", { event: "UPDATE", schema: "public", table: "calls", filter: `id=eq.${id}` }, (payload) => {
          const row = payload.new as { status: string; sentiment: string | null };
          setCall((prev) => (prev ? { ...prev, status: row.status, sentiment: row.sentiment } : prev));
        })
        .subscribe();
    })();

    return () => {
      cancelled = true;
      if (channel) void supabase.removeChannel(channel);
    };
  }, [id]);

  if (loading) return <Panel className="p-8 text-center text-sm text-zinc-500">Loading…</Panel>;
  if (loadError) return <Panel className="p-8 text-center text-sm text-red-600">{loadError}</Panel>;
  if (!call) {
    return (
      <Panel className="p-8 text-center text-sm text-zinc-500">
        Call {id} is not live any more. <button className="font-medium text-[#E2703A]" onClick={() => navigate("/console/live")}>Back to the live wall</button>
      </Panel>
    );
  }

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Avatar name={call.callerName} size={40} />
          <div>
            <h1 className="text-2xl font-semibold tracking-[-0.02em]">{call.callerName}</h1>
            <p className="text-[13px] text-zinc-500">Started {new Date(call.startedAt).toLocaleString()}{call.language ? `, ${call.language}` : ""}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Pill tone={call.status === "active" ? "green" : call.status === "interrupted" ? "amber" : "neutral"}>{call.status}</Pill>
          {call.sentiment && <Pill tone={call.sentiment === "Frustrated" ? "red" : call.sentiment === "Positive" ? "green" : "neutral"}>{call.sentiment}</Pill>}
        </div>
      </div>

      <Panel className="min-h-[520px]">
        <PanelHeader title="Live transcript" hint="Updates as the call continues" />
        {segments.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-zinc-500">No transcript yet.</p>
        ) : (
          <ol className="px-4 py-2">
            {segments.map((turn) => (
              <li key={turn.seq} className="py-2.5">
                <span className="text-xs font-semibold text-zinc-700">{speakerLabel[turn.speaker]}</span>
                <p className="mt-0.5 text-sm leading-relaxed text-zinc-800">{turn.text}</p>
              </li>
            ))}
          </ol>
        )}
      </Panel>
    </>
  );
}
