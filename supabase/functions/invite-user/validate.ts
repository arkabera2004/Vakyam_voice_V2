// Request validation for invite-user. Pure, so vitest covers it.

import { isRole, type Role } from "../_shared/permissions.ts";

export type InviteRequest =
  | { action: "invite"; email: string; role: Role }
  | { action: "revoke"; invitationId: string };

export type Validation = { ok: true; request: InviteRequest } | { ok: false; error: string };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Lower-cases and trims; the pending-invitation uniqueness index also lower-cases. */
export function normaliseEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  return email.length <= 254 && EMAIL.test(email) ? email : null;
}

export function validateInviteRequest(body: unknown): Validation {
  const b = (body ?? {}) as Record<string, unknown>;
  const action = b.action ?? "invite";
  if (action === "invite") {
    const email = normaliseEmail(b.email);
    if (!email) return { ok: false, error: "A valid email address is required" };
    if (!isRole(b.role)) return { ok: false, error: "role must be one of super_admin, org_admin, supervisor, agent, qa_analyst" };
    return { ok: true, request: { action: "invite", email, role: b.role } };
  }
  if (action === "revoke") {
    const id = typeof b.invitationId === "string" ? b.invitationId : "";
    if (!UUID.test(id)) return { ok: false, error: "invitationId must be a UUID" };
    return { ok: true, request: { action: "revoke", invitationId: id } };
  }
  return { ok: false, error: "action must be invite or revoke" };
}
