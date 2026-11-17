// Role tiers for Edge Functions. Edge Functions cannot import from src/, so
// this mirrors src/domain/roles.ts; permissions.test.ts fails if they drift.

export const ROLES = ["super_admin", "org_admin", "supervisor", "agent", "qa_analyst"] as const;
export type Role = (typeof ROLES)[number];

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

/** Organisation settings, members, policies, connectors. Mirrors SQL can_manage_org(). */
export function canManage(role: Role | null | undefined): boolean {
  return role === "super_admin" || role === "org_admin";
}

/** Operational edits (agents, calls, knowledge). Mirrors SQL can_edit_org(). */
export function canEdit(role: Role | null | undefined): boolean {
  return canManage(role) || role === "supervisor";
}

/** Reviews, recordings, audit exports. Mirrors SQL can_review_org(). */
export function canReview(role: Role | null | undefined): boolean {
  return canEdit(role) || role === "qa_analyst";
}

/**
 * Who may grant which role. Managers grant any role below super_admin; only a
 * super_admin may create another super_admin. Prevents escalation by invite.
 */
export function canAssignRole(actor: Role | null | undefined, target: Role): boolean {
  if (!canManage(actor)) return false;
  if (target === "super_admin") return actor === "super_admin";
  return true;
}
