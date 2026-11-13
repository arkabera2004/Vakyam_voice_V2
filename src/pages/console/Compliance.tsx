import { Play, Square } from "lucide-react";
import { Btn, IconTile, KV, PageTitle, Panel, PanelHeader, Pill, Td, Th, Toggle } from "@/console/ui";
import { useSpeaker } from "@/console/speak";
import { cn } from "@/lib/utils";

const DISCLOSURE = "Namaste, main Meera hoon, Club Mahindra ki AI assistant. Yeh call quality aur training ke liye record hoti hai. Kya aap is recording ke liye sahmat hain?";

const PII = [
  ["Phone number", "Shown as +91 98XXXXXX10"],
  ["Card number", "Only last 4 digits kept"],
  ["Aadhaar", "Fully redacted, spoken or typed"],
  ["Email address", "Shown as p****@domain"],
];

const AUDIT = [
  ["12 Nov, 11:20", "Kavita Rao", "Opening disclosure approved", "v4.2"],
  ["11 Nov, 17:45", "Asha Nair", "Deletion request closed for Priya Sharma", "DR 214"],
  ["10 Nov, 09:12", "Kavita Rao", "Aadhaar redaction set to full", "PII 3"],
  ["8 Nov, 14:30", "System", "DLT consent registry sync completed", "Auto"],
  ["6 Nov, 10:05", "Kavita Rao", "Call audio retention set to 90 days", "RET 2"],
];

// 14 daily consent bars: height in %, grey for the two low days, orange for today
const DAYS = [92, 95, 94, 96, 97, 70, 98, 96, 98, 99, 97, 96, 72, 98];

export default function Compliance() {
  const speaker = useSpeaker();
  const playing = speaker.playingId === "disclosure";
  return (
    <>
      <PageTitle crumb="Govern, Club Mahindra member line, India region" title="Compliance and consent" actions={<><Btn>Export audit log</Btn><Btn variant="dark">Request deletion</Btn></>} />

      <Panel className="flex flex-wrap items-center gap-4 p-4">
        <IconTile emoji="🎤" size={52} className="rounded-xl" />
        <div className="min-w-[280px] flex-1">
          <p className="flex items-center gap-2 text-sm font-semibold">Opening disclosure, the first thing Meera says <Pill tone="green">Live, v4.2</Pill></p>
          <p className="mt-1 text-base">{DISCLOSURE}</p>
          <p className="mt-1.5 text-xs text-zinc-500">Covers AI assistant disclosure and recording consent. Approved by Kavita Rao on 6 Nov. Played before any account detail is read out.</p>
        </div>
        <div className="flex flex-col gap-2">
          <Btn size="sm">Edit line</Btn>
          <Btn size="sm" disabled={!speaker.supported} onClick={() => speaker.play("disclosure", [{ text: DISCLOSURE, lang: "HI" }])}>
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
          <div className="flex items-center justify-between"><p className="text-sm font-semibold">PII redaction in transcripts</p><span className="text-xs text-zinc-500">4 of 4 on</span></div>
          <ul className="mt-2">
            {PII.map(([k, v]) => (
              <li key={k} className="flex items-center gap-3 py-2.5"><Toggle on label={k} /><div><p className="text-sm font-medium">{k}</p><p className="text-xs text-zinc-500">{v}</p></div></li>
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
          <PanelHeader title="Audit log" right={<span className="text-xs font-medium text-[#E2703A]">See all entries</span>} />
          <table className="w-full">
            <thead className="bg-zinc-50"><tr><Th>When</Th><Th>Who</Th><Th>Change</Th><Th className="text-right">Version</Th></tr></thead>
            <tbody>
              {AUDIT.map((r) => (
                <tr key={r[0]} className="border-t border-zinc-100">
                  <Td className="text-zinc-500">{r[0]}</Td><Td className="font-medium">{r[1]}</Td><Td>{r[2]}</Td><Td className="text-right text-zinc-500">{r[3]}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      </div>
    </>
  );
}

function Big({ v, l, cls }: { v: string; l: string; cls?: string }) {
  return <div><p className={cn("text-2xl font-semibold tracking-[-0.02em]", cls)}>{v}</p><p className="text-xs text-zinc-500">{l}</p></div>;
}
