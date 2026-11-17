// retention-sweep: applies each organisation's recording and transcript
// retention policy. Triggered by a scheduled job (pg_cron / Supabase
// Scheduled Functions) authenticated with the service role key, never by an
// end user — retention decisions are not something any single member should
// be able to invoke on demand. Deletion only happens when a policy's
// deletion_enabled is true; otherwise this is a dry run that only writes a
// retention_runs report. One org/target failing does not stop the others.

import { corsHeaders, jsonResponse } from "../_shared/http.ts";
import { planRetention, type RetentionItem, type RetentionPolicy } from "../_shared/retention.ts";

const env = {
  supabaseUrl: Deno.env.get("SUPABASE_URL") ?? "",
  serviceRoleKey: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
};
const cors = corsHeaders(Deno.env.get("ALLOWED_ORIGIN"));

const adminHeaders = { Authorization: `Bearer ${env.serviceRoleKey}`, apikey: env.serviceRoleKey, "Content-Type": "application/json" };
const rest = (path: string, init: RequestInit = {}) => fetch(`${env.supabaseUrl}/rest/v1/${path}`, { ...init, headers: { ...adminHeaders, ...init.headers } });

type PolicyRow = { org_id: string; target: "recording" | "transcript"; retain_days: number; deletion_enabled: boolean };
type RecordingRow = { id: string; created_at: string; status: string; legal_hold: boolean; bucket: string; object_path: string };
type TranscriptRow = { id: string; created_at: string; status: string; legal_hold: boolean; deleted_at: string | null };

async function readAll<T>(path: string): Promise<T[]> {
  const response = await rest(path);
  if (!response.ok) throw new Error(`${path} failed (${response.status}): ${await response.text()}`);
  return (await response.json()) as T[];
}

async function recordRun(policy: PolicyRow, plan: { mode: string; cutoff: Date; eligible: string[]; skipped: { id: string; reason: string }[] }, deletedCount: number, error?: string) {
  await rest("retention_runs", {
    method: "POST",
    body: JSON.stringify({
      org_id: policy.org_id,
      target: policy.target,
      mode: plan.mode,
      cutoff: plan.cutoff.toISOString(),
      eligible_count: plan.eligible.length,
      deleted_count: deletedCount,
      skipped: plan.skipped,
      error: error ?? null,
    }),
  });
}

async function deleteRecordings(policy: PolicyRow, ids: string[], rows: RecordingRow[]): Promise<number> {
  const byId = new Map(rows.map((r) => [r.id, r]));
  let deleted = 0;
  for (const id of ids) {
    const row = byId.get(id);
    if (!row) continue;
    const storageDelete = await fetch(`${env.supabaseUrl}/storage/v1/object/${row.bucket}/${row.object_path}`, {
      method: "DELETE",
      headers: adminHeaders,
    });
    if (!storageDelete.ok && storageDelete.status !== 404) {
      console.error(`Could not delete storage object for recording ${id}:`, storageDelete.status, await storageDelete.text());
      continue; // leave the row alone; it will be retried on the next sweep
    }
    const reason = `retention policy: older than ${policy.retain_days} days`;
    const updated = await rest(`recordings?id=eq.${id}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "deleted", deleted_at: new Date().toISOString(), deletion_reason: reason }),
    });
    if (updated.ok) deleted += 1;
    else console.error(`Could not mark recording ${id} deleted:`, updated.status, await updated.text());
  }
  return deleted;
}

async function deleteTranscripts(policy: PolicyRow, ids: string[]): Promise<number> {
  let deleted = 0;
  for (const id of ids) {
    // The row stays, with a deletion marker, as the audit trail; the content
    // (which may hold PII) is removed from its segments.
    const segments = await rest(`transcript_segments?transcript_id=eq.${id}`, { method: "DELETE" });
    if (!segments.ok) {
      console.error(`Could not delete segments for transcript ${id}:`, segments.status, await segments.text());
      continue;
    }
    const reason = `retention policy: older than ${policy.retain_days} days`;
    const updated = await rest(`transcripts?id=eq.${id}`, {
      method: "PATCH",
      body: JSON.stringify({ deleted_at: new Date().toISOString(), deletion_reason: reason }),
    });
    if (updated.ok) deleted += 1;
    else console.error(`Could not mark transcript ${id} deleted:`, updated.status, await updated.text());
  }
  return deleted;
}

async function sweepOne(policy: PolicyRow) {
  const retentionPolicy: RetentionPolicy = { target: policy.target, retainDays: policy.retain_days, deletionEnabled: policy.deletion_enabled };
  try {
    let items: RetentionItem[];
    let recordingRows: RecordingRow[] = [];
    if (policy.target === "recording") {
      recordingRows = await readAll<RecordingRow>(`recordings?org_id=eq.${policy.org_id}&select=id,created_at,status,legal_hold,bucket,object_path`);
      items = recordingRows.map((r) => ({ id: r.id, createdAt: new Date(r.created_at), status: r.status, legalHold: r.legal_hold }));
    } else {
      const rows = await readAll<TranscriptRow>(`transcripts?org_id=eq.${policy.org_id}&select=id,created_at,status,legal_hold,deleted_at`);
      items = rows.map((t) => ({ id: t.id, createdAt: new Date(t.created_at), status: t.deleted_at ? "deleted" : t.status, legalHold: t.legal_hold }));
    }

    const plan = planRetention(retentionPolicy, items);
    const deletedCount = plan.mode === "delete"
      ? policy.target === "recording"
        ? await deleteRecordings(policy, plan.eligible, recordingRows)
        : await deleteTranscripts(policy, plan.eligible)
      : 0;
    await recordRun(policy, plan, deletedCount);
    return { org_id: policy.org_id, target: policy.target, mode: plan.mode, eligible: plan.eligible.length, deleted: deletedCount };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Retention sweep failed for org ${policy.org_id} / ${policy.target}:`, message);
    await recordRun(policy, { mode: policy.deletion_enabled ? "delete" : "dry-run", cutoff: new Date(), eligible: [], skipped: [] }, 0, message).catch(() => {});
    return { org_id: policy.org_id, target: policy.target, error: message };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!env.serviceRoleKey || authHeader !== `Bearer ${env.serviceRoleKey}`) {
    return jsonResponse({ error: "Unauthorized" }, 401, cors);
  }
  if (!env.supabaseUrl) return jsonResponse({ error: "SUPABASE_URL is not configured" }, 500, cors);

  try {
    const policies = await readAll<PolicyRow>("retention_policies?select=org_id,target,retain_days,deletion_enabled");
    const results = await Promise.all(policies.map(sweepOne));
    return jsonResponse({ ranAt: new Date().toISOString(), orgsCovered: new Set(policies.map((p) => p.org_id)).size, results }, 200, cors);
  } catch (error: unknown) {
    console.error("Error in retention-sweep:", error instanceof Error ? error.message : error);
    return jsonResponse({ error: "The retention sweep could not run." }, 500, cors);
  }
});
