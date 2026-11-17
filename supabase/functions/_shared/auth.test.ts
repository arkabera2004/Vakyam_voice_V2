import { describe, expect, it } from "vitest";
import { authenticate, bearerToken } from "./auth";

const env = { supabaseUrl: "https://x.supabase.co", anonKey: "anon" };

type Route = (url: string, init?: RequestInit) => Response;
const fakeFetch = (routes: Record<string, Route>): typeof fetch =>
  (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    const key = Object.keys(routes).find((k) => url.startsWith(k));
    if (!key) return new Response("not found", { status: 404 });
    return routes[key](url, init);
  }) as typeof fetch;

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const withAuth = (token?: string) => new Request("https://f/x", { headers: token ? { Authorization: `Bearer ${token}` } : {} });

describe("bearerToken", () => {
  it("returns the token after 'Bearer ', else null", () => {
    expect(bearerToken(withAuth("abc"))).toBe("abc");
    expect(bearerToken(withAuth())).toBeNull();
    expect(bearerToken(new Request("https://f/x", { headers: { Authorization: "Bearer " } }))).toBeNull();
    expect(bearerToken(new Request("https://f/x", { headers: { Authorization: "Basic abc" } }))).toBeNull();
  });
});

describe("authenticate", () => {
  it("is null without a bearer or when Auth rejects the session", async () => {
    expect(await authenticate(withAuth(), env, fakeFetch({}))).toBeNull();
    const rejecting = fakeFetch({ "https://x.supabase.co/auth/v1/user": () => json({ msg: "bad" }, 401) });
    expect(await authenticate(withAuth("t"), env, rejecting)).toBeNull();
  });

  it("returns the user with their active membership, read under their own JWT", async () => {
    let membershipAuth = "";
    const f = fakeFetch({
      "https://x.supabase.co/auth/v1/user": () => json({ id: "u1", email: "a@b.test" }),
      "https://x.supabase.co/rest/v1/org_members": (_url, init) => {
        membershipAuth = (init?.headers as Record<string, string>).Authorization;
        return json([{ org_id: "o1", role: "org_admin" }]);
      },
    });
    expect(await authenticate(withAuth("t"), env, f)).toEqual({ userId: "u1", email: "a@b.test", orgId: "o1", role: "org_admin", token: "t" });
    expect(membershipAuth).toBe("Bearer t");
  });

  it("has no org and no role for a user without membership, and ignores unknown roles", async () => {
    const none = fakeFetch({
      "https://x.supabase.co/auth/v1/user": () => json({ id: "u1", email: null }),
      "https://x.supabase.co/rest/v1/org_members": () => json([]),
    });
    expect(await authenticate(withAuth("t"), env, none)).toMatchObject({ orgId: null, role: null });
    const legacy = fakeFetch({
      "https://x.supabase.co/auth/v1/user": () => json({ id: "u1" }),
      "https://x.supabase.co/rest/v1/org_members": () => json([{ org_id: "o1", role: "admin" }]),
    });
    expect(await authenticate(withAuth("t"), env, legacy)).toMatchObject({ orgId: "o1", role: null });
  });

  it("throws when the membership read fails, so the function answers 500 rather than treating the user as a stranger", async () => {
    const broken = fakeFetch({
      "https://x.supabase.co/auth/v1/user": () => json({ id: "u1" }),
      "https://x.supabase.co/rest/v1/org_members": () => json({ message: "relation does not exist" }, 404),
    });
    await expect(authenticate(withAuth("t"), env, broken)).rejects.toThrow("org_members (404)");
  });
});
