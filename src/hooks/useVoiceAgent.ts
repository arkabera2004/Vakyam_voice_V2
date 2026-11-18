import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { SpeechOutput } from "@/lib/speechOutput";
import { advanceCallSession, appendTranscriptSegment, createCallSession, createRecording } from "@/lib/callSession";
import { pickRecorderMimeType, recordingObjectPath, stopRecorder } from "@/lib/callRecorder";
import type { SessionState } from "@/domain/sessionState";

export type VoiceStatus = "idle" | "connecting" | "connected" | "speaking" | "listening" | "error";

interface UseVoiceAgentReturn {
  status: VoiceStatus;
  isSpeaking: boolean;
  error: string | null;
  startCall: () => Promise<void>;
  endCall: () => void;
}

/** Calls are cut off after this long so a forgotten tab cannot run up cost. */
const MAX_CALL_MS = 10 * 60 * 1000;

interface Call {
  peer: RTCPeerConnection;
  microphone: MediaStream;
  audio: HTMLAudioElement;
  timeout: number;
  /** Set when Meera speaks with a native Indian Azure voice. */
  speech?: SpeechOutput;
  context: AudioContext;
  orgId: string;
  /** Set only when calls.recording_allowed was true at call creation. */
  recorder?: MediaRecorder;
  recordingChunks?: Blob[];
  recordingStartedAt?: number;
}

/**
 * Asks for a voice session. With speechOnly, only an Azure Speech token comes
 * back and no realtime session is spent, and no callId is needed. For a full
 * session, callId names the calls row start_call() already created, so the
 * function uses that call's own agent configuration. VITE_REALTIME_TOKEN_URL
 * points at a locally served copy of the realtime-token function, for trying
 * changes before deploying it.
 */
