// Retention eligibility. Pure; the scheduled job applies it and writes the
// deletion audit trail. Deletion is a no-op unless the policy enables it.

export type RetentionPolicy = { target: "recording" | "transcript"; retainDays: number; deletionEnabled: boolean };

export type RetentionItem = { id: string; createdAt: Date; status: string; legalHold?: boolean };

export type RetentionPlan = {
  mode: "dry-run" | "delete";
  cutoff: Date;
  eligible: string[];
  skipped: { id: string; reason: string }[];
};

export const DAY_MS = 24 * 60 * 60 * 1000;

export function cutoffFor(policy: RetentionPolicy, now = new Date()): Date {
  return new Date(now.getTime() - policy.retainDays * DAY_MS);
}

/** Items older than the cutoff that are not deleted, failed-pending, or on legal hold. */
export function planRetention(policy: RetentionPolicy, items: RetentionItem[], now = new Date()): RetentionPlan {
  const cutoff = cutoffFor(policy, now);
  const plan: RetentionPlan = { mode: policy.deletionEnabled ? "delete" : "dry-run", cutoff, eligible: [], skipped: [] };
  for (const it of items) {
    if (it.createdAt > cutoff) continue; // still inside retention, not reported
    if (it.status === "deleted") plan.skipped.push({ id: it.id, reason: "already deleted" });
    else if (it.legalHold) plan.skipped.push({ id: it.id, reason: "legal hold" });
    else if (it.status === "pending") plan.skipped.push({ id: it.id, reason: "upload never completed; needs review" });
    else plan.eligible.push(it.id);
  }
  return plan;
}
