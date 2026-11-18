import { describe, expect, it } from "vitest";
import { nextVersion } from "./agentVersion";

describe("nextVersion", () => {
  it("starts at v1 when no versions exist yet", () => {
    expect(nextVersion([])).toBe("v1");
  });

  it("increments past the highest existing version number", () => {
    expect(nextVersion(["v1"])).toBe("v2");
    expect(nextVersion(["v1", "v2", "v3"])).toBe("v4");
    expect(nextVersion(["v3", "v1", "v2"])).toBe("v4"); // order-independent
    expect(nextVersion(["v9"])).toBe("v10");
  });

  it("is case-insensitive on the v prefix", () => {
    expect(nextVersion(["V5"])).toBe("v6");
  });

  it("ignores non-numeric version strings rather than failing", () => {
    expect(nextVersion(["draft", "v2"])).toBe("v3");
    expect(nextVersion(["not-a-version"])).toBe("v1");
  });
});
