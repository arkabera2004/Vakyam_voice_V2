import { describe, expect, it } from "vitest";
import { countFromContentRange, limitFromEnv, overLimit, parseTokenRequest } from "./limits";

describe("realtime-token limits", () => {
  it("treats only an explicit speechOnly:true as a speech-only request", () => {
    expect(parseTokenRequest('{"speechOnly":true}')).toEqual({ speechOnly: true, callId: null });
    expect(parseTokenRequest('{"speechOnly":"yes"}')).toEqual({ speechOnly: false, callId: null });
    expect(parseTokenRequest("")).toEqual({ speechOnly: false, callId: null });
    expect(parseTokenRequest("not json")).toEqual({ speechOnly: false, callId: null });
    expect(parseTokenRequest(null)).toEqual({ speechOnly: false, callId: null });
  });

  it("reads a string callId and rejects anything else", () => {
    expect(parseTokenRequest('{"callId":"c1"}').callId).toBe("c1");
    expect(parseTokenRequest('{"callId":""}').callId).toBeNull();
    expect(parseTokenRequest('{"callId":42}').callId).toBeNull();
    expect(parseTokenRequest('{"callId":null}').callId).toBeNull();
  });

  it("refuses the 11th session in an hour by default and honours a custom limit", () => {
    expect(overLimit(9)).toBe(false);
    expect(overLimit(10)).toBe(true);
    expect(overLimit(2, 3)).toBe(false);
    expect(overLimit(3, 3)).toBe(true);
  });

  it("reads the total from a PostgREST Content-Range header", () => {
    expect(countFromContentRange("0-9/23")).toBe(23);
    expect(countFromContentRange("*/0")).toBe(0);
    expect(countFromContentRange(null)).toBe(0);
    expect(countFromContentRange("garbage")).toBe(0);
  });

  it("falls back to the default limit on a missing or invalid env value", () => {
    expect(limitFromEnv("25")).toBe(25);
    expect(limitFromEnv(undefined)).toBe(10);
    expect(limitFromEnv("0")).toBe(10);
    expect(limitFromEnv("abc")).toBe(10);
  });
});
