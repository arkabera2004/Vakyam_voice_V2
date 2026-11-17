// Server-side identity for Edge Functions: who is calling, and what role they
// hold in their organisation. The bearer value alone proves nothing (the
// publishable key is also sent as a bearer), so Supabase Auth is asked whether
// it is a live user session, and org_members is read under the caller's own
// JWT so RLS applies. No Deno globals: the function passes env and fetch in.

import { isRole, type Role } from "./permissions.ts";

export type Caller = {
  userId: string;
  email: string | null;
  /** Null when the user belongs to no organisation (or is disabled). */
  orgId: string | null;
  role: Role | null;
  /** The caller's own JWT, for REST calls that must run under RLS. */
  token: string;
};

export type AuthEnv = { supabaseUrl: string; anonKey: string };

export function bearerToken(req: Request): string | null {
  const header = req.headers.get("Authorization") ?? "";
  return header.startsWith("Bearer ") && header.length > 7 ? header.slice(7) : null;
}

/** Headers for a PostgREST call that runs as the caller, under RLS. */
export function restHeaders(env: AuthEnv, token: string, extra: Record<string, string> = {}): Record<string, string> {
  return { Authorization: `Bearer ${token}`, apikey: env.anonKey, "Content-Type": "application/json", ...extra };
}

/** Resolves the caller, or null when the request carries no live user session. */
export async function authenticate(req: Request, env: AuthEnv, fetchFn: typeof fetch = fetch): Promise<Caller | null> {
  const token = bearerToken(req);
  if (!token) return null;

  const userResponse = await fetchFn(`${env.supabaseUrl}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${token}`, apikey: env.anonKey },
  });
  if (!userResponse.ok) return null;
  const user = (await userResponse.json()) as { id?: string; email?: string | null };
  if (!user?.id) return null;

  const membershipResponse = await fetchFn(
    `${env.supabaseUrl}/rest/v1/org_members?select=org_id,role&user_id=eq.${user.id}&status=eq.active&limit=1`,
    { headers: restHeaders(env, token) },
  );
  if (!membershipResponse.ok) {
    throw new Error(`Could not read org_members (${membershipResponse.status})`);
  }
  const rows = (await membershipResponse.json()) as { org_id?: string; role?: unknown }[];
  const membership = rows[0];
  return {
    userId: user.id,
    email: user.email ?? null,
    orgId: membership?.org_id ?? null,
    role: isRole(membership?.role) ? membership.role : null,
    token,
  };
}
