import { useCallback, useEffect, useState } from "react";
import { Btn, IconTile, PageTitle, Panel, PanelHeader, Pill, Td, Th, Toggle } from "@/console/ui";
import { canEdit, useOrg } from "@/hooks/useOrg";
import { supabase } from "@/integrations/supabase/client";
import { Modal, Field, inputClass, ModalActions } from "@/console/Modal";
import { answerPolicy, type PolicyAnswer } from "@/console/data/policy";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type Source = { id: string; name: string; sub: string; emoji: string; live: boolean };
type Gate = { id: string; name: string; sub: string; approver: string | null; sla: string | null; enabled: boolean; triggered7d: number };
type Version = { id: string; label: string; createdAt: string };

const HINGLISH = "Mujhe 38,400 ka refund chahiye, booking Kumbhalgarh ki thi";
const ENGLISH = "Can I move my Goa booking to next weekend?";

/**
 * Real knowledge_sources, policy_gates and knowledge_versions. "Ask Meera a
 * policy question" stays a deterministic test harness (answerPolicy is pure,
 * not a live AI call) but now runs against the real gate states. The old
 * "resort inventory, live lookup" panel is dropped, not faked: no
 * check_availability tool exists on the realtime agent yet (GAP-B-02).
 */
export default function Knowledge() {
  const me = useOrg();
  const [sources, setSources] = useState<Source[]>([]);
  const [gates, setGates] = useState<Gate[]>([]);
  const [versions, setVersions] = useState<Version[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [question, setQuestion] = useState(ENGLISH);
  const [modal, setModal] = useState<null | "source" | "history">(null);
  const [src, setSrc] = useState({ name: "", articles: "20" });

  const gateMap = Object.fromEntries(gates.map((g) => [g.name, g.enabled]));
  const answer: PolicyAnswer = answerPolicy(question, gateMap);

  const load = useCallback(async () => {
    if (!me.orgId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(null);
    const [sourcesRes, gatesRes, versionsRes] = await Promise.all([
      supabase.from("knowledge_sources").select("id, name, sub, emoji, live").eq("org_id", me.orgId).order("name"),
      supabase.from("policy_gates").select("id, name, sub, approver, sla, enabled, triggered_7d").eq("org_id", me.orgId).order("name"),
      supabase.from("knowledge_versions").select("id, label, created_at").eq("org_id", me.orgId).order("created_at", { ascending: false }).limit(20),
    ]);
    const error = sourcesRes.error || gatesRes.error || versionsRes.error;
    if (error) {
      setLoadError(error.message);
      setLoading(false);
      return;
    }
    setSources((sourcesRes.data ?? []).map((s) => ({ id: s.id, name: s.name, sub: s.sub, emoji: s.emoji, live: s.live })));
    setGates((gatesRes.data ?? []).map((g) => ({ id: g.id, name: g.name, sub: g.sub, approver: g.approver, sla: g.sla, enabled: g.enabled, triggered7d: g.triggered_7d })));
    setVersions((versionsRes.data ?? []).map((v) => ({ id: v.id, label: v.label, createdAt: v.created_at })));
    setLoading(false);
  }, [me.orgId]);

  useEffect(() => void load(), [load]);

  const toggleGate = async (gate: Gate) => {
    const enabled = !gate.enabled;
    const { error } = await supabase.from("policy_gates").update({ enabled }).eq("id", gate.id);
    if (error) {
      toast({ title: "Could not update the gate", description: error.message });
      return;
    }
    if (me.orgId) await supabase.rpc("log_audit", { org: me.orgId, change: `Policy gate "${gate.name}" turned ${enabled ? "on, needs human" : "off, Meera may"}` });
    void load();
  };

  const addSource = async () => {
    const name = src.name.trim();
    if (!name || !me.orgId) return;
    const sub = `${src.articles || 0} articles, added ${new Date().toLocaleDateString()}, owner ${me.name}`;
    const { error } = await supabase.from("knowledge_sources").insert({ org_id: me.orgId, name, sub, live: false });
    if (error) {
      toast({ title: "Could not add the source", description: error.message });
      return;
    }
    await supabase.rpc("log_audit", { org: me.orgId, change: `Knowledge source "${name}" added, pending review` });
    setModal(null);
    setSrc({ name: "", articles: "20" });
    toast({ title: `${name} added`, description: "Mark it reviewed once it is ready to go live." });
    void load();
  };

  const markReviewed = async (source: Source) => {
    if (!me.orgId) return;
    const { error } = await supabase.from("knowledge_sources").update({ live: true }).eq("id", source.id);
    if (error) {
      toast({ title: "Could not update the source", description: error.message });
      return;
    }
    await supabase.rpc("log_audit", { org: me.orgId, change: `Knowledge source "${source.name}" reviewed` });
    void load();
  };

  const saveSnapshot = async () => {
    if (!me.orgId) return;
    const label = `${gates.filter((g) => g.enabled).length} gates on, ${sources.length} sources · ${me.name}`;
    const { error } = await supabase.from("knowledge_versions").insert({ org_id: me.orgId, label });
    if (error) {
      toast({ title: "Could not save the snapshot", description: error.message });
      return;
    }
    await supabase.rpc("log_audit", { org: me.orgId, change: "Knowledge and policy snapshot saved" });
    toast({ title: "Snapshot saved" });
    void load();
  };

  if (loading) return <Panel className="p-8 text-center text-sm text-zinc-500">Loading…</Panel>;
  if (loadError) return <Panel className="p-8 text-center text-sm text-red-600">{loadError}</Panel>;

  return (
    <>
      <PageTitle
        crumb="Build, Club Mahindra member line, Meera v7"
        title="Knowledge and policies"
        actions={
          <>
            <Btn onClick={() => setModal("history")}>Version history</Btn>
            <Btn variant="primary" onClick={saveSnapshot} disabled={!canEdit(me.role)}>
              Save snapshot
            </Btn>
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[380px_1fr]">
        <div className="space-y-4">
          <Panel>
            <PanelHeader
              title="Knowledge sources"
              right={
                canEdit(me.role) ? (
                  <button onClick={() => setModal("source")} className="text-xs font-medium text-[#E2703A]">
                    Add source
                  </button>
                ) : undefined
              }
            />
            {sources.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-zinc-500">No knowledge sources yet.</p>
            ) : (
              <ul className="divide-y divide-zinc-100">
                {sources.map((s) => (
                  <li key={s.id} className="flex items-center gap-3 px-4 py-3">
                    <IconTile emoji={s.emoji} />
                    <div className="flex-1">
                      <p className="text-sm font-medium">{s.name}</p>
                      <p className="text-xs text-zinc-500">{s.sub}</p>
                    </div>
                    {s.live ? (
                      <Pill tone="green">Live</Pill>
                    ) : (
                      <button onClick={() => markReviewed(s)} disabled={!canEdit(me.role)} title="Mark as reviewed">
                        <Pill tone="amber">Review due</Pill>
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        <Panel className="overflow-x-auto">
          <PanelHeader title="Policy approval gates" right={<span className="text-xs text-zinc-500">Counts are for the last 7 days</span>} />
          {gates.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-zinc-500">No policy gates configured yet.</p>
          ) : (
            <table className="w-full min-w-[620px]">
              <thead className="bg-zinc-50">
                <tr>
                  <Th>On</Th>
                  <Th>Policy</Th>
                  <Th>Meera</Th>
                  <Th>Approver and SLA</Th>
                  <Th className="text-right">Triggered</Th>
                </tr>
              </thead>
              <tbody>
                {gates.map((g) => (
                  <tr key={g.id} className="border-t border-zinc-100">
                    <Td className="py-5">
                      <button onClick={() => toggleGate(g)} disabled={!canEdit(me.role)} aria-label={`Toggle ${g.name}`}>
                        <Toggle on={g.enabled} label={g.name} />
                      </button>
                    </Td>
                    <Td>
                      <p className="font-medium">{g.name}</p>
                      <p className="text-xs text-zinc-500">{g.sub}</p>
                    </Td>
                    <Td>
                      <Pill tone={g.enabled ? "red" : "green"}>{g.enabled ? "Needs human" : "Meera may"}</Pill>
                    </Td>
                    <Td>
                      <p>{g.enabled ? g.approver ?? "No approver" : "No approver"}</p>
                      <p className="text-xs text-zinc-500">{g.sla}</p>
                    </Td>
                    <Td className="text-right text-base font-semibold">{g.triggered7d}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>
      </div>

      <Panel className="mt-4 grid gap-4 p-4 lg:grid-cols-[1fr_1.5fr]">
        <div>
          <p className="text-sm font-semibold">Ask Meera a policy question</p>
          <form
            className="mt-3"
            onSubmit={(e) => {
              e.preventDefault();
              setQuestion(question);
            }}
          >
            <input value={question} onChange={(e) => setQuestion(e.target.value)} className={inputClass} aria-label="Policy question" />
            <div className="mt-3 flex gap-2">
              <Btn variant="dark" size="sm" type="submit">
                Run test
              </Btn>
              <Btn size="sm" onClick={() => setQuestion(question === HINGLISH ? ENGLISH : HINGLISH)}>
                {question === HINGLISH ? "Use an English question" : "Use a Hinglish question"}
              </Btn>
            </div>
          </form>
          <p className="mt-2 text-xs text-zinc-500">A deterministic test harness, not a live AI call. It answers against the gates as currently saved.</p>
        </div>
        <div className={cn("rounded-lg p-4", answer.verdict === "Allowed, no handoff" ? "bg-[#FDF6F1]" : answer.verdict === "Needs a human" ? "bg-amber-50" : "bg-zinc-100")}>
          <p className="flex items-center gap-2 text-sm">
            <span className="font-semibold text-[#E2703A]">Meera would say</span>
            <Pill tone={answer.verdict === "Allowed, no handoff" ? "green" : answer.verdict === "Needs a human" ? "amber" : "neutral"}>{answer.verdict}</Pill>
          </p>
          <p className="mt-2 text-sm">{answer.say}</p>
          <p className="mt-3 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
            Cited source <Pill>{answer.source}</Pill>
            {answer.gate && <Pill tone={gateMap[answer.gate] ? "red" : "green"}>Gate: {answer.gate}</Pill>}
          </p>
        </div>
      </Panel>

      {modal === "source" && (
        <Modal
          title="Add a knowledge source"
          hint="Articles are chunked and indexed. Meera cites the article in every answer that uses it."
          onClose={() => setModal(null)}
          footer={<ModalActions onCancel={() => setModal(null)} onOk={addSource} okLabel="Add source" okDisabled={!src.name.trim()} />}
        >
          <Field label="Name">
            <input value={src.name} onChange={(e) => setSrc({ ...src, name: e.target.value })} className={inputClass} placeholder="Festival blackout dates" />
          </Field>
          <Field label="Articles">
            <input type="number" min={1} value={src.articles} onChange={(e) => setSrc({ ...src, articles: e.target.value })} className={inputClass} />
          </Field>
        </Modal>
      )}
      {modal === "history" && (
        <Modal title="Version history" hint="Every saved snapshot of gates and sources." onClose={() => setModal(null)} footer={<Btn size="sm" onClick={() => setModal(null)}>Close</Btn>}>
          {versions.length === 0 ? (
            <p className="py-4 text-center text-sm text-zinc-500">No snapshots saved yet.</p>
          ) : (
            <ul className="divide-y divide-zinc-100">
              {versions.map((v, i) => (
                <li key={v.id} className={cn("py-2", i === 0 && "font-medium")}>
                  {v.label}
                  {i === 0 && (
                    <Pill tone="green" className="ml-2">
                      Live
                    </Pill>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Modal>
      )}
    </>
  );
}
