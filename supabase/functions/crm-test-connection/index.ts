// crm-test-connection: an organisation manager tests a configured CRM
// integration on demand (the Tools screen's "Run connection tests"). No
// vendor has been selected yet, so only the 'mock' provider_key gets an
// honest success; every other provider_key gets a clear "not implemented"
// result rather than a fabricated health check. Writes the result back to
// crm_integrations under the caller's own JWT, so RLS (managers only) applies
// the same way a direct client write would.

import { authenticate, restHeaders } from "../_shared/auth.ts";
import { HttpError, corsHeaders, jsonResponse, readJson } from "../_shared/http.ts";
import { canManage } from "../_shared/permissions.ts";

const env = {
  supabaseUrl: Deno.env.get("SUPABASE_URL") ?? "",
  anonKey: Deno.env.get("SUPABASE_ANON_KEY") ?? "",
};
const cors = corsHeaders(Deno.env.get("ALLOWED_ORIGIN"));

type IntegrationRow = { id: string; org_id: string; provider_key: string };

/** The only provider actually implemented. Extend this when a real vendor is selected and built. */
const SUPPORTED_PROVIDERS = new Set(["mock"]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405, cors);

  try {
    if (!env.supabaseUrl || !env.anonKey) throw new Error("Supabase environment is not configured");

    const caller = await authenticate(req, env);
    if (!caller) return jsonResponse({ error: "Unauthorized" }, 401, cors);
    if (!caller.orgId || !canManage(caller.role)) return jsonResponse({ error: "Only organisation admins can test integrations" }, 403, cors);

    const body = (await readJson(req)) as { integrationId?: unknown };
    const integrationId = typeof body.integrationId === "string" ? body.integrationId : null;
    if (!integrationId) throw new HttpError(400, "integrationId is required");

    const lookup = await fetch(`${env.supabaseUrl}/rest/v1/crm_integrations?id=eq.${integrationId}&select=id,org_id,provider_key`, {
      headers: restHeaders(env, caller.token),
    });
    if (!lookup.ok) throw new Error(`Could not read the integration (${lookup.status})`);
    const [integration] = (await lookup.json()) as IntegrationRow[];
    if (!integration) throw new HttpError(404, "Integration not found");
    if (integration.org_id !== caller.orgId) throw new HttpError(403, "This integration does not belong to your organisation");

    const supported = SUPPORTED_PROVIDERS.has(integration.provider_key);
    const testedAt = new Date().toISOString();
    const result = supported
      ? { ok: true as const, error: null }
      : { ok: false as const, error: `No connector is implemented for provider "${integration.provider_key}" yet.` };

    const update = await fetch(`${env.supabaseUrl}/rest/v1/crm_integrations?id=eq.${integrationId}`, {
      method: "PATCH",
      headers: restHeaders(env, caller.token, { Prefer: "return=minimal" }),
      body: JSON.stringify({ last_test_at: testedAt, last_test_ok: result.ok, last_error: result.error, status: result.ok ? "enabled" : "error" }),
    });
    if (!update.ok) throw new Error(`Could not record the test result (${update.status})`);

    return jsonResponse({ ok: result.ok, error: result.error, testedAt }, 200, cors);
  } catch (error: unknown) {
    if (error instanceof HttpError) return jsonResponse({ error: error.message }, error.status, cors);
    console.error("Error in crm-test-connection:", error instanceof Error ? error.message : error);
    return jsonResponse({ error: "The connection test could not run right now." }, 500, cors);
  }
});
