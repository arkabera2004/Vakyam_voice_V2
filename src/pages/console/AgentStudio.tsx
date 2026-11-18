import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Play, Square, Trash2 } from "lucide-react";
import { Btn, IconTile, Lang, PageTitle, Panel, PanelHeader, Pill, Td, Th } from "@/console/ui";
import { useSpeaker, type Line } from "@/console/speak";
import { Modal, Field, inputClass, ModalActions } from "@/console/Modal";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/hooks/useOrg";
import { can } from "@/domain/roles";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { nextVersion } from "@/lib/agentVersion";

type Agent = { id: string; name: string; description: string; liveVersion: string | null };
type AgentVersion = {
  id: string;
  version: string;
  prompt: string;
  firstMessage: string;
  voice: string;
  speed: number;
  warmth: number;
  personaTone: string;
  personaHandoff: string;
  dictionary: [string, string][];
  createdAt: string;
};
type Draft = { prompt: string; firstMessage: string; voice: string; speed: number; warmth: number; personaTone: string; personaHandoff: string; dictionary: [string, string][] };

const SAMPLE = "Namaste, main Meera bol rahi hoon. Kumbhalgarh mein aapke liye ek Studio available hai.";
const EMPTY_DRAFT: Draft = { prompt: "", firstMessage: "", voice: "aarti", speed: 1.05, warmth: 70, personaTone: "", personaHandoff: "", dictionary: [] };

function rowToVersion(row: { id: string; version: string; prompt: string; first_message: string; voice: string; speed: number; warmth: number; persona_tone: string; persona_handoff: string; dictionary: unknown; created_at: string }): AgentVersion {
  return {
    id: row.id,
    version: row.version,
    prompt: row.prompt,
    firstMessage: row.first_message,
    voice: row.voice,
    speed: row.speed,
    warmth: row.warmth,
    personaTone: row.persona_tone,
    personaHandoff: row.persona_handoff,
    dictionary: Array.isArray(row.dictionary) ? (row.dictionary as [string, string][]) : [],
    createdAt: row.created_at,
  };
}

