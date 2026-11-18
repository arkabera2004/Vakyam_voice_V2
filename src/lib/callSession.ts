// Persists a browser voice session to the database: one start_call() RPC
// call to create the row (org/agent/permission resolution happens there,
// never duplicated here), then advance_call() RPC calls as the WebRTC
// connection's real lifecycle unfolds. The client takes the minimal
// interface it needs rather than the full supabase-js client, so this stays
// unit-testable without mocking the SDK.

import type { SessionState } from "@/domain/sessionState";

export type RpcClient = {
  rpc: (fn: string, args?: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { code?: string; message: string } | null }>;
};

export type StartedCall = { callId: string; orgId: string; agentId: string | null; agentVersionId: string | null; recordingAllowed: boolean; recordingSkipReason: string | null };
export type StartCallResult = { ok: true; call: StartedCall } | { ok: false; error: string };

/** Maps start_call()'s Postgres error codes to messages safe to show the caller. */
export function describeStartCallError(error: { code?: string; message: string } | null | undefined): string {
  switch (error?.code) {
    case "P0003":
      return "You do not belong to an organisation yet. Ask an administrator to invite you.";
    case "42501":
      return "Your role is not allowed to start a voice call.";
    case "P0004":
      return "Your organisation has no voice agent configured yet.";
    case "P0002":
      return "That voice agent could not be found.";
    default:
      return error?.message || "The voice session could not be created. Please try again.";
  }
}

type StartCallRow = { id: string; org_id: string; agent_id: string | null; agent_version_id: string | null; recording_allowed: boolean; recording_skip_reason: string | null };

/** Creates the database call record before any microphone or provider request, so a permission or configuration problem is caught first. */
export async function createCallSession(client: RpcClient, agentId?: string): Promise<StartCallResult> {
  const { data, error } = await client.rpc("start_call", { agent: agentId ?? null });
  if (error || !data) return { ok: false, error: describeStartCallError(error) };
  const row = data as StartCallRow;
  return {
    ok: true,
    call: { callId: row.id, orgId: row.org_id, agentId: row.agent_id, agentVersionId: row.agent_version_id, recordingAllowed: row.recording_allowed, recordingSkipReason: row.recording_skip_reason },
  };
}

/**
 * Advances the call's recorded state. Best-effort: a failure here (a race
 * with another transition, or the row having reached a terminal state
 * already) is logged, not thrown, since it must never interrupt the live
 * call for the person on it. advance_call() is idempotent for a repeated
 * same-state call, so reporting "active" on every ICE reconnect is safe.
 */
export async function advanceCallSession(client: RpcClient, callId: string, status: SessionState, reason?: string): Promise<void> {
  const { error } = await client.rpc("advance_call", { call: callId, next_status: status, reason: reason ?? null });
  if (error) console.error(`advance_call(${callId} -> ${status}) failed:`, error.message);
}

export type TranscriptSpeaker = "agent" | "caller" | "system";

/**
 * Appends one finished spoken turn to the call's transcript. Best-effort,
 * like advanceCallSession: a dropped segment should never interrupt the
 * live call. Blank text is silently skipped rather than sent, since the
 * server rejects it anyway and an empty turn carries nothing worth keeping.
 */
export async function appendTranscriptSegment(client: RpcClient, callId: string, speaker: TranscriptSpeaker, text: string): Promise<void> {
  if (!text.trim()) return;
  const { error } = await client.rpc("append_transcript_segment", { call_id: callId, speaker, segment_text: text });
  if (error) console.error(`append_transcript_segment(${callId}, ${speaker}) failed:`, error.message);
}

export type NewRecording = { objectPath: string; format: string; sizeBytes: number; durationMs: number; checksum?: string };

/**
 * Registers an already-uploaded recording's metadata. Best-effort like the
 * other calls here: a failure leaves the uploaded object orphaned (no row
 * ever points to it, so it stays unreachable through playback) rather than
 * retrying against a live call that has already ended.
 */
export async function createRecording(client: RpcClient, callId: string, recording: NewRecording): Promise<void> {
  const { error } = await client.rpc("create_recording", {
    target_call_id: callId,
    recording_object_path: recording.objectPath,
    recording_format: recording.format,
    recording_size_bytes: recording.sizeBytes,
    recording_duration_ms: recording.durationMs,
    recording_checksum: recording.checksum ?? null,
  });
  if (error) console.error(`create_recording(${callId}) failed:`, error.message);
}
