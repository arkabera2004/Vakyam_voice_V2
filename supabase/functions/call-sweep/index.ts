// call-sweep: the server-side safety net for calls the browser never
// finalised (tab closed, network lost, process killed mid-call). Triggered
// by a scheduled job authenticated with the service role key, same pattern
// as retention-sweep. Thin on purpose: all the actual logic -- which calls
// qualify, the legality of the resulting transition, writing the audit
// trail -- already lives in public.abandon_stale_calls() and advance_call(),
// which this just invokes.

import { corsHeaders, jsonResponse } from "../_shared/http.ts";

const env = {
  supabaseUrl: Deno.env.get("SUPABASE_URL") ?? "",
  serviceRoleKey: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
};
const cors = corsHeaders(Deno.env.get("ALLOWED_ORIGIN"));

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!env.serviceRoleKey || authHeader !== `Bearer ${env.serviceRoleKey}`) {
    return jsonResponse({ error: "Unauthorized" }, 401, cors);
  }
  if (!env.supabaseUrl) return jsonResponse({ error: "SUPABASE_URL is not configured" }, 500, cors);

  try {
    const response = await fetch(`${env.supabaseUrl}/rest/v1/rpc/abandon_stale_calls`, {
      method: "POST",
      headers: { Authorization: `Bearer ${env.serviceRoleKey}`, apikey: env.serviceRoleKey, "Content-Type": "application/json" },
      body: "{}",
    });
    if (!response.ok) throw new Error(`abandon_stale_calls failed (${response.status}): ${await response.text()}`);
    const abandoned = (await response.json()) as number;
    return jsonResponse({ ranAt: new Date().toISOString(), abandoned }, 200, cors);
  } catch (error: unknown) {
    console.error("Error in call-sweep:", error instanceof Error ? error.message : error);
    return jsonResponse({ error: "The call sweep could not run." }, 500, cors);
  }
});