export const requestSession = async (speechOnly = false, callId?: string) => {
  const body = { speechOnly, callId: callId ?? null };
  const localUrl = import.meta.env.VITE_REALTIME_TOKEN_URL as string | undefined;
  if (!localUrl) return supabase.functions.invoke("realtime-token", { body });
  const { data: auth } = await supabase.auth.getSession();
  const response = await fetch(localUrl, {
    method: "POST",
    headers: { Authorization: `Bearer ${auth.session?.access_token ?? ""}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  return { data, error: response.ok ? null : new Error(data?.error || `HTTP ${response.status}`) };
};

/**
 * supabase.functions.invoke hides the function's JSON body behind a generic
 * "non-2xx" message; read {error} from the response when there is one.
 */
export const functionErrorMessage = async (error: unknown): Promise<string | undefined> => {
  if (!error) return undefined;
  const context = (error as { context?: unknown }).context;
  if (context instanceof Response) {
    try {
      const body = (await context.clone().json()) as { error?: unknown };
      if (typeof body?.error === "string" && body.error) return body.error;
    } catch {
      /* not JSON */
    }
  }
  return error instanceof Error ? error.message : undefined;
};

const getErrorMessage = (value: unknown): string => {
  if (value instanceof DOMException && value.name === "NotAllowedError") {
    return "Microphone access was blocked. Allow the microphone for this site and try again.";
  }
  if (value instanceof DOMException && value.name === "NotFoundError") {
    return "No microphone was found. Check your browser audio input settings.";
  }
  if (value instanceof DOMException && value.name === "NotReadableError") {
    return "The microphone is busy. Close other apps or tabs that are using it and try again.";
  }
  if (value instanceof Error && value.message) return value.message;
  return "The voice call could not be started. Please try again.";
};

export const useVoiceAgent = (): UseVoiceAgentReturn => {
  const [status, setStatus] = useState<VoiceStatus>("idle");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const callRef = useRef<Call | null>(null);
  // Bumped on every start and stop, so a start that is still in flight can
  // tell it has been cancelled.
  const attemptRef = useRef(0);

  // Tracked separately from `Call` because the database row exists before
  // the WebRTC peer does (start_call() runs first, so an org/agent/
  // permission problem is caught before ever asking for the microphone).
  const callIdRef = useRef<string | null>(null);
  const reachedActiveRef = useRef(false);
  // Set by fail() so teardown() reports the real reason instead of guessing
  // completed/cancelled from reachedActiveRef.
  const outcomeRef = useRef<{ status: SessionState; reason?: string } | null>(null);

  const teardown = useCallback(() => {
    attemptRef.current += 1;
    const id = callIdRef.current;
    const wasActive = reachedActiveRef.current;
    const outcome = outcomeRef.current;
    callIdRef.current = null;
    reachedActiveRef.current = false;
    outcomeRef.current = null;
    if (id) {
      const finalStatus = outcome?.status ?? (wasActive ? "completed" : "cancelled");
      void advanceCallSession(supabase, id, finalStatus, outcome?.reason);
    }

    const call = callRef.current;
    callRef.current = null;
    if (!call) return;

    // Started before the rest of cleanup, since stopRecorder() calls
    // recorder.stop() synchronously and that must happen while the
    // recording's audio graph (the context, the mic track) is still alive.
    if (call.recorder && call.recordingChunks) {
      const { recorder, recordingChunks, orgId, recordingStartedAt } = call;
      void (async () => {
        const blob = await stopRecorder(recorder, recordingChunks);
        if (blob.size === 0) return;
        const path = recordingObjectPath(orgId, id ?? "unknown", recorder.mimeType);
        const { error: uploadError } = await supabase.storage.from("recordings").upload(path, blob, { contentType: blob.type || "audio/webm" });
        if (uploadError) {
          console.error("Could not upload the call recording:", uploadError.message);
          return;
        }
        if (id) {
          await createRecording(supabase, id, { objectPath: path, format: blob.type || "audio/webm", sizeBytes: blob.size, durationMs: recordingStartedAt ? Date.now() - recordingStartedAt : 0 });
        }
      })();
    }

    window.clearTimeout(call.timeout);
    call.microphone.getTracks().forEach((track) => track.stop());
    call.peer.close();
    call.audio.srcObject = null;
    call.speech?.close();
    void call.context.close();
  }, []);

  useEffect(() => teardown, [teardown]);

  const endCall = useCallback(() => {
    teardown();
    setStatus("idle");
    setIsSpeaking(false);
  }, [teardown]);

  const startCall = useCallback(async () => {
    teardown();
    const attempt = attemptRef.current;
    setStatus("connecting");
    setError(null);

    // Resolves the caller's organisation, agent and permission to use it,
    // and creates the database call record, before ever asking for the
    // microphone. Keeps that business logic server-side in start_call()
    // rather than duplicated here.
    const created = await createCallSession(supabase);
    if (attempt !== attemptRef.current) {
      // Superseded while the call was being created: nothing here set
      // callIdRef yet, so finalise this specific orphaned row directly
      // rather than risk racing the next attempt's own tracking.
      if (created.ok) void advanceCallSession(supabase, created.call.callId, "cancelled", "superseded by a new call attempt");
      return;
    }
    if (created.ok === false) {
      setError(created.error);
      setStatus("error");
      return;
    }
    callIdRef.current = created.call.callId;
    void advanceCallSession(supabase, created.call.callId, "initializing");

    let microphone: MediaStream | null = null;
    let peer: RTCPeerConnection | null = null;
    // Created during the click, so the browser lets it play sound later.
    const context = new AudioContext({ sampleRate: 24000 });
    let speech: SpeechOutput | undefined;
    // start_call() already decided this, fail-safe; it is never re-derived
    // or trusted from anywhere else in the browser.
    const shouldRecord = created.call.recordingAllowed;
    let recordingDestination: MediaStreamAudioDestinationNode | undefined;

    const fail = (cause: unknown) => {
      console.error("Voice call failed:", cause);
      microphone?.getTracks().forEach((track) => track.stop());
      peer?.close();
      speech?.close();
      void context.close();
      if (attempt !== attemptRef.current) return;
      const message = getErrorMessage(cause);
      outcomeRef.current = { status: "failed", reason: message };
      teardown();
      setError(message);
      setStatus("error");
      setIsSpeaking(false);
    };

    try {
      // Ask for the microphone and the session token at the same time; they
      // are independent and together make up most of the connection wait.
      const [stream, session] = await Promise.all([
        navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        }),
        requestSession(false, created.call.callId),
      ]);
      microphone = stream;

      if (shouldRecord) {
        try {
          recordingDestination = context.createMediaStreamDestination();
          context.createMediaStreamSource(stream).connect(recordingDestination);
        } catch (cause) {
          // Recording is an adjunct to the call, never a reason to fail it.
          console.error("Could not set up call recording:", cause);
          recordingDestination = undefined;
        }
      }

      const { data, error: tokenError } = session;
      if (tokenError || !data?.token || !data?.callUrl) {
        throw new Error(data?.error || (await functionErrorMessage(tokenError)) || "Failed to get a voice session");
      }
      if (data.speech) {
        const { SpeechOutput } = await import("@/lib/speechOutput");
        // On this path the agent's audio is synthesised locally, not carried
        // on the WebRTC remote track, so recordingDestination is given here
        // directly rather than tapped from ontrack below.
        speech = new SpeechOutput(
          data.speech,
          context,
          (speaking) => {
            if (attempt !== attemptRef.current) return;
            setIsSpeaking(speaking);
            setStatus(speaking ? "speaking" : "listening");
          },
          recordingDestination,
        );
      }
      if (attempt !== attemptRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        speech?.close();
        void context.close();
        return;
      }

      peer = new RTCPeerConnection();
      const connection = peer;
      const audio = new Audio();
      audio.autoplay = true;

      // Only ever set up once recordingDestination carries both sides'
      // audio: the mic (always, above) and, for the raw-audio path, the
      // remote track once ontrack below fires. isTypeSupported is guarded
      // the same defensive way as the mic tap -- a browser without
      // MediaRecorder support must not break the call itself.
      let recorder: MediaRecorder | undefined;
      let recordingChunks: Blob[] | undefined;
      let recordingStartedAt: number | undefined;
      if (recordingDestination) {
        try {
          const mimeType = pickRecorderMimeType((type) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(type));
          recorder = new MediaRecorder(recordingDestination.stream, mimeType ? { mimeType } : undefined);
          recordingChunks = [];
          const chunks = recordingChunks;
          recorder.addEventListener("dataavailable", (event) => {
            if (event.data.size > 0) chunks.push(event.data);
          });
          recorder.start();
          recordingStartedAt = Date.now();
        } catch (cause) {
          console.error("Could not start the call recorder:", cause);
          recorder = undefined;
          recordingChunks = undefined;
        }
      }

      // Registered before negotiating, so ending the call at any point from
      // here on releases the microphone and the connection.
      callRef.current = {
        peer: connection,
        microphone: stream,
        audio,
        timeout: window.setTimeout(endCall, MAX_CALL_MS),
        speech,
        context,
        orgId: created.call.orgId,
        recorder,
        recordingChunks,
        recordingStartedAt,
      };
      connection.ontrack = (event) => {
        audio.srcObject = event.streams[0];
        // The raw-audio path: the agent's voice arrives on this remote
        // track, so it is tapped here rather than at SpeechOutput (which is
        // never constructed on this path).
        if (recordingDestination) {
          try {
            context.createMediaStreamSource(event.streams[0]).connect(recordingDestination);
          } catch (cause) {
            console.error("Could not tap the remote track for recording:", cause);
          }
        }
      };
      stream.getAudioTracks().forEach((track) => connection.addTrack(track, stream));

      const events = connection.createDataChannel("realtime-channel");
      events.addEventListener("open", () => {
        // Meera speaks first, as on a phone line.
        events.send(
          JSON.stringify({
            type: "response.create",
            response: {
              instructions: `Open the call by saying exactly this, and nothing else: "${data.firstMessage}"`,
            },
          }),
        );
      });
      // Accumulates the model's text deltas into one finished turn, persisted
      // as a transcript segment on "done". Only available on the text +
      // Azure-Speech voice path: the raw-audio path has no text to capture,
      // and the caller's (member's) turns need Azure's
      // input_audio_transcription enabled in the session, not done here
      // (see docs/CONTINUATION_STATUS.md).
      let agentTurn = "";
      events.addEventListener("message", (message) => {
        if (attempt !== attemptRef.current) return;
        const { type, delta } = JSON.parse(message.data) as { type?: string; delta?: string };
        if (speech) {
          // The model replies in text; the Indian voice speaks it.
          if (type === "response.output_text.delta" && delta) {
            speech.addText(delta);
            agentTurn += delta;
          } else if (type === "response.output_text.done") {
            speech.finish();
            if (callIdRef.current && agentTurn) void appendTranscriptSegment(supabase, callIdRef.current, "agent", agentTurn);
            agentTurn = "";
          } else if (type === "input_audio_buffer.speech_started") {
            speech.interrupt();
          }
          return;
        }
        if (type === "output_audio_buffer.started") {
          setIsSpeaking(true);
          setStatus("speaking");
        } else if (type === "output_audio_buffer.stopped" || type === "input_audio_buffer.speech_started") {
          setIsSpeaking(false);
          setStatus("listening");
        }
      });

      // The service closes the channel when it ends the session.
      events.addEventListener("close", () => {
        if (attempt === attemptRef.current) endCall();
      });

      connection.onconnectionstatechange = () => {
        if (attempt !== attemptRef.current) return;
        const state = connection.connectionState;
        if (state === "connected") {
          // Only once the provider session is genuinely established, not on
          // "connecting" — a false "active" would misreport a call that
          // never actually went through.
          reachedActiveRef.current = true;
          if (callIdRef.current) void advanceCallSession(supabase, callIdRef.current, "active");
          setStatus((current) => (current === "connecting" ? "connected" : current));
        } else if (state === "disconnected") {
          // Transient: ICE may recover to "connected" on its own, which the
          // branch above reports; if it does not, "failed" follows and ends
          // the call there.
          if (callIdRef.current) void advanceCallSession(supabase, callIdRef.current, "interrupted");
        } else if (state === "failed") {
          fail(new Error("The voice connection was lost. Please try again."));
        }
      };

      const offer = await connection.createOffer();
      await connection.setLocalDescription(offer);
      const answer = await fetch(data.callUrl, {
        method: "POST",
        body: offer.sdp,
        headers: { Authorization: `Bearer ${data.token}`, "Content-Type": "application/sdp" },
      });
      if (attempt !== attemptRef.current) return;
      if (!answer.ok) throw new Error(`The voice service refused the call (${answer.status}).`);
      const sdp = await answer.text();
      if (attempt !== attemptRef.current) return;
      await connection.setRemoteDescription({ type: "answer", sdp });
    } catch (cause: unknown) {
      fail(cause);
    }
  }, [teardown, endCall]);

  return { status, isSpeaking, error, startCall, endCall };
};
