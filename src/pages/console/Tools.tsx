import { useCallback, useEffect, useState } from "react";
import { Btn, PageTitle, Panel, PanelHeader, Pill, Td, Th, type Tone } from "@/console/ui";
import { Modal, Field, inputClass, ModalActions } from "@/console/Modal";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/hooks/useOrg";
import { can } from "@/domain/roles";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type Integration = { id: string; name: string; providerKey: string; status: "disabled" | "enabled" | "error"; lastTestAt: string | null; lastTestOk: boolean | null; lastError: string | null };
type SyncJob = { id: string; integrationId: string; trigger: string; status: "queued" | "running" | "succeeded" | "failed" | "dead"; attempts: number; lastError: string | null; createdAt: string };

const STATUS_TONE: Record<Integration["status"], Tone> = { enabled: "green", disabled: "neutral", error: "red" };
const JOB_TONE: Record<SyncJob["status"], Tone> = { succeeded: "green", queued: "neutral", running: "blue", failed: "amber", dead: "red" };

/** Real crm_integrations/crm_sync_jobs, no demo vendor rows. Only 'mock' is an implemented provider; no vendor has been selected for real sync. Telephony is out of scope for this product phase and is not shown here. */
export default function Tools() {
  const me = useOrg();
  const canManage = can(me.role, "org.manage");

  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [jobs, setJobs] = useState<SyncJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ name: "", providerKey: "mock" });
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!me.orgId) {
      setIntegrations([]);
      setJobs([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(null);
    const [integResult, jobsResult] = await Promise.all([
      supabase.from("crm_integrations").select("id, name, provider_key, status, last_test_at, last_test_ok, last_error").eq("org_id", me.orgId).order("created_at"),
      supabase.from("crm_sync_jobs").select("id, integration_id, trigger, status, attempts, last_error, created_at").eq("org_id", me.orgId).order("created_at", { ascending: false }).limit(20),
    ]);
    if (integResult.error) {
      setLoadError(integResult.error.message);
      setLoading(false);
      return;
    }
    setIntegrations((integResult.data ?? []).map((r) => ({ id: r.id, name: r.name, providerKey: r.provider_key, status: r.status, lastTestAt: r.last_test_at, lastTestOk: r.last_test_ok, lastError: r.last_error })));
    setJobs((jobsResult.data ?? []).map((r) => ({ id: r.id, integrationId: r.integration_id, trigger: r.trigger, status: r.status, attempts: r.attempts, lastError: r.last_error, createdAt: r.created_at })));
    setLoading(false);
  }, [me.orgId]);

  useEffect(() => {
    if (!me.loading) void load();
  }, [me.loading, load]);

  const addIntegration = async () => {
    if (!me.orgId || !draft.name.trim()) return;
    const { error } = await supabase.from("crm_integrations").insert({ org_id: me.orgId, name: draft.name.trim(), provider_key: draft.providerKey });
    if (error) return toast({ variant: "destructive", title: "Could not add the integration", description: error.message });
    toast({ title: `${draft.name.trim()} added`, description: "Test the connection to bring it online." });
    setAdding(false);
    setDraft({ name: "", providerKey: "mock" });
    void load();
  };

  const testConnection = async (integration: Integration) => {
    setBusyId(integration.id);
    const { data, error } = await supabase.functions.invoke("crm-test-connection", { body: { integrationId: integration.id } });
    setBusyId(null);
    const message = (data as { error?: string } | null)?.error ?? (error ? error.message : null);
    if (message) return toast({ variant: "destructive", title: "Connection test failed", description: message });
    toast({ title: `${integration.name}: connection test passed` });
    void load();
  };

  const triggerSync = async (integration: Integration) => {
    setBusyId(integration.id);
    const { error } = await supabase.rpc("enqueue_crm_sync", { integ_id: integration.id, sync_trigger: "manual" });
    setBusyId(null);
    if (error) return toast({ variant: "destructive", title: "Could not queue a sync", description: error.message });
    toast({ title: "Sync queued", description: "The sync worker picks it up on its next run." });
    void load();
  };

  return (
    <>
      <PageTitle crumb="Build / Tools and integrations" title="CRM integrations" actions={canManage && <Btn variant="primary" onClick={() => setAdding(true)}>Add integration</Btn>} />

      {!me.orgId && !me.loading && <Panel className="p-4 text-sm text-zinc-600">You do not belong to an organisation yet.</Panel>}
      {loadError && <Panel className="p-4 text-sm text-red-600">Could not load integrations: {loadError}</Panel>}

      {me.orgId && (
        <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <Panel className="overflow-x-auto">
            <PanelHeader title="Integrations" hint="No CRM vendor has been selected. Only the mock provider is a real, working connector; anything else is honestly reported as not implemented." />
            {loading ? (
              <p className="px-4 py-8 text-sm text-zinc-500">Loading…</p>
            ) : integrations.length === 0 ? (
              <p className="px-4 py-8 text-sm text-zinc-500">No integrations yet. {canManage && "Add one to get started."}</p>
            ) : (
              <table className="w-full min-w-[640px]">
                <thead className="bg-zinc-50"><tr><Th>Name</Th><Th>Provider</Th><Th>Last test</Th><Th>Status</Th>{canManage && <Th className="text-right">Actions</Th>}</tr></thead>
                <tbody>
                  {integrations.map((i) => (
                    <tr key={i.id} className="border-t border-zinc-100">
                      <Td className="font-medium">{i.name}</Td>
                      <Td className="text-zinc-600">{i.providerKey}</Td>
                      <Td>
                        {i.lastTestAt ? (
                          <>
                            <p>{new Date(i.lastTestAt).toLocaleString()}</p>
                            {i.lastError && <p className="text-xs text-red-600">{i.lastError}</p>}
                          </>
                        ) : (
                          <p className="text-zinc-400">Never tested</p>
                        )}
                      </Td>
                      <Td><Pill tone={STATUS_TONE[i.status]}>{i.status}</Pill></Td>
                      {canManage && (
                        <Td className="text-right">
                          <span className="inline-flex gap-1">
                            <Btn size="sm" disabled={busyId === i.id} onClick={() => testConnection(i)}>Test</Btn>
                            <Btn size="sm" disabled={busyId === i.id || i.status !== "enabled"} onClick={() => triggerSync(i)}>Sync</Btn>
                          </span>
                        </Td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Panel>

          <Panel className="overflow-x-auto">
            <PanelHeader title="Recent sync jobs" hint="Last 20" />
            {jobs.length === 0 ? (
              <p className="px-4 py-8 text-sm text-zinc-500">No sync jobs yet.</p>
            ) : (
              <table className="w-full">
                <thead className="bg-zinc-50"><tr><Th>Trigger</Th><Th>Status</Th><Th className="text-right">Attempts</Th></tr></thead>
                <tbody>
                  {jobs.map((j) => (
                    <tr key={j.id} className="border-t border-zinc-100">
                      <Td className={cn(j.lastError && "text-red-600")} title={j.lastError ?? undefined}>{j.trigger}</Td>
                      <Td><Pill tone={JOB_TONE[j.status]}>{j.status}</Pill></Td>
                      <Td className="text-right text-zinc-500">{j.attempts}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Panel>
        </div>
      )}

      {adding && (
        <Modal title="Add a CRM integration" hint="Only the mock provider is a real connector today. A real vendor is a future decision." onClose={() => setAdding(false)} footer={<ModalActions onCancel={() => setAdding(false)} onOk={addIntegration} okLabel="Add" okDisabled={!draft.name.trim()} />}>
          <Field label="Name"><input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className={inputClass} placeholder="Mock CRM" /></Field>
          <Field label="Provider">
            <select value={draft.providerKey} onChange={(e) => setDraft({ ...draft, providerKey: e.target.value })} className={inputClass}>
              <option value="mock">mock (the only implemented connector)</option>
            </select>
          </Field>
        </Modal>
      )}
    </>
  );
}
