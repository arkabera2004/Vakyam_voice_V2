import { useCallback, useEffect, useState } from "react";
import { Btn, KV, PageTitle, Panel, PanelHeader, Pill, Td, Th, Toggle } from "@/console/ui";
import { Modal, Field, inputClass, ModalActions } from "@/console/Modal";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/hooks/useOrg";
import { can } from "@/domain/roles";
import { downloadCsv } from "@/console/export";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type ConsentPolicy = { id: string; version: number; disclosureText: string; requiresExplicitConsent: boolean; status: "draft" | "approved" | "retired" };
type RetentionPolicy = { target: "recording" | "transcript"; retainDays: number; deletionEnabled: boolean };
type AuditRow = { id: number; actorName: string; change: string; version: string; createdAt: string };

const PII_FIELDS = ["Phone number", "Card number", "Aadhaar", "Email address"];
const REQUIRED = [/meera|agent|assistant/i, /ai|artificial/i, /record/i];
const TARGET_LABEL: Record<RetentionPolicy["target"], string> = { recording: "Call audio", transcript: "Transcripts" };

/** Real consent_policies/retention_policies/pii_settings/deletion_requests/audit_log, no demo numbers. No consent rate or DLT chart is shown here: nothing in the schema backs those metrics honestly today. */
export default function Compliance() {
  const me = useOrg();
  const canManage = can(me.role, "org.manage");
  const canEdit = can(me.role, "agents.edit"); // the general editors tier (managers + supervisor), same as pii_settings/deletion_requests RLS

  const [policies, setPolicies] = useState<ConsentPolicy[]>([]);
  const [retention, setRetention] = useState<RetentionPolicy[]>([]);
  const [pii, setPii] = useState<Record<string, boolean>>({});
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [modal, setModal] = useState<null | "propose" | "delete" | "audit">(null);
  const [draftText, setDraftText] = useState("");
  const [del, setDel] = useState({ member: "", id: "", reason: "Member asked under DPDP" });

  const approved = policies.find((p) => p.status === "approved") ?? null;
  const drafts = policies.filter((p) => p.status === "draft");

  const load = useCallback(async () => {
    if (!me.orgId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(null);
    const [policyResult, retentionResult, piiResult, auditResult] = await Promise.all([
      supabase.from("consent_policies").select("id, version, disclosure_text, requires_explicit_consent, status").eq("org_id", me.orgId).order("version", { ascending: false }),
      supabase.from("retention_policies").select("target, retain_days, deletion_enabled").eq("org_id", me.orgId),
      supabase.from("pii_settings").select("field, redact").eq("org_id", me.orgId),
      supabase.from("audit_log").select("id, actor_name, change, version, created_at").eq("org_id", me.orgId).order("created_at", { ascending: false }).limit(50),
    ]);
    if (policyResult.error) {
      setLoadError(policyResult.error.message);
      setLoading(false);
      return;
    }
    setPolicies((policyResult.data ?? []).map((p) => ({ id: p.id, version: p.version, disclosureText: p.disclosure_text, requiresExplicitConsent: p.requires_explicit_consent, status: p.status })));
    setRetention((retentionResult.data ?? []).map((r) => ({ target: r.target, retainDays: r.retain_days, deletionEnabled: r.deletion_enabled })));
    setPii(Object.fromEntries((piiResult.data ?? []).map((r) => [r.field, r.redact])));
    setAudit((auditResult.data ?? []).map((a) => ({ id: a.id, actorName: a.actor_name, change: a.change, version: a.version, createdAt: a.created_at })));
    setLoading(false);
  }, [me.orgId]);

  useEffect(() => {
    if (!me.loading) void load();
  }, [me.loading, load]);

  const missing = REQUIRED.filter((r) => !r.test(draftText));

  const proposeDraft = async () => {
    if (!me.orgId || !draftText.trim()) return;
    const nextVersion = (Math.max(0, ...policies.map((p) => p.version)) || 0) + 1;
    const { error } = await supabase.from("consent_policies").insert({ org_id: me.orgId, version: nextVersion, disclosure_text: draftText.trim() });
    if (error) return toast({ variant: "destructive", title: "Could not save the draft", description: error.message });
    toast({ title: `Draft v${nextVersion} saved`, description: "Approve it to make it live." });
    setModal(null);
    setDraftText("");
    void load();
  };

  const approvePolicy = async (policy: ConsentPolicy) => {
    const { error } = await supabase.rpc("approve_consent_policy", { target_policy_id: policy.id });
    if (error) return toast({ variant: "destructive", title: "Could not approve", description: error.message });
    toast({ title: `v${policy.version} is now the approved policy`, description: "New calls record only once this wording is actually delivered, per the configured consent rule." });
    void load();
  };

  const saveRetention = async (target: RetentionPolicy["target"], patch: Partial<Pick<RetentionPolicy, "retainDays" | "deletionEnabled">>) => {
    if (!me.orgId) return;
    const body: Record<string, unknown> = {};
    if (patch.retainDays != null) body.retain_days = patch.retainDays;
    if (patch.deletionEnabled != null) body.deletion_enabled = patch.deletionEnabled;
    const { error } = await supabase.from("retention_policies").update(body).eq("org_id", me.orgId).eq("target", target);
    if (error) return toast({ variant: "destructive", title: "Could not save retention settings", description: error.message });
    void load();
  };

  const togglePii = async (field: string) => {
    if (!me.orgId) return;
    const next = !(pii[field] ?? true);
    const { error } = await supabase.from("pii_settings").upsert({ org_id: me.orgId, field, redact: next });
    if (error) return toast({ variant: "destructive", title: "Could not save", description: error.message });
    setPii((p) => ({ ...p, [field]: next }));
    if (!next) toast({ variant: "destructive", title: `${field} now kept in transcripts`, description: "This widens what reviewers can see." });
  };

  const requestDeletion = async () => {
    if (!me.orgId || !del.member.trim()) return;
    const ref = `DR-${Date.now().toString(36).toUpperCase()}`;
    const { data: userResult } = await supabase.auth.getUser();
    const { error } = await supabase.from("deletion_requests").insert({ org_id: me.orgId, ref, member_name: del.member.trim(), member_id: del.id.trim() || null, reason: del.reason, requested_by: userResult.user?.id });
    if (error) return toast({ variant: "destructive", title: "Could not open the request", description: error.message });
    await supabase.rpc("log_audit", { org: me.orgId, change: `Deletion request opened for ${del.member.trim()}: ${del.reason}`, version: ref });
    setModal(null);
    setDel({ member: "", id: "", reason: "Member asked under DPDP" });
    toast({ title: `${ref} opened`, description: `Logged for ${del.member.trim()}. Nothing is purged automatically; the request must be actioned by hand.` });
  };

  const exportAudit = () => {
    downloadCsv("audit-log.csv", [["When", "Who", "Change", "Version"], ...audit.map((a) => [a.createdAt, a.actorName, a.change, a.version])]);
    toast({ title: "Audit log exported", description: `${audit.length} entries, newest first.` });
  };

  if (!me.orgId && !me.loading) return <Panel className="p-4 text-sm text-zinc-600">You do not belong to an organisation yet.</Panel>;
  if (loadError) return <Panel className="p-4 text-sm text-red-600">Could not load compliance data: {loadError}</Panel>;

  return (
    <>
      <PageTitle crumb="Govern" title="Compliance and consent" actions={<><Btn onClick={exportAudit} disabled={loading}>Export audit log</Btn>{canEdit && <Btn variant="dark" onClick={() => setModal("delete")}>Request deletion</Btn>}</>} />

      <Panel className="flex flex-wrap items-center gap-4 p-4">
        <div className="min-w-[280px] flex-1">
          {approved ? (
            <>
              <p className="flex items-center gap-2 text-sm font-semibold">Opening disclosure <Pill tone="green">Approved, v{approved.version}</Pill></p>
              <p className="mt-1 text-base">{approved.disclosureText}</p>
              <p className="mt-1.5 text-xs text-zinc-500">{approved.requiresExplicitConsent ? "Requires the member's explicit consent before recording." : "Disclosure only; recording is allowed once this is delivered."}</p>
            </>
          ) : (
            <p className="text-sm text-amber-700">No approved consent policy yet. Recording fails safe (disabled) until one is approved.</p>
          )}
        </div>
        {canManage && <Btn size="sm" onClick={() => { setDraftText(approved?.disclosureText ?? ""); setModal("propose"); }}>Propose new wording</Btn>}
      </Panel>

      {canManage && drafts.length > 0 && (
        <Panel className="mt-4 p-4">
          <p className="text-sm font-semibold">Draft policies awaiting approval</p>
          <ul className="mt-2 space-y-2">
            {drafts.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-3 rounded-lg bg-zinc-50 p-3">
                <div><p className="text-sm">{d.disclosureText}</p><p className="text-xs text-zinc-500">v{d.version}</p></div>
                <Btn size="sm" variant="primary" onClick={() => approvePolicy(d)}>Approve</Btn>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel className="p-4">
          <div className="flex items-center justify-between"><p className="text-sm font-semibold">Retention policy</p><Pill tone="amber">365-day default</Pill></div>
          <div className="mt-1">
            {retention.map((r) => (
              <KV
                key={r.target}
                k={TARGET_LABEL[r.target]}
                v={
                  canManage ? (
                    <span className="flex items-center gap-2">
                      <input type="number" min={1} max={3650} defaultValue={r.retainDays} onBlur={(e) => saveRetention(r.target, { retainDays: Number(e.target.value) })} className="h-7 w-20 rounded border border-zinc-200 px-1.5 text-right text-sm" /> days
                      <button onClick={() => saveRetention(r.target, { deletionEnabled: !r.deletionEnabled })}><Toggle on={r.deletionEnabled} label={`Deletion ${r.deletionEnabled ? "enabled" : "disabled"} for ${r.target}`} /></button>
                    </span>
                  ) : (
                    <span>{r.retainDays} days{r.deletionEnabled ? "" : ", deletion disabled"}</span>
                  )
                }
              />
            ))}
            {retention.length === 0 && <p className="py-3 text-sm text-zinc-500">No retention policy configured.</p>}
          </div>
        </Panel>

        <Panel className="p-4">
          <div className="flex items-center justify-between"><p className="text-sm font-semibold">PII redaction in transcripts</p><span className="text-xs text-zinc-500">{Object.values(pii).filter((v) => v !== false).length} of {PII_FIELDS.length} on</span></div>
          <p className="mt-1 text-[11px] text-amber-700">Policy only; applies once transcripts with this content are stored.</p>
          <ul className="mt-2">
            {PII_FIELDS.map((field) => {
              const on = pii[field] ?? true;
              return (
                <li key={field} className="flex items-center gap-3 py-2.5">
                  <button onClick={() => canEdit && togglePii(field)} disabled={!canEdit} aria-label={`Toggle ${field} redaction`}><Toggle on={on} label={field} /></button>
                  <p className="text-sm font-medium">{field}</p>
                </li>
              );
            })}
          </ul>
        </Panel>
      </div>

      <Panel className="mt-4">
        <PanelHeader title="Audit log" hint={`${audit.length} entries`} right={<button onClick={() => setModal("audit")} className="text-xs font-medium text-[#E2703A]">See all entries</button>} />
        {loading ? <p className="px-4 py-6 text-sm text-zinc-500">Loading…</p> : <AuditTable rows={audit.slice(0, 5)} />}
      </Panel>

      {modal === "propose" && (
        <Modal title="Propose new disclosure wording" hint="Write the client-approved wording exactly. It must name the agent, say it is AI, and mention recording. Saving creates a draft; approve it separately to make it live." onClose={() => setModal(null)} footer={<ModalActions onCancel={() => setModal(null)} onOk={proposeDraft} okLabel="Save as draft" okDisabled={missing.length > 0 || !draftText.trim()} />}>
          <Field label="Disclosure line"><textarea value={draftText} onChange={(e) => setDraftText(e.target.value)} rows={4} className={inputClass + " h-auto py-2"} /></Field>
          <p className={cn("text-xs", missing.length ? "text-red-600" : "text-emerald-600")}>
            {missing.length ? "Missing required wording: name, AI disclosure, or recording mention." : "All required wording present."}
          </p>
        </Modal>
      )}
      {modal === "delete" && (
        <Modal title="Request deletion" hint="Records the request. Automatic purging of audio, transcripts and CRM notes is not built yet; this must be actioned by hand." onClose={() => setModal(null)} footer={<ModalActions onCancel={() => setModal(null)} onOk={requestDeletion} okLabel="Open request" okDisabled={!del.member.trim()} danger />}>
          <Field label="Member name"><input value={del.member} onChange={(e) => setDel({ ...del, member: e.target.value })} className={inputClass} /></Field>
          <Field label="Member ID (optional)"><input value={del.id} onChange={(e) => setDel({ ...del, id: e.target.value })} className={inputClass} /></Field>
          <Field label="Reason"><select value={del.reason} onChange={(e) => setDel({ ...del, reason: e.target.value })} className={inputClass}><option>Member asked under DPDP</option><option>Consent withdrawn mid call</option><option>Legal hold lifted</option></select></Field>
        </Modal>
      )}
      {modal === "audit" && (
        <Modal title="Audit log" hint="Every governed change in this organisation, newest first." onClose={() => setModal(null)} footer={<><Btn size="sm" onClick={exportAudit}>Export CSV</Btn><Btn size="sm" variant="dark" onClick={() => setModal(null)}>Close</Btn></>}>
          <div className="-mx-5 max-h-[60vh] overflow-y-auto"><AuditTable rows={audit} /></div>
        </Modal>
      )}
    </>
  );
}

function AuditTable({ rows }: { rows: AuditRow[] }) {
  return (
    <table className="w-full">
      <thead className="bg-zinc-50"><tr><Th>When</Th><Th>Who</Th><Th>Change</Th><Th className="text-right">Version</Th></tr></thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.id} className="border-t border-zinc-100">
            <Td className="whitespace-nowrap text-zinc-500">{new Date(r.createdAt).toLocaleString()}</Td><Td className="font-medium">{r.actorName}</Td><Td>{r.change}</Td><Td className="whitespace-nowrap text-right text-zinc-500">{r.version}</Td>
          </tr>
        ))}
        {rows.length === 0 && <tr><Td colSpan={4} className="py-8 text-center text-zinc-500">No audit entries yet.</Td></tr>}
      </tbody>
    </table>
  );
}
