import { describe, expect, it } from "vitest";
import { ROLES, can, canPlayRecording, isRole } from "./roles";

describe("roles", () => {
  it("knows exactly the five agreed roles", () => {
    expect(ROLES).toEqual(["super_admin", "org_admin", "supervisor", "agent", "qa_analyst"]);
    expect(isRole("admin")).toBe(false);
    expect(isRole("qa_analyst")).toBe(true);
  });

  it("tiers manage > edit > review > read", () => {
    expect(can("org_admin", "org.manage")).toBe(true);
    expect(can("supervisor", "org.manage")).toBe(false);
    expect(can("supervisor", "agents.edit")).toBe(true);
    expect(can("qa_analyst", "agents.edit")).toBe(false);
    expect(can("qa_analyst", "evaluations.review")).toBe(true);
    expect(can("agent", "evaluations.review")).toBe(false);
    expect(can("agent", "calls.operate")).toBe(true);
    expect(can("qa_analyst", "calls.operate")).toBe(false);
    expect(can("agent", "org.read")).toBe(true);
    expect(can(null, "org.read")).toBe(false);
    expect(can(undefined, "org.read")).toBe(false);
  });

  it("lets agents play only the recordings of calls they started", () => {
    expect(canPlayRecording("agent", "u1", "u1")).toBe(true);
    expect(canPlayRecording("agent", "u1", "u2")).toBe(false);
    expect(canPlayRecording("agent", "u1", null)).toBe(false);
    expect(canPlayRecording("qa_analyst", "u1", "u2")).toBe(true);
    expect(canPlayRecording(null, "u1", "u1")).toBe(false);
  });
});
