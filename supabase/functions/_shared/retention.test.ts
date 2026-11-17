import { describe, expect, it } from "vitest";
import * as domain from "../../../src/domain/retention";
import { DAY_MS, cutoffFor, planRetention, type RetentionPolicy } from "./retention";

const now = new Date("2026-11-17T00:00:00Z");
const policy: RetentionPolicy = { target: "recording", retainDays: 365, deletionEnabled: false };
const daysAgo = (d: number) => new Date(now.getTime() - d * DAY_MS);

describe("edge-function retention mirrors src/domain/retention.ts", () => {
  it("agrees on the cutoff and dry-run/delete mode", () => {
    expect(cutoffFor(policy, now).toISOString()).toBe(domain.cutoffFor(policy, now).toISOString());
    expect(planRetention(policy, [], now).mode).toBe("dry-run");
    expect(planRetention({ ...policy, deletionEnabled: true }, [], now).mode).toBe("delete");
  });

  it("selects the same eligible recordings and skip reasons as the domain module", () => {
    const items = [
      { id: "fresh", createdAt: daysAgo(10), status: "verified" },
      { id: "old", createdAt: daysAgo(400), status: "verified" },
      { id: "gone", createdAt: daysAgo(500), status: "deleted" },
      { id: "held", createdAt: daysAgo(500), status: "verified", legalHold: true },
      { id: "stuck", createdAt: daysAgo(500), status: "pending" },
    ];
    expect(planRetention(policy, items, now)).toEqual(
      domain.planRetention(policy, items as unknown as Parameters<typeof domain.planRetention>[1], now),
    );
  });

  it("treats a partial transcript as incomplete, not eligible", () => {
    const transcriptPolicy: RetentionPolicy = { target: "transcript", retainDays: 365, deletionEnabled: false };
    const plan = planRetention(transcriptPolicy, [{ id: "t1", createdAt: daysAgo(400), status: "partial" }], now);
    expect(plan.skipped).toEqual([{ id: "t1", reason: "upload or processing never completed; needs review" }]);
  });
});
