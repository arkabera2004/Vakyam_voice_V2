import { describe, expect, it } from "vitest";
import { countFromContentRange, limitFromEnv, overLimit, parseTokenRequest } from "./limits";

describe("realtime-token limits", () => {
  it("treats only an explicit speechOnly:true as a speech-only request", () => {
    expect(parseTokenRequest('{"speechOnly":true}')).toEqual({ speechOnly: true });
    expect(parseTokenRequest('{"speechOnly":"yes"}')).toEqual({ speechOnly: false });
    expect(parseTokenRequest("")).toEqual({ speechOnly: false });
    expect(parseTokenRequest("not json")).toEqual({ speechOnly: false });
    expect(parseTokenRequest(null)).toEqual({ speechOnly: false });
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