/** Real agents/agent_versions, no localStorage. A version is never edited once created; "Save" always creates a new one, published separately. */
export default function AgentStudio() {
  const speaker = useSpeaker();
  const navigate = useNavigate();
  const me = useOrg();
  const canEdit = can(me.role, "agents.edit");

  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [versions, setVersions] = useState<AgentVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [modal, setModal] = useState<null | "newAgent" | "editAgent" | "newVersion" | "viewVersion">(null);
  const [agentForm, setAgentForm] = useState({ name: "", description: "" });
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [draftWord, setDraftWord] = useState({ written: "", spoken: "" });
  const [viewing, setViewing] = useState<AgentVersion | null>(null);
  const [busy, setBusy] = useState(false);

  const selected = agents.find((a) => a.id === selectedId) ?? null;
  const live = versions.find((v) => v.version === selected?.liveVersion) ?? null;

  const load = useCallback(async () => {
    if (!me.orgId) {
      setAgents([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(null);
    const { data, error } = await supabase.from("agents").select("id, name, description, live_version").eq("org_id", me.orgId).order("created_at");
    if (error) {
      setLoadError(error.message);
      setLoading(false);
      return;
    }
    const rows = (data ?? []).map((a) => ({ id: a.id, name: a.name, description: a.description, liveVersion: a.live_version }));
    setAgents(rows);
    setSelectedId((current) => (current && rows.some((a) => a.id === current) ? current : rows[0]?.id ?? null));
    setLoading(false);
  }, [me.orgId]);

  useEffect(() => {
    if (!me.loading) void load();
  }, [me.loading, load]);

  useEffect(() => {
    if (!selectedId) {
      setVersions([]);
      return;
    }
    void (async () => {
      const { data, error } = await supabase.from("agent_versions").select("id, version, prompt, first_message, voice, speed, warmth, persona_tone, persona_handoff, dictionary, created_at").eq("agent_id", selectedId).order("created_at", { ascending: false });
      if (error) return toast({ variant: "destructive", title: "Could not load versions", description: error.message });
      setVersions((data ?? []).map(rowToVersion));
    })();
  }, [selectedId]);

  const createAgent = async () => {
    if (!me.orgId || !agentForm.name.trim()) return;
    setBusy(true);
    const { data, error } = await supabase.from("agents").insert({ org_id: me.orgId, name: agentForm.name.trim(), description: agentForm.description.trim() }).select("id").single();
    setBusy(false);
    if (error) return toast({ variant: "destructive", title: "Could not create the agent", description: error.message });
    toast({ title: "Agent created", description: `${agentForm.name.trim()} has no published version yet.` });
    setModal(null);
    setAgentForm({ name: "", description: "" });
    setSelectedId(data.id);
    void load();
  };

  const saveAgent = async () => {
    if (!selected || !agentForm.name.trim()) return;
    setBusy(true);
    const { error } = await supabase.from("agents").update({ name: agentForm.name.trim(), description: agentForm.description.trim() }).eq("id", selected.id);
    setBusy(false);
    if (error) return toast({ variant: "destructive", title: "Could not save the agent", description: error.message });
    toast({ title: "Agent updated" });
    setModal(null);
    void load();
  };

  const saveVersion = async () => {
    if (!selected || !me.orgId) return;
    setBusy(true);
    const { data: userResult } = await supabase.auth.getUser();
    const version = nextVersion(versions.map((v) => v.version));
    const { error } = await supabase.from("agent_versions").insert({
      org_id: me.orgId,
      agent_id: selected.id,
      version,
      prompt: draft.prompt.trim(),
      first_message: draft.firstMessage.trim(),
      voice: draft.voice,
      speed: draft.speed,
      warmth: draft.warmth,
      persona_tone: draft.personaTone.trim(),
      persona_handoff: draft.personaHandoff.trim(),
      dictionary: draft.dictionary,
      created_by: userResult.user?.id,
    });
    setBusy(false);
    if (error) return toast({ variant: "destructive", title: "Could not save the version", description: error.message });
    toast({ title: `${version} saved as a draft`, description: "Publish it from the versions list when you are ready." });
    setModal(null);
    if (selectedId) {
      const { data } = await supabase.from("agent_versions").select("id, version, prompt, first_message, voice, speed, warmth, persona_tone, persona_handoff, dictionary, created_at").eq("agent_id", selectedId).order("created_at", { ascending: false });
      setVersions((data ?? []).map(rowToVersion));
    }
  };

  const publishVersion = async (version: string) => {
    if (!selected) return;
    setBusy(true);
    const { error } = await supabase.rpc("publish_agent_version", { target_agent_id: selected.id, target_version: version });
    setBusy(false);
    if (error) return toast({ variant: "destructive", title: "Could not publish", description: error.message });
    toast({ title: `${version} is live`, description: "New calls use it from now. Calls in progress finish on the version they started with." });
    void load();
  };

  const openNewVersion = () => {
    setDraft(live ? { prompt: live.prompt, firstMessage: live.firstMessage, voice: live.voice, speed: live.speed, warmth: live.warmth, personaTone: live.personaTone, personaHandoff: live.personaHandoff, dictionary: live.dictionary } : EMPTY_DRAFT);
    setModal("newVersion");
  };

  const addDraftWord = () => {
    const w: [string, string] = [draftWord.written.trim(), draftWord.spoken.trim()];
    if (!w[0] || !w[1]) return;
    setDraft((d) => ({ ...d, dictionary: [...d.dictionary.filter(([x]) => x !== w[0]), w] }));
    setDraftWord({ written: "", spoken: "" });
  };

  const PlayBtn = ({ id, lines, label = "Play" }: { id: string; lines: Line[]; label?: string }) => {
    const on = speaker.playingId === id;
    return (
      <Btn size="sm" onClick={() => speaker.play(id, lines)} disabled={!speaker.supported} title={speaker.supported ? undefined : "Speech is not available in this browser"}>
        {on ? <Square className="h-3 w-3 fill-current" /> : <Play className="h-3 w-3" />} {on ? "Stop" : label}
      </Btn>
    );
  };

  return (
    <>
      <PageTitle crumb="Build / Agent studio" title="Shape how your agent sounds and speaks" actions={<><Btn onClick={() => navigate("/voice")}>Test in browser</Btn>{canEdit && <Btn onClick={() => { setAgentForm({ name: "", description: "" }); setModal("newAgent"); }}>New agent</Btn>}</>} />

      {!me.orgId && !me.loading && <Panel className="p-4 text-sm text-zinc-600">You do not belong to an organisation yet.</Panel>}
      {loadError && <Panel className="p-4 text-sm text-red-600">Could not load agents: {loadError}</Panel>}

      {me.orgId && loading && <Panel className="p-8 text-center text-sm text-zinc-500">Loading…</Panel>}

      {me.orgId && !loading && agents.length === 0 && (
        <Panel className="p-8 text-center">
          <p className="text-sm text-zinc-600">No voice agent has been created for this organisation yet.</p>
          {canEdit && <Btn className="mt-3" variant="primary" onClick={() => { setAgentForm({ name: "", description: "" }); setModal("newAgent"); }}>Create your first agent</Btn>}
        </Panel>
      )}

      {me.orgId && !loading && selected && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-4">
            <Panel className="p-4">
              <div className="flex items-center gap-3">
                <IconTile emoji="🎤" size={48} className="rounded-xl" />
                <div className="flex-1">
                  {agents.length > 1 ? (
                    <select value={selected.id} onChange={(e) => setSelectedId(e.target.value)} className="text-lg font-semibold">
                      {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </select>
                  ) : (
                    <p className="text-lg font-semibold">{selected.name}</p>
                  )}
                  <p className="text-[13px] text-zinc-500">{selected.description || "No description"}</p>
                </div>
                {selected.liveVersion ? <Pill tone="green">Live as {selected.liveVersion}</Pill> : <Pill tone="amber">No published version</Pill>}
                {canEdit && <Btn size="sm" onClick={() => { setAgentForm({ name: selected.name, description: selected.description }); setModal("editAgent"); }}>Edit agent</Btn>}
              </div>
              {live && (
                <div className="mt-4 grid grid-cols-3 gap-2">
                  <Fact k="Tone" v={live.personaTone || "—"} />
                  <Fact k="Languages" v={<span className="flex gap-1"><Lang code="HI" /><Lang code="EN" /></span>} />
                  <Fact k="Hands off to a human" v={live.personaHandoff || "—"} />
                </div>
              )}
            </Panel>

            <Panel>
              <PanelHeader title="Versions" hint="A version is never edited once saved; publishing points live traffic at one" right={canEdit && <Btn size="sm" onClick={openNewVersion}>New version</Btn>} />
              <ul className="px-2 py-2">
                {versions.map((v) => {
                  const isLive = v.version === selected.liveVersion;
                  return (
                    <li key={v.id} className={cn("flex items-center gap-3 rounded-lg px-2 py-2.5", isLive && "bg-[#FDF6F1]")}>
                      <span className="flex h-7 w-8 items-center justify-center rounded-md bg-violet-50 text-[11px] font-semibold text-violet-700">{v.version}</span>
                      <div className="flex-1">
                        <p className="flex items-center gap-2 text-sm font-medium">{v.prompt ? v.prompt.slice(0, 60) + (v.prompt.length > 60 ? "…" : "") : "No prompt set"}{isLive && <Pill tone="green">Live</Pill>}</p>
                        <p className="text-xs text-zinc-500">{new Date(v.createdAt).toLocaleString()}</p>
                      </div>
                      <Btn size="sm" onClick={() => { setViewing(v); setModal("viewVersion"); }}>View</Btn>
                      {canEdit && <Btn size="sm" variant={isLive ? "outline" : "primary"} disabled={isLive || busy} onClick={() => publishVersion(v.version)}>{isLive ? "Live now" : "Publish"}</Btn>}
                    </li>
                  );
                })}
                {versions.length === 0 && <li className="px-2 py-6 text-center text-sm text-zinc-500">No versions yet. {canEdit && "Create one to get started."}</li>}
              </ul>
            </Panel>
          </div>

          <div className="space-y-4">
            <Panel>
              <PanelHeader title="Opening line" hint="First thing every caller hears, from the live version" />
              <div className="space-y-3 p-4">
                {live?.firstMessage ? (
                  <div className="rounded-lg bg-zinc-50 p-3">
                    <p className="text-sm leading-relaxed">{live.firstMessage}</p>
                    <PlayBtn id="opening" lines={[{ text: live.firstMessage, lang: "EN" }]} />
                  </div>
                ) : (
                  <p className="text-sm text-zinc-500">The live version has no opening line set.</p>
                )}
              </div>
            </Panel>

            <Panel>
              <PanelHeader title="Pronunciation dictionary" hint="From the live version" />
              <table className="w-full">
                <thead className="bg-zinc-50"><tr><Th>Written as</Th><Th>Spoken as</Th></tr></thead>
                <tbody>
                  {(live?.dictionary ?? []).map(([w, s]) => (
                    <tr key={w} className="border-t border-zinc-100"><Td className="font-medium">{w}</Td><Td className="text-zinc-600">{s}</Td></tr>
                  ))}
                  {(!live || live.dictionary.length === 0) && <tr><Td colSpan={2} className="py-6 text-center text-zinc-500">No words yet.</Td></tr>}
                </tbody>
              </table>
            </Panel>

            <Panel>
              <PanelHeader title="Voice" hint="From the live version" right={speaker.engine && <Pill tone={speaker.engine === "azure" ? "green" : "neutral"}>{speaker.engine === "azure" ? "Previewing with Azure" : "Previewing with browser voice"}</Pill>} />
              <div className="grid gap-3 p-4 sm:grid-cols-2">
                <VoiceCard emoji="🎤" name="Aarti Indic" vendor="Azure Speech" desc="en-IN-AartiIndicNeural. Natural Hindi and English switching." selected={live?.voice === "aarti"} play={<PlayBtn id="voice:aarti" label="Play sample" lines={[{ text: SAMPLE, lang: "HI" }]} />} />
                <VoiceCard emoji="🧊" name="marin" vendor="gpt-realtime voice" desc="Speech to speech. Lower latency, less control over Hindi names." selected={live?.voice === "marin"} play={<PlayBtn id="voice:marin" label="Play sample" lines={[{ text: SAMPLE, lang: "EN", rate: 1.1 }]} />} />
              </div>
              {live && (
                <div className="space-y-2 px-4 pb-4 text-sm text-zinc-600">
                  <p>Speed: {live.speed.toFixed(2)}x</p>
                  <p>Warmth: {live.warmth}</p>
                </div>
              )}
            </Panel>
          </div>
        </div>
      )}

      {modal === "newAgent" && (
        <Modal title="New agent" hint="Create the agent first, then add a version with its prompt and voice." onClose={() => setModal(null)} footer={<ModalActions onCancel={() => setModal(null)} onOk={createAgent} okLabel={busy ? "Creating…" : "Create"} okDisabled={!agentForm.name.trim() || busy} />}>
          <Field label="Name"><input value={agentForm.name} onChange={(e) => setAgentForm({ ...agentForm, name: e.target.value })} className={inputClass} placeholder="Meera" /></Field>
          <Field label="Description"><input value={agentForm.description} onChange={(e) => setAgentForm({ ...agentForm, description: e.target.value })} className={inputClass} placeholder="Member concierge" /></Field>
        </Modal>
      )}

      {modal === "editAgent" && selected && (
        <Modal title="Edit agent" onClose={() => setModal(null)} footer={<ModalActions onCancel={() => setModal(null)} onOk={saveAgent} okLabel={busy ? "Saving…" : "Save"} okDisabled={!agentForm.name.trim() || busy} />}>
          <Field label="Name"><input value={agentForm.name} onChange={(e) => setAgentForm({ ...agentForm, name: e.target.value })} className={inputClass} /></Field>
          <Field label="Description"><input value={agentForm.description} onChange={(e) => setAgentForm({ ...agentForm, description: e.target.value })} className={inputClass} /></Field>
        </Modal>
      )}

      {modal === "newVersion" && (
        <Modal title="New version" hint="Saved as a draft. Nothing changes for live calls until you publish it from the versions list." onClose={() => setModal(null)} footer={<ModalActions onCancel={() => setModal(null)} onOk={saveVersion} okLabel={busy ? "Saving…" : "Save draft"} okDisabled={busy} />}>
          <Field label="Prompt"><textarea value={draft.prompt} onChange={(e) => setDraft({ ...draft, prompt: e.target.value })} rows={6} className={inputClass + " h-auto py-2"} /></Field>
          <Field label="Opening line"><input value={draft.firstMessage} onChange={(e) => setDraft({ ...draft, firstMessage: e.target.value })} className={inputClass} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Voice">
              <select value={draft.voice} onChange={(e) => setDraft({ ...draft, voice: e.target.value })} className={inputClass}>
                <option value="aarti">Aarti Indic (Azure Speech)</option>
                <option value="marin">marin (gpt-realtime)</option>
              </select>
            </Field>
            <Field label="Hands off to a human for"><input value={draft.personaHandoff} onChange={(e) => setDraft({ ...draft, personaHandoff: e.target.value })} className={inputClass} /></Field>
          </div>
          <Field label="Tone"><input value={draft.personaTone} onChange={(e) => setDraft({ ...draft, personaTone: e.target.value })} className={inputClass} placeholder="Warm and brief" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={`Speed (${draft.speed.toFixed(2)}x)`}><input type="range" min={0.8} max={1.3} step={0.05} value={draft.speed} onChange={(e) => setDraft({ ...draft, speed: Number(e.target.value) })} className="w-full" /></Field>
            <Field label={`Warmth (${draft.warmth})`}><input type="range" min={0} max={100} step={5} value={draft.warmth} onChange={(e) => setDraft({ ...draft, warmth: Number(e.target.value) })} className="w-full" /></Field>
          </div>
          <Field label="Pronunciation dictionary">
            <div className="space-y-2">
              {draft.dictionary.map(([w, s]) => (
                <div key={w} className="flex items-center justify-between rounded-md bg-zinc-50 px-2 py-1 text-sm">
                  <span>{w} → {s}</span>
                  <button type="button" onClick={() => setDraft((d) => ({ ...d, dictionary: d.dictionary.filter(([x]) => x !== w) }))} aria-label={`Remove ${w}`}><Trash2 className="h-3.5 w-3.5 text-zinc-400 hover:text-red-600" /></button>
                </div>
              ))}
              <div className="flex gap-2">
                <input value={draftWord.written} onChange={(e) => setDraftWord({ ...draftWord, written: e.target.value })} className={inputClass} placeholder="Written as" />
                <input value={draftWord.spoken} onChange={(e) => setDraftWord({ ...draftWord, spoken: e.target.value })} className={inputClass} placeholder="Spoken as" />
                <Btn size="sm" onClick={addDraftWord} disabled={!draftWord.written.trim() || !draftWord.spoken.trim()}>Add</Btn>
              </div>
            </div>
          </Field>
        </Modal>
      )}

      {modal === "viewVersion" && viewing && (
        <Modal title={`Version ${viewing.version}`} onClose={() => setModal(null)} footer={<Btn size="sm" onClick={() => setModal(null)}>Close</Btn>}>
          <div className="space-y-3 text-sm">
            <div><p className="text-xs text-zinc-500">Prompt</p><p className="whitespace-pre-wrap rounded-md bg-zinc-50 p-2">{viewing.prompt || "—"}</p></div>
            <div><p className="text-xs text-zinc-500">Opening line</p><p>{viewing.firstMessage || "—"}</p></div>
            <div className="grid grid-cols-2 gap-3">
              <div><p className="text-xs text-zinc-500">Voice</p><p>{viewing.voice}</p></div>
              <div><p className="text-xs text-zinc-500">Speed / warmth</p><p>{viewing.speed.toFixed(2)}x / {viewing.warmth}</p></div>
            </div>
            <div><p className="text-xs text-zinc-500">Tone / hands off</p><p>{viewing.personaTone || "—"} / {viewing.personaHandoff || "—"}</p></div>
          </div>
        </Modal>
      )}
    </>
  );
}

function Fact({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-zinc-50 p-3">
      <p className="text-xs text-zinc-500">{k}</p>
      <p className="mt-0.5 text-sm font-semibold">{v}</p>
    </div>
  );
}

function VoiceCard({ emoji, name, vendor, desc, selected, play }: { emoji: string; name: string; vendor: string; desc: string; selected?: boolean; play: React.ReactNode }) {
  return (
    <div className={cn("rounded-xl border p-4", selected ? "border-[#E2703A] bg-[#FDF6F1]" : "border-zinc-200")}>
      <div className="flex items-center gap-3">
        <IconTile emoji={emoji} />
        <div className="flex-1">
          <p className="text-sm font-semibold">{name}</p>
          <p className="text-xs text-zinc-500">{vendor}</p>
        </div>
        {selected && <Pill tone="orange">Live</Pill>}
      </div>
      <p className="mt-3 text-xs text-zinc-600">{desc}</p>
      {play}
    </div>
  );
}
