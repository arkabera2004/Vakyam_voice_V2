// Pure helpers for browser call recording. The actual MediaRecorder/Web
// Audio orchestration lives in useVoiceAgent.ts and needs a live browser;
// everything here is plain logic, testable without one.

const PREFERRED_MIME_TYPES = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/ogg"];

/** The first supported recording mime type, or undefined to let the browser pick its own default. */
export function pickRecorderMimeType(isSupported: (mimeType: string) => boolean): string | undefined {
  return PREFERRED_MIME_TYPES.find((mimeType) => isSupported(mimeType));
}

/** File extension matching a recorder mime type, for the storage object path. */
export function extensionForMimeType(mimeType: string | undefined): string {
  return mimeType?.includes("ogg") ? "ogg" : "webm";
}

/** A storage object path for a call's recording, scoped under its own organisation per the recordings table's own path-in-org constraint. */
export function recordingObjectPath(orgId: string, callId: string, mimeType: string | undefined): string {
  return `org/${orgId}/call/${callId}.${extensionForMimeType(mimeType)}`;
}

/** The minimal shape stopRecorder needs; the real MediaRecorder satisfies it structurally. */
export type RecorderLike = {
  state: string;
  mimeType: string;
  stop: () => void;
  addEventListener: (type: "stop", listener: () => void, options?: { once?: boolean }) => void;
};

/** Resolves with the final Blob once the recorder has flushed all of its data, whether it was already stopped or not. */
export function stopRecorder(recorder: RecorderLike, chunks: Blob[]): Promise<Blob> {
  return new Promise((resolve) => {
    if (recorder.state === "inactive") {
      resolve(new Blob(chunks, { type: recorder.mimeType }));
      return;
    }
    recorder.addEventListener("stop", () => resolve(new Blob(chunks, { type: recorder.mimeType })), { once: true });
    recorder.stop();
  });
}
