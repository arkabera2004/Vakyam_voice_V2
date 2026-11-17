// Single source for the permission matrix. The SQL helpers can_manage_org,
// can_edit_org and can_review_org in the domain migration mirror these
// tiers; change both together.

export const ROLES = ["super_admin", "org_admin", "supervisor", "agent", "qa_analyst"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABEL: Record<Role, string> = {
  super_admin: "Super admin",
  org_admin: "Organisation admin",
  supervisor: "Supervisor",
  agent: "Agent",
  qa_analyst: "QA analyst",
};

export type Capability =
  | "org.read"
  | "org.manage" // settings, members, consent and retention policies, connectors
  | "agents.edit"
  | "calls.operate" // live controls, transfers, decisions
  | "evaluations.review"
  | "recordings.play"
  | "audit.export";

const MANAGE: Role[] = ["super_admin", "org_admin"];
const EDIT: Role[] = [...MANAGE, "supervisor"];
const REVIEW: Role[] = [...EDIT, "qa_analyst"];

const MATRIX: Record<Capability, readonly Role[]> = {
  "org.read": ROLES,
  "org.manage": MANAGE,
  "agents.edit": EDIT,
  "calls.operate": [...EDIT, "agent"],
  "evaluations.review": REVIEW,
  "recordings.play": REVIEW, // agents may play their own calls; see canPlayRecording
  "audit.export": [...MANAGE, "qa_analyst"],
};

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

export function can(role: Role | null | undefined, capability: Capability): boolean {
  return !!role && MATRIX[capability].includes(role);
}

/** Recording playback: reviewers for any call in the org, agents only for calls they started. */
export function canPlayRecording(role: Role | null | undefined, userId: string, callStartedBy: string | null): boolean {
  if (can(role, "recordings.play")) return true;
  return role === "agent" && !!callStartedBy && callStartedBy === userId;
}

/**
 * Who may grant which role. Managers grant any role below super_admin; only
 * a super_admin may create another super_admin. Mirrored in
 * supabase/functions/_shared/permissions.ts, which cannot import this file
 * across the Edge Function boundary; its test asserts the two agree.
 */
export function canAssignRole(actor: Role | null | undefined, target: Role): boolean {
  if (!can(actor, "org.manage")) return false;
  if (target === "super_admin") return actor === "super_admin";
  return true;
}
