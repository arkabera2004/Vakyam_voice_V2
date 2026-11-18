import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Dot, Panel, PanelHeader, Pill } from "@/console/ui";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type CallDetail = {
  id: string;
  callerName: string;
  status: string;
  language: string | null;
  outcome: string | null;
  failureReason: string | null;
  startedAt: string;
  durationMs: number | null;
  recordingAllowed: boolean;
};
type Segment = { seq: number; speaker: "agent" | "caller" | "system"; text: string; startMs: number };
type CriterionScore = { criterion: string; score: number; rationale: string };
type EvaluationDetail = { id: string; overallScore: number | null; flagged: boolean; scores: CriterionScore[] };
type RecordingInfo = { status: string; signedUrl: string | null };

const speakerLabel: Record<Segment["speaker"], string> = { agent: "Agent", caller: "Caller", system: "System" };

function formatDuration(ms: number | null): string {
  if (ms == null) return "—";
  const totalSeconds = Math.round(ms / 1000);
  return `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, "0")}`;
}

/** Reads the real call named by ?call=<uuid>, with its real transcript and evaluation if any exist. No invented transcript, waveform or disposition data. */
export default function CallReview() {
  const [params] = useSearchParams();
  const callId = params.get("call");

  const [call, setCall] = useState<CallDetail | null>(null);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [evaluation, setEvaluation] = useState<EvaluationDetail | null>(null);
  const [recording, setRecording] = useState<RecordingInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!callId) {
      setLoading(false);
      return;
    }
    void (async () => {
      setLoading(true);
      setLoadError(null);

      const { data: callRow, error: callError } = await supabase.from("calls").select("id, caller_name, status, language, outcome, failure_reason, started_at, duration_ms, recording_allowed").eq("id", callId).maybeSingle();
      if (callError) {
        setLoadError(callError.message);
        setLoading(false);
        return;
      }
      if (!callRow) {
        setLoadError("Call not found, or you do not have access to it.");
        setLoading(false);
        return;
      }
      setCall({ id: callRow.id, callerName: callRow.caller_name || "Unknown caller", status: callRow.status, language: callRow.language, outcome: callRow.outcome, failureReason: callRow.failure_reason, startedAt: callRow.started_at, durationMs: callRow.duration_ms, recordingAllowed: callRow.recording_allowed });

      const { data: transcriptRow } = await supabase.from("transcripts").select("id").eq("call_id", callId).maybeSingle();
      if (transcriptRow) {
        const { data: segmentRows } = await supabase.from("transcript_segments").select("seq, speaker, text, start_ms").eq("transcript_id", transcriptRow.id).order("seq");
        setSegments((segmentRows ?? []).map((s) => ({ seq: s.seq, speaker: s.speaker, text: s.text, startMs: s.start_ms })));
      }

      const { data: evalRow } = await supabase.from("evaluations").select("id, overall_score, flagged").eq("call_id", callId).order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (evalRow) {
        const { data: scoreRows } = await supabase.from("evaluation_scores").select("score, rationale, evaluation_criteria(name)").eq("evaluation_id", evalRow.id);
        setEvaluation({ id: evalRow.id, overallScore: evalRow.overall_score, flagged: evalRow.flagged, scores: (scoreRows ?? []).map((s) => ({ criterion: s.evaluation_criteria?.name ?? "Criterion", score: s.score, rationale: s.rationale })) });
      }

      const { data: recordingRow } = await supabase.from("recordings").select("status, bucket, object_path").eq("call_id", callId).maybeSingle();
      if (recordingRow) {
        const { data: signed } = await supabase.storage.from(recordingRow.bucket).createSignedUrl(recordingRow.object_path, 300);
        setRecording({ status: recordingRow.status, signedUrl: signed?.signedUrl ?? null });
      }

      setLoading(false);
    })();
  }, [callId]);

  const share = async () => {
    const url = `${location.origin}/console/review?call=${callId}`;
    try {
      await navigator.clipboard.writeText(url);
      toast({ title: "Link copied" });
    } catch {
      toast({ title: "Share this link", description: url });
    }
  };

  if (!callId) {
    return (
      <Panel className="p-8 text-center">
        <p className="text-sm text-zinc-600">Open a call from Live calls or QA scorecards to review it here.</p>
      </Panel>
    );
  }
  if (loading) return <Panel className="p-8 text-center text-sm text-zinc-500">Loading…</Panel>;
  if (loadError || !call) return <Panel className="p-8 text-center text-sm text-red-600">{loadError ?? "Call not found."}</Panel>;

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-[-0.02em]">{call.callerName}</h1>
          <p className="text-[13px] text-zinc-500">
            {new Date(call.startedAt).toLocaleString()}, {formatDuration(call.durationMs)} long{call.language ? `, ${call.language}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Pill tone={call.status === "completed" ? "green" : call.status === "failed" ? "red" : "neutral"}>{call.status}</Pill>
          {call.outcome && <Pill>{call.outcome}</Pill>}
          <button onClick={share} className="text-xs font-medium text-[#E2703A]">Share link</button>
        </div>
      </div>
      {call.failureReason && <Panel className="mb-4 p-3 text-sm text-red-700">Failure reason: {call.failureReason}</Panel>}

      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <div className="space-y-4">
          <Panel className="p-4">
            <div className="flex items-center justify-between text-sm">
              <span className="font-semibold">Recording</span>
              {!call.recordingAllowed ? (
                <span className="text-zinc-500">Not recorded (consent policy did not allow it)</span>
              ) : recording?.signedUrl ? (
                <audio controls src={recording.signedUrl} className="h-8" />
              ) : (
                <span className="text-zinc-500">{recording ? `Recording ${recording.status}` : "No recording for this call"}</span>
              )}
            </div>
          </Panel>

          <Panel>
            <PanelHeader title="Transcript" hint={segments.length === 0 ? "No segments yet" : `${segments.length} segments`} />
            {segments.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-zinc-500">No transcript has been captured for this call yet.</p>
            ) : (
              <ol className="px-4 py-2">
                {segments.map((turn) => (
                  <li key={turn.seq} className="py-2.5">
                    <div className="grid grid-cols-[64px_1fr] gap-3">
                      <span className="text-xs tabular-nums text-zinc-400">{formatDuration(turn.startMs)}</span>
                      <div>
                        <span className="text-xs font-semibold text-zinc-700">{speakerLabel[turn.speaker]}</span>
                        <p className="mt-0.5 text-sm text-zinc-800">{turn.text}</p>
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </Panel>
        </div>

        <div className="space-y-4">
          <Panel>
            {evaluation ? (
              <>
                <div className="flex items-center gap-4 px-4 py-4">
                  <span className="text-[44px] font-semibold leading-none tracking-[-0.03em]">{evaluation.overallScore?.toFixed(0) ?? "—"}</span>
                  <div className="flex-1">
                    <p className="text-sm font-semibold">QA score</p>
                    <p className="text-xs text-zinc-500">{evaluation.scores.length} criteria scored</p>
                  </div>
                  <Pill tone={evaluation.flagged ? "red" : "green"}>{evaluation.flagged ? "Flagged" : "Pass"}</Pill>
                </div>
                <ul className="divide-y divide-zinc-100 border-t border-zinc-100 px-4">
                  {evaluation.scores.map((s) => (
                    <li key={s.criterion} className="flex items-center justify-between py-2.5">
                      <div>
                        <p className="text-sm font-medium">{s.criterion}</p>
                        {s.rationale && <p className="text-xs text-zinc-500">{s.rationale}</p>}
                      </div>
                      <span className={cn("text-sm font-semibold", s.score < 75 && "text-red-600")}>{s.score}</span>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="p-4 text-sm text-zinc-500">This call has not been evaluated yet.</p>
            )}
          </Panel>

          <Panel className="p-4 text-sm">
            <p className="flex items-center gap-2 text-zinc-600"><Dot tone={call.status === "completed" ? "green" : call.status === "failed" ? "red" : "amber"} /> Call {call.status}</p>
          </Panel>
        </div>
      </div>
    </>
  );
}
