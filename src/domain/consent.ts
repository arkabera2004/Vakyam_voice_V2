// Recording consent gate. Client policy decides; the system never supplies
// wording. Without an approved policy a session does not record.

export type ConsentPolicy = {
  id: string;
  version: number;
  status: "draft" | "approved" | "retired";
  requiresExplicitConsent: boolean;
};

export type ConsentOutcome = "given" | "declined" | "not_asked" | "unknown";

export type RecordingDecision =
  | { record: true; policyId: string; outcome: "given" | "not_required" }
  | { record: false; reason: string; policyId: string | null };

/** Decides whether a session may record. Fails safe on any missing input. */
export function decideRecording(policy: ConsentPolicy | null | undefined, outcome: ConsentOutcome | null | undefined): RecordingDecision {
  if (!policy) return { record: false, reason: "no consent policy configured", policyId: null };
  if (policy.status !== "approved") return { record: false, reason: `consent policy v${policy.version} is ${policy.status}, not approved`, policyId: policy.id };
  if (!policy.requiresExplicitConsent) return { record: true, policyId: policy.id, outcome: "not_required" };
  if (outcome === "given") return { record: true, policyId: policy.id, outcome: "given" };
  return { record: false, reason: `explicit consent required, outcome was ${outcome ?? "unknown"}`, policyId: policy.id };
}
