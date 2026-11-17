import { describe, expect, it } from "vitest";
import { isUuid } from "./http";

describe("isUuid", () => {
  it("accepts a well-formed UUID in either case", () => {
    expect(isUuid("6f1c2a4e-9b3d-4c5e-8f7a-1b2c3d4e5f60")).toBe(true);
    expect(isUuid("6F1C2A4E-9B3D-4C5E-8F7A-1B2C3D4E5F60")).toBe(true);
  });

  it("rejects anything that is not a plain UUID, including PostgREST filter syntax", () => {
    expect(isUuid("")).toBe(false);
    expect(isUuid(null)).toBe(false);
    expect(isUuid(undefined)).toBe(false);
    expect(isUuid(42)).toBe(false);
    expect(isUuid("not-a-uuid")).toBe(false);
    expect(isUuid("6f1c2a4e-9b3d-4c5e-8f7a-1b2c3d4e5f6")).toBe(false); // one char short
    // a value designed to inject extra PostgREST query-string filters
    expect(isUuid("x,or=(status.eq.completed)")).toBe(false);
    expect(isUuid("6f1c2a4e-9b3d-4c5e-8f7a-1b2c3d4e5f60&limit=1000")).toBe(false);
  });
});
