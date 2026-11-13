import { useState } from "react";
import { Play, Square } from "lucide-react";
import { Btn, IconTile, KV, PageTitle, Panel, PanelHeader, Pill, Td, Th, Toggle } from "@/console/ui";
import { useSpeaker } from "@/console/speak";
import { useConsole } from "@/console/store";
import { Modal, Field, inputClass, ModalActions } from "@/console/Modal";
import { downloadCsv } from "@/console/export";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const PII = [
  ["Phone number", "Shown as +91 98XXXXXX10"],
  ["Card number", "Only last 4 digits kept"],
  ["Aadhaar", "Fully redacted, spoken or typed"],
  ["Email address", "Shown as p****@domain"],
];

// 14 daily consent bars: height in %, grey for the two low days, orange for today
const DAYS = [92, 95, 94, 96, 97, 70, 98, 96, 98, 99, 97, 96, 72, 98];
const REQUIRED = [/meera/i, /ai|artificial/i, /record/i];

export default function Compliance() {
  const speaker = useSpeaker();
  const { state, update, log } = useConsole();
  const { disclosure, pii, audit } = state;
  const playing = speaker.playingId === "disclosure";
  const [modal, setModal] = useState<null | "edit" | "delete" | "audit">(null);
  const [draft, setDraft] = useState(disclosure.text);
  const [del, setDel] = useState({ member: "", id: "", reason: "Member asked under DPDP" });
  const piiOn = Object.values(pii).filter(Boolean).length;
  const missing = REQUIRED.filter((r) => !r.test(draft));

  const togglePii = (k: string) => {
    const on = !pii[k];
    update((s) => ({ pii: { ...s.pii, [k]: on } }));
    log(`${k} redaction turned ${on ? "on" : "off"}`, `PII ${Object.keys(pii).indexOf(k) + 1}`);
    if (!on) toast({ variant: "destructive", title: `${k} now kept in transcripts`, description: "This widens what reviewers can see. It is in the audit log under your name." });
  };

  const saveLine = () => {
    const [maj, min] = disclosure.version.slice(1).split(".").map(Number);
    const version = `v${maj}.${min + 1}`;
    update({ disclosure: { text: draft.trim(), version } });
    log(`Opening disclosure updated and approved`, version);
    setModal(null);
    toast({ title: `Disclosure ${version} is live`, description: "Every new call opens with the new line. Previous versions stay in the audit log." });
  };

  const requestDeletion = () => {
    if (!del.member.trim()) return;
    const ref = `DR ${215 + audit.filter((a) => a.version.startsWith("DR")).length - 1}`;
    log(`Deletion request opened for ${del.member.trim()}${del.id ? `, member ${del.id}` : ""}: ${del.reason}`, ref);
    setModal(null);
    setDel({ member: "", id: "", reason: "Member asked under DPDP" });
    toast({ title: `${ref} opened`, description: `Audio, transcripts and CRM notes for ${del.member.trim()} are purged within 7 days. You get a closing entry here.` });
  };

  const exportAudit = () => {
    downloadCsv("audit-log.csv", [["When", "Who", "Change", "Version"], ...audit.map((a) => [a.when, a.who, a.change, a.version])]);
    toast({ title: "Audit log exported", description: `${audit.length} entries, newest first.` });
  };

  return (
    <>
      <PageTitle crumb="Govern, Club Mahindra member line, India region" title="Compliance and consent" actions={<><Btn onClick={exportAudit}>Export audit log</Btn><Btn variant="dark" onClick={() => setModal("delete")}>Request deletion</Btn></>} />

      <Panel className="flex flex-wrap items-center gap-4 p-4">
        <IconTile emoji="🎤" size={52} className="rounded-xl" />
        <div className="min-w-[280px] flex-1">
          <p className="flex items-center gap-2 text-sm font-semibold">Opening disclosure, the first thing Meera says <Pill tone="green">Live, {disclosure.version}</Pill></p>
          <p className="mt-1 text-base">{disclosure.text}</p>
          <p className="mt-1.5 text-xs text-zinc-500">Covers AI assistant disclosure and recording consent. Approved by Kavita Rao. Played before any account detail is read out.</p>
        </div>
        <div className="flex flex-col gap-2">
          <Btn size="sm" onClick={() => { setDraft(disclosure.text); setModal("edit"); }}>Edit line</Btn>
          <Btn size="sm" disabled={!speaker.supported} onClick={() => speaker.play("disclosure", [{ text: disclosure.text, lang: "HI" }])}>
            {playing ? <Square className="h-3 w-3 fill-current" /> : <Play className="h-3 w-3" />} {playing ? "Stop" : "Play audio"}
          </Btn>
        </div>
      </Panel>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Panel className="p-4">
          <div className="flex items-center justify-between"><p className="text-sm font-semibold">Consent rates</p><span className="text-xs text-zinc-500">Last 14 days, 17,806 calls</span></div>
          <div className="mt-3 flex h-2 overflow-hidden rounded-full"><div className="w-[97.9%] bg-zinc-900" /><div className="w-[1.6%] bg-[#E2703A]" /><div className="flex-1 bg-zinc-300" /></div>
          <div className="mt-3 grid grid-cols-3">
            <Big v="97.9%" l="Consent given" />
            <Big v="1.6%" l="Declined" cls="text-[#E2703A]" />
            <Big v="0.5%" l="Hung up" cls="text-zinc-500" />
          </div>
          <div className="mt-4 flex h-16 items-end gap-1">
            {DAYS.map((d, i) => <span key={i} className={cn("flex-1 rounded-sm", i === DAYS.length - 1 ? "bg-[#E2703A]" : d < 80 ? "bg-zinc-300" : "bg-zinc-900")} style={{ height: `${d}%` }} />)}
          </div>
          <div className="mt-1.5 flex justify-between text-[11px] text-zinc-500"><span>Daily consent given, 29 Oct</span><span>Today</span></div>
        </Panel>

        <Panel className="p-4">
          <div className="flex items-center justify-between"><p className="text-sm font-semibold">Retention and data region</p><Pill tone="green">DPDP aligned</Pill></div>
          <div className="mt-1">
            <KV k="Call audio" v="90 days" />
            <KV k="Transcripts" v="12 months" />
            <KV k="Delete on request" v="Within 7 days" />
            <KV k="Data region" v="India, Azure Central India" />
            <KV k="Leaves region" v="Never, stays in region" vClass="text-emerald-600" />
          </div>
        </Panel>

        <Panel className="p-4">
          <div className="flex items-center justify-between"><p className="text-sm font-semibold">PII redaction in transcripts</p><span className={cn("text-xs", piiOn < 4 ? "font-medium text-red-600" : "text-zinc-500")}>{piiOn} of 4 on</span></div>
          <ul className="mt-2">
            {PII.map(([k, v]) => (
              <li key={k} className="flex items-center gap-3 py-2.5">
                <button onClick={() => togglePii(k)} aria-label={`Toggle ${k} redaction`}><Toggle on={!!pii[k]} label={k} /></button>
                <div><p className="text-sm font-medium">{k}</p><p className="text-xs text-zinc-500">{pii[k] ? v : "Kept in full. Reviewers see it."}</p></div>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_2fr]">
        <Panel className="p-4">
          <div className="flex items-center justify-between"><p className="text-sm font-semibold">TRAI DLT, outbound calls</p><Pill tone="green">All clear</Pill></div>
          <KV k="Header" v={<span className="flex items-center gap-2">CLBMHN <Pill tone="green">Approved</Pill></span>} />
          <KV k="Number series" v={<span className="flex items-center gap-2">140 and 160 <Pill tone="green">Approved</Pill></span>} />
          <KV k="Consent registry" v={<span className="flex items-center gap-2">Synced 14:02 <Pill tone="green">Healthy</Pill></span>} />
          <KV k="Calling window" v="9:00 to 21:00 IST" />
        </Panel>

        <Panel>
          <PanelHeader title="Audit log" hint={`${audit.length} entries`} right={<button onClick={() => setModal("audit")} className="text-xs font-medium text-[#E2703A]">See all entries</button>} />
          <AuditTable rows={audit.slice(0, 5)} />
        </Panel>
      </div>

      {modal === "edit" && (
        <Modal title="Edit the opening disclosure" hint="It must name Meera, say she is an AI, and mention recording. Saving publishes a new version." onClose={() => setModal(null)} footer={<ModalActions onCancel={() => setModal(null)} onOk={saveLine} okLabel={`Approve as v${disclosure.version.slice(1).split(".")[0]}.${Number(disclosure.version.split(".")[1]) + 1}`} okDisabled={missing.length > 0 || draft.trim() === disclosure.text} />}>
          <Field label="Line, spoken in Hindi first"><textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={4} className={inputClass + " h-auto py-2"} /></Field>
          <p className={cn("text-xs", missing.length ? "text-red-600" : "text-emerald-600")}>
            {missing.length ? `Missing required wording: ${missing.map((r) => r.source.replace(/\\|\^|\$|\(|\)/g, "").split("|")[0]).join(", ")}` : "All required wording present."}
          </p>
        </Modal>
      )}
      {modal === "delete" && (
        <Modal title="Request deletion" hint="Purges audio, transcripts and CRM notes for one member within 7 days, as DPDP requires." onClose={() => setModal(null)} footer={<ModalActions onCancel={() => setModal(null)} onOk={requestDeletion} okLabel="Open request" okDisabled={!del.member.trim()} danger />}>
          <Field label="Member name"><input value={del.member} onChange={(e) => setDel({ ...del, member: e.target.value })} className={inputClass} placeholder="Priya Sharma" /></Field>
          <Field label="Member ID (optional)"><input value={del.id} onChange={(e) => setDel({ ...del, id: e.target.value })} className={inputClass} placeholder="20418" /></Field>
          <Field label="Reason"><select value={del.reason} onChange={(e) => setDel({ ...del, reason: e.target.value })} className={inputClass}><option>Member asked under DPDP</option><option>Consent withdrawn mid call</option><option>Legal hold lifted</option></select></Field>
        </Modal>
      )}
      {modal === "audit" && (
        <Modal title="Audit log" hint="Every governed change on this desk, newest first." onClose={() => setModal(null)} footer={<><Btn size="sm" onClick={exportAudit}>Export CSV</Btn><Btn size="sm" variant="dark" onClick={() => setModal(null)}>Close</Btn></>}>
          <div className="-mx-5 max-h-[60vh] overflow-y-auto"><AuditTable rows={audit} /></div>
        </Modal>
      )}
    </>
  );
}

function AuditTable({ rows }: { rows: { when: string; who: string; change: string; version: string }[] }) {
  return (
    <table className="w-full">
      <thead className="bg-zinc-50"><tr><Th>When</Th><Th>Who</Th><Th>Change</Th><Th className="text-right">Version</Th></tr></thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={r.when + r.change + i} className="border-t border-zinc-100">
            <Td className="whitespace-nowrap text-zinc-500">{r.when}</Td><Td className="font-medium">{r.who}</Td><Td>{r.change}</Td><Td className="whitespace-nowrap text-right text-zinc-500">{r.version}</Td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Big({ v, l, cls }: { v: string; l: string; cls?: string }) {
  return <div><p className={cn("text-2xl font-semibold tracking-[-0.02em]", cls)}>{v}</p><p className="text-xs text-zinc-500">{l}</p></div>;
}
