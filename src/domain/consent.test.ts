import { describe, expect, it } from "vitest";
import { decideRecording, type ConsentPolicy } from "./consent";

const approved: ConsentPolicy = { id: "p1", version: 3, status: "approved", requiresExplicitConsent: true };

describe("recording consent gate", () => {
  it("never records without an approved policy", () => {
    expect(decideRecording(null, "given")).toEqual({ record: false, reason: "no consent policy configured", policyId: null });
    expect(decideRecording({ ...approved, status: "draft" }, "given")).toMatchObject({ record: false, policyId: "p1" });
    expect(decideRecording({ ...approved, status: "retired" }, "given").record).toBe(false);
  });

  it("records only on explicit consent when the policy requires it", () => {
    expect(decideRecording(approved, "given")).toEqual({ record: true, policyId: "p1", outcome: "given" });
    for (const o of ["declined", "not_asked", "unknown", null, undefined] as const) {
      expect(decideRecording(approved, o).record).toBe(false);
    }
  });

  it("records without asking when the approved policy does not require explicit consent", () => {
    const disclosureOnly = { ...approved, requiresExplicitConsent: false };
    expect(decideRecording(disclosureOnly, "not_asked")).toEqual({ record: true, policyId: "p1", outcome: "not_required" });
  });
});
