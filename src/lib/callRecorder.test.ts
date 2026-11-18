import { describe, expect, it, vi } from "vitest";
import { extensionForMimeType, pickRecorderMimeType, recordingObjectPath, stopRecorder, type RecorderLike } from "./callRecorder";

describe("pickRecorderMimeType", () => {
  it("picks the first supported type from the preference list", () => {
    expect(pickRecorderMimeType((t) => t === "audio/webm")).toBe("audio/webm");
    expect(pickRecorderMimeType((t) => t === "audio/ogg")).toBe("audio/ogg");
  });

  it("prefers audio/webm;codecs=opus over plain audio/webm when both are supported", () => {
    expect(pickRecorderMimeType((t) => t === "audio/webm" || t === "audio/webm;codecs=opus")).toBe("audio/webm;codecs=opus");
  });

  it("returns undefined when nothing on the list is supported, so the browser's own default is used", () => {
    expect(pickRecorderMimeType(() => false)).toBeUndefined();
  });
});

describe("extensionForMimeType", () => {
  it("uses ogg only for an ogg mime type, webm for everything else including undefined", () => {
    expect(extensionForMimeType("audio/ogg;codecs=opus")).toBe("ogg");
    expect(extensionForMimeType("audio/webm;codecs=opus")).toBe("webm");
    expect(extensionForMimeType(undefined)).toBe("webm");
  });
});

describe("recordingObjectPath", () => {
  it("builds a path under the call's own organisation, matching the recordings table's path-in-org constraint", () => {
    expect(recordingObjectPath("org1", "call1", "audio/webm;codecs=opus")).toBe("org/org1/call/call1.webm");
    expect(recordingObjectPath("org1", "call1", "audio/ogg")).toBe("org/org1/call/call1.ogg");
  });
});

describe("stopRecorder", () => {
  const fakeRecorder = (state: string): { recorder: RecorderLike; stop: ReturnType<typeof vi.fn> } => {
    let stopListener: (() => void) | null = null;
    const stop = vi.fn(() => stopListener?.());
    return {
      stop,
      recorder: {
        state,
        mimeType: "audio/webm",
        stop,
        addEventListener: (_type, listener) => {
          stopListener = listener;
        },
      },
    };
  };

  it("calls stop() and resolves with a Blob built from the chunks once the stop event fires", async () => {
    const { recorder, stop } = fakeRecorder("recording");
    const chunks = [new Blob(["a"]), new Blob(["b"])];
    const blob = await stopRecorder(recorder, chunks);
    expect(stop).toHaveBeenCalledOnce();
    expect(blob.type).toBe("audio/webm");
    expect(blob.size).toBe(2);
  });

  it("resolves immediately without calling stop() again when the recorder is already inactive", async () => {
    const { recorder, stop } = fakeRecorder("inactive");
    const blob = await stopRecorder(recorder, [new Blob(["x"])]);
    expect(stop).not.toHaveBeenCalled();
    expect(blob.size).toBe(1);
  });
});
