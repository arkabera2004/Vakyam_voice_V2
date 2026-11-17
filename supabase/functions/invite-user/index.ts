// invite-user: an organisation manager invites a colleague by email, or
// revokes a pending invitation. The invitation row is written under the
// caller's JWT (RLS and the role guard apply); only the Auth admin call that
// sends the email runs with the service role, and that key never leaves
// this function.

import { authenticate, restHeaders, type Caller } from "../_shared/auth.ts";
import { HttpError, corsHeaders, jsonResponse, readJson } from "../_shared/http.ts";
import { canAssignRole, canManage } from "../_shared/permissions.ts";
import { validateInviteRequest, type InviteRequest } from "./validate.ts";

const env = {
  supabaseUrl: Deno.env.get("SUPABASE_URL") ?? "",
  anonKey: Deno.env.get("SUPABASE_ANON_KEY") ?? "",
  serviceRoleKey: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  // Where the invite link lands. The app's /accept route finishes sign-up.
  appOrigin: Deno.env.get("APP_ORIGIN") ?? Deno.env.get("ALLOWED_ORIGIN") ?? "",
};
const cors = corsHeaders(Deno.env.get("ALLOWED_ORIGIN"));

type InvitationRow = {
  id: string;
  org_id: string;
  email: string;
  role: string;
  status: string;
  invited_user_id: string | null;
  expires_at: string;
  created_at: string;
};

const rest = (path: string, token: string, init: RequestInit & { prefer?: string } = {}) =>
  fetch(`${env.supabaseUrl}/rest/v1/${path}`, {
    ...init,
    headers: restHeaders(env, token, init.prefer ? { Prefer: init.prefer } : {}),
  });

const admin = (path: string, init: RequestInit = {}) =>
  fetch(`${env.supabaseUrl}/auth/v1/${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${env.serviceRoleKey}`, apikey: env.serviceRoleKey, "Content-Type": "application/json" },
  });

async function audit(caller: Caller, change: string) {
  const r = await rest("rpc/log_audit", caller.token, {
    method: "POST",
    body: JSON.stringify({ org: caller.orgId, change }),
  });
  if (!r.ok) console.error("log_audit failed:", r.status, await r.text());
}

async function invite(caller: Caller, request: Extract<InviteRequest, { action: "invite" }>) {
  if (!canAssignRole(caller.role, request.role)) {
    throw new HttpError(403, `Your role cannot grant the ${request.role} role`);
  }

  const inserted = await rest("invitations", caller.token, {
    method: "POST",
    prefer: "return=representation",
    body: JSON.stringify({ org_id: caller.orgId, email: request.email, role: request.role, invited_by: caller.userId }),
  });
  if (inserted.status === 409) throw new HttpError(409, "An invitation for this address is already pending");
  if (inserted.status === 403 || inserted.status === 401) throw new HttpError(403, "You are not allowed to invite members");
  if (!inserted.ok) throw new Error(`invitations insert failed (${inserted.status}): ${await inserted.text()}`);
  const [invitation] = (await inserted.json()) as InvitationRow[];

  const redirect = encodeURIComponent(`${env.appOrigin}/accept`);
  const sent = await admin(`invite?redirect_to=${redirect}`, {
    method: "POST",
    body: JSON.stringify({ email: request.email, data: { invitation_id: invitation.id, org_id: caller.orgId, role: request.role } }),
  });
  if (!sent.ok) {
    const detail = await sent.text();
    const alreadyRegistered = sent.status === 422 && /already/i.test(detail);
    const error = alreadyRegistered ? "already registered" : `auth invite failed (${sent.status})`;
    await rest(`invitations?id=eq.${invitation.id}`, caller.token, {
      method: "PATCH",
      body: JSON.stringify({ status: "failed", error }),
    });
    if (alreadyRegistered) throw new HttpError(409, "This address already has an account. Add the existing user to the organisation instead.");
    console.error("Auth invite error:", sent.status, detail);
    throw new Error(error);
  }
  const user = (await sent.json()) as { id?: string };
  if (user.id) {
    await rest(`invitations?id=eq.${invitation.id}`, caller.token, {
      method: "PATCH",
      body: JSON.stringify({ invited_user_id: user.id }),
    });
  }

  await audit(caller, `invitation.sent ${request.email} as ${request.role}`);
  return { ...invitation, invited_user_id: user.id ?? null };
}

async function revoke(caller: Caller, request: Extract<InviteRequest, { action: "revoke" }>) {
  const found = await rest(`invitations?id=eq.${request.invitationId}&select=*`, caller.token);
  if (!found.ok) throw new Error(`invitations read failed (${found.status})`);
  const [invitation] = (await found.json()) as InvitationRow[];
  if (!invitation) throw new HttpError(404, "Invitation not found");
  if (invitation.status !== "pending") throw new HttpError(409, `Invitation is already ${invitation.status}`);

  const updated = await rest(`invitations?id=eq.${invitation.id}&status=eq.pending`, caller.token, {
    method: "PATCH",
    prefer: "return=representation",
    body: JSON.stringify({ status: "revoked" }),
  });
  if (!updated.ok) throw new Error(`invitations update failed (${updated.status})`);
  const [revoked] = (await updated.json()) as InvitationRow[];
  if (!revoked) throw new HttpError(409, "Invitation was changed by someone else; reload and try again");

  // The invite created an unconfirmed Auth user; remove it so the link dies.
  if (invitation.invited_user_id) {
    const u = await admin(`admin/users/${invitation.invited_user_id}`);
    if (u.ok) {
      const user = (await u.json()) as { email_confirmed_at?: string | null };
      if (!user.email_confirmed_at) {
        const del = await admin(`admin/users/${invitation.invited_user_id}`, { method: "DELETE" });
        if (!del.ok) console.error("Could not delete invited user:", del.status, await del.text());
      }
    }
  }

  await audit(caller, `invitation.revoked ${invitation.email}`);
  return revoked;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405, cors);

  try {
    if (!env.supabaseUrl || !env.anonKey || !env.serviceRoleKey) throw new Error("Supabase environment is not configured");
    if (!env.appOrigin) throw new Error("APP_ORIGIN (or ALLOWED_ORIGIN) is not configured");

    const caller = await authenticate(req, env);
    if (!caller) return jsonResponse({ error: "Unauthorized" }, 401, cors);
    if (!caller.orgId || !canManage(caller.role)) return jsonResponse({ error: "Only organisation admins can manage invitations" }, 403, cors);

    const validation = validateInviteRequest(await readJson(req));
    if (!validation.ok) return jsonResponse({ error: validation.error }, 400, cors);

    const result = validation.request.action === "invite" ? await invite(caller, validation.request) : await revoke(caller, validation.request);
    return jsonResponse({ invitation: result }, validation.request.action === "invite" ? 201 : 200, cors);
  } catch (error: unknown) {
    if (error instanceof HttpError) return jsonResponse({ error: error.message }, error.status, cors);
    // Details stay in the function logs; the browser gets a generic message.
    console.error("Error in invite-user:", error instanceof Error ? error.message : error);
    return jsonResponse({ error: "The invitation could not be processed right now. Please try again later." }, 500, cors);
  }
});
