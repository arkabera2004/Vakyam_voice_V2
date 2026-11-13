import { Play } from "lucide-react";
import { Btn, IconTile, Lang, PageTitle, Panel, PanelHeader, Pill, Td, Th } from "@/console/ui";
import { cn } from "@/lib/utils";

const VERSIONS = [
  { v: "v7", title: "Shorter holds, clearer consent line", meta: "10 Nov, Kavita Rao", delta: "+2.1", live: true },
  { v: "v6", title: "Pronunciation dictionary added", meta: "29 Oct, Kavita Rao", delta: "+1.4" },
  { v: "v5", title: "Hindi and English code switching rules", meta: "14 Oct, Asha Nair", delta: "-0.6", publish: true },
];

const DICT = [
  ["Club Mahindra", "klub muh-HIN-dra"],
  ["Kumbhalgarh", "koom-bhul-GARH"],
  ["Lonavala", "lo-NAV-la"],
  ["Mussoorie", "moo-SOO-ree"],
  ["Member id 20418", "two, zero, four, one, eight (digit by digit)"],
];

const HI_LINE = "Namaste, Club Mahindra se Meera bol rahi hoon, ek AI sahayak. Is call ko quality aur training ke liye record kiya ja sakta hai. Agar aap record nahi karwana chahte, toh bata dijiye. Kya aap theek hain?";
const EN_LINE = "Hello, this is Meera from Club Mahindra, an AI assistant. This call may be recorded for quality and training. Tell me if you would rather not be recorded. How can I help you today?";

export default function AgentStudio() {
  return (
    <>
      <PageTitle crumb="Build / Agent studio / Club Mahindra member line" title="Shape how Meera sounds and speaks" actions={<><Btn>Test in browser</Btn><Btn>Compare v7 with v6</Btn></>} />

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          <Panel className="p-4">
            <div className="flex items-center gap-3">
              <IconTile emoji="🎤" size={48} className="rounded-xl" />
              <div className="flex-1">
                <p className="text-lg font-semibold">Meera</p>
                <p className="text-[13px] text-zinc-500">Club Mahindra member concierge</p>
              </div>
              <Pill tone="green">Live as v7</Pill>
              <Btn size="sm">Edit persona</Btn>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2">
              <Fact k="Tone" v="Warm and brief" />
              <Fact k="Languages" v={<span className="flex gap-1"><Lang code="HI" /><Lang code="EN" /></span>} />
              <Fact k="Hands off to a human" v="Refunds and upgrades" />
            </div>
          </Panel>

          <Panel>
            <PanelHeader title="Prompt versions" hint="QA delta is the scorecard change against the previous version" />
            <ul className="px-2 py-2">
              {VERSIONS.map((x) => (
                <li key={x.v} className={cn("flex items-center gap-3 rounded-lg px-2 py-2.5", x.live && "bg-[#FDF6F1]")}>
                  <span className="flex h-7 w-8 items-center justify-center rounded-md bg-violet-50 text-[11px] font-semibold text-violet-700">{x.v}</span>
                  <div className="flex-1">
                    <p className="flex items-center gap-2 text-sm font-medium">{x.title}{x.live && <Pill tone="green">Live</Pill>}</p>
                    <p className="text-xs text-zinc-500">{x.meta}</p>
                  </div>
                  <span className={cn("text-sm font-semibold", x.delta.startsWith("-") ? "text-red-600" : "text-emerald-600")}>{x.delta}</span>
                  <Btn size="sm" variant={x.publish ? "primary" : "outline"}>{x.publish ? "Publish" : "Roll back"}</Btn>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel>
            <PanelHeader title="Opening line" hint="First thing every caller hears" right={<span className="flex items-center gap-2"><Pill tone="amber">Required wording</Pill><Btn size="sm"><Play className="h-3 w-3" /> Play both</Btn></span>} />
            <div className="space-y-3 p-4">
              <OpeningLine lang="HI" text={HI_LINE} note="Shown to members who prefer Hindi. 22 seconds spoken." />
              <OpeningLine lang="EN" text={EN_LINE} note="Used when language detect returns English." />
            </div>
          </Panel>
        </div>

        <div className="space-y-4">
          <Panel>
            <PanelHeader title="Pronunciation dictionary" hint="Applied before speech is synthesised" right={<Btn size="sm">Add word</Btn>} />
            <table className="w-full">
              <thead className="bg-zinc-50"><tr><Th>Written as</Th><Th>Spoken as</Th><Th className="text-right">Preview</Th></tr></thead>
              <tbody>
                {DICT.map(([w, s]) => (
                  <tr key={w} className="border-t border-zinc-100">
                    <Td className="font-medium">{w}</Td>
                    <Td className="text-zinc-600">{s}</Td>
                    <Td className="text-right"><Btn size="sm"><Play className="h-3 w-3" /> Play</Btn></Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>

          <Panel>
            <PanelHeader title="Voice" hint="Changes apply to new calls only" />
            <div className="grid gap-3 p-4 sm:grid-cols-2">
              <VoiceCard emoji="🎤" name="Aarti Indic" vendor="Azure Speech" desc="en-IN-AartiIndicNeural. Natural Hindi and English switching." selected />
              <VoiceCard emoji="🧊" name="marin" vendor="gpt-realtime voice" desc="Speech to speech. Lower latency, less control over Hindi names." />
            </div>
            <div className="space-y-4 px-4 pb-4">
              <Slider label="Speed" pct={56} value="1.05x, steady" />
              <Slider label="Warmth" pct={70} value="70, friendly" />
            </div>
          </Panel>
        </div>
      </div>
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

function OpeningLine({ lang, text, note }: { lang: "HI" | "EN"; text: string; note: string }) {
  return (
    <div className="rounded-lg bg-zinc-50 p-3">
      <p className="text-sm leading-relaxed">{text}</p>
      <p className="mt-2 flex items-center gap-2 text-xs text-zinc-500"><Lang code={lang} />{note}</p>
    </div>
  );
}

function VoiceCard({ emoji, name, vendor, desc, selected }: { emoji: string; name: string; vendor: string; desc: string; selected?: boolean }) {
  return (
    <div className={cn("rounded-xl border p-4", selected ? "border-[#E2703A] bg-[#FDF6F1]" : "border-zinc-200")}>
      <div className="flex items-center gap-3">
        <IconTile emoji={emoji} />
        <div className="flex-1">
          <p className="text-sm font-semibold">{name}</p>
          <p className="text-xs text-zinc-500">{vendor}</p>
        </div>
        {selected && <Pill tone="orange">Selected</Pill>}
      </div>
      <p className="mt-3 text-xs text-zinc-600">{desc}</p>
      <Btn size="sm" variant={selected ? "dark" : "outline"} className="mt-3"><Play className="h-3 w-3" /> Play sample</Btn>
    </div>
  );
}

function Slider({ label, pct, value }: { label: string; pct: number; value: string }) {
  return (
    <div className="flex items-center gap-4 text-sm">
      <span className="w-16 text-zinc-600">{label}</span>
      <div className="relative h-1 flex-1 rounded-full bg-zinc-200">
        <div className="h-1 rounded-full bg-[#E2703A]" style={{ width: `${pct}%` }} />
        <span className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[#E2703A] bg-white" style={{ left: `${pct}%` }} />
      </div>
      <span className="w-24 text-right font-medium">{value}</span>
    </div>
  );
}
