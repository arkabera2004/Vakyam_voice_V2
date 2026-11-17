// crm-sync-worker: processes queued crm_sync_jobs. Triggered by a scheduled
// job authenticated with the service role key, same pattern as
// retention-sweep and call-sweep. Only the 'mock' provider_key is actually
// implemented; any other job fails honestly with "not implemented" and
// backs off rather than pretending to reach a real vendor. One job failing
// does not stop the batch.

import { corsHeaders, jsonResponse } from "../_shared/http.ts";

const env = {
  supabaseUrl: Deno.env.get("SUPABASE_URL") ?? "",
  serviceRoleKey: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
};
const cors = corsHeaders(Deno.env.get("ALLOWED_ORIGIN"));
const adminHeaders = { Authorization: `Bearer ${env.serviceRoleKey}`, apikey: env.serviceRoleKey, "Content-Type": "application/json" };
const rest = (path: string, init: RequestInit = {}) => fetch(`${env.supabaseUrl}/rest/v1/${path}`, { ...init, headers: { ...adminHeaders, ...init.headers } });

/** The only provider actually implemented. Extend this when a real vendor is selected and built. */
const SUPPORTED_PROVIDERS = new Set(["mock"]);
const MAX_ATTEMPTS = 5;
const BACKOFF_MINUTES = (attempt: number) => Math.min(60, 2 ** attempt);

type JobRow = { id: string; integration_id: string; attempts: number };
type IntegrationRow = { id: string; provider_key: string };

async function processJob(job: JobRow, integrationsByid: Map<string, IntegrationRow>) {
  const integration = integrationsByid.get(job.integration_id);
  const attempts = job.attempts + 1;

  if (integration && SUPPORTED_PROVIDERS.has(integration.provider_key)) {
    const updated = await rest(`crm_sync_jobs?id=eq.${job.id}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "succeeded", attempts, last_error: null, updated_at: new Date().toISOString() }),
    });
    if (!updated.ok) console.error(`Could not mark job ${job.id} succeeded:`, updated.status, await updated.text());
    return { id: job.id, status: "succeeded" };
  }

  const reason = integration ? `No connector is implemented for provider "${integration.provider_key}" yet.` : "Integration no longer exists.";
  const dead = attempts >= MAX_ATTEMPTS;
  const updated = await rest(`crm_sync_jobs?id=eq.${job.id}`, {
    method: "PATCH",
    body: JSON.stringify({
      status: dead ? "dead" : "queued",
      attempts,
      last_error: reason,
      next_attempt_at: dead ? null : new Date(Date.now() + BACKOFF_MINUTES(attempts) * 60_000).toISOString(),
      updated_at: new Date().toISOString(),
    }),
  });
  if (!updated.ok) console.error(`Could not mark job ${job.id} failed:`, updated.status, await updated.text());
  return { id: job.id, status: dead ? "dead" : "failed", error: reason };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!env.serviceRoleKey || authHeader !== `Bearer ${env.serviceRoleKey}`) {
    return jsonResponse({ error: "Unauthorized" }, 401, cors);
  }
  if (!env.supabaseUrl) return jsonResponse({ error: "SUPABASE_URL is not configured" }, 500, cors);

  try {
    const due = await rest(`crm_sync_jobs?status=eq.queued&next_attempt_at=lte.${new Date().toISOString()}&select=id,integration_id,attempts&order=next_attempt_at.asc&limit=50`);
    if (!due.ok) throw new Error(`Could not read crm_sync_jobs (${due.status}): ${await due.text()}`);
    const jobs = (await due.json()) as JobRow[];
    if (jobs.length === 0) return jsonResponse({ ranAt: new Date().toISOString(), processed: 0, results: [] }, 200, cors);

    const integrationIds = [...new Set(jobs.map((j) => j.integration_id))].join(",");
    const integrationsResp = await rest(`crm_integrations?id=in.(${integrationIds})&select=id,provider_key`);
    if (!integrationsResp.ok) throw new Error(`Could not read crm_integrations (${integrationsResp.status})`);
    const integrationsByid = new Map((((await integrationsResp.json()) as IntegrationRow[])).map((i) => [i.id, i]));

    const results = await Promise.all(jobs.map((job) => processJob(job, integrationsByid)));
    return jsonResponse({ ranAt: new Date().toISOString(), processed: results.length, results }, 200, cors);
  } catch (error: unknown) {
    console.error("Error in crm-sync-worker:", error instanceof Error ? error.message : error);
    return jsonResponse({ error: "The CRM sync worker could not run." }, 500, cors);
  }
});
