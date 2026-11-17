import { describe, expect, it } from "vitest";
import { DAY_MS, cutoffFor, planRetention, type RetentionPolicy } from "./retention";

const now = new Date("2026-11-17T00:00:00Z");
const policy: RetentionPolicy = { target: "recording", retainDays: 365, deletionEnabled: false };
const daysAgo = (d: number) => new Date(now.getTime() - d * DAY_MS);

describe("retention planning", () => {
  it("cuts off exactly retain_days ago", () => {
    expect(cutoffFor(policy, now).toISOString()).toBe("2025-11-17T00:00:00.000Z");
  });

  it("is a dry run unless deletion is enabled", () => {
    expect(planRetention(policy, [], now).mode).toBe("dry-run");
    expect(planRetention({ ...policy, deletionEnabled: true }, [], now).mode).toBe("delete");
  });

  it("selects only expired, verified items and explains every skip", () => {
    const plan = planRetention(
      policy,
      [
        { id: "fresh", createdAt: daysAgo(10), status: "verified" },
        { id: "old", createdAt: daysAgo(400), status: "verified" },
        { id: "boundary", createdAt: daysAgo(365), status: "verified" },
        { id: "gone", createdAt: daysAgo(500), status: "deleted" },
        { id: "held", createdAt: daysAgo(500), status: "verified", legalHold: true },
        { id: "stuck", createdAt: daysAgo(500), status: "pending" },
      ],
      now,
    );
    expect(plan.eligible).toEqual(["old", "boundary"]);
    expect(plan.skipped).toEqual([
      { id: "gone", reason: "already deleted" },
      { id: "held", reason: "legal hold" },
      { id: "stuck", reason: "upload never completed; needs review" },
    ]);
  });
});
