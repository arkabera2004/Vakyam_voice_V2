import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Play, Square, Trash2 } from "lucide-react";
import { Btn, IconTile, Lang, PageTitle, Panel, PanelHeader, Pill, Td, Th } from "@/console/ui";
import { useSpeaker, type Line } from "@/console/speak";
import { useConsole } from "@/console/store";
import { Modal, Field, inputClass, ModalActions } from "@/console/Modal";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const VERSIONS = [
  { v: "v7", title: "Shorter holds, clearer consent line", meta: "10 Nov, Kavita Rao", delta: "+2.1" },
  { v: "v6", title: "Pronunciation dictionary added", meta: "29 Oct, Kavita Rao", delta: "+1.4" },
  { v: "v5", title: "Hindi and English code switching rules", meta: "14 Oct, Asha Nair", delta: "-0.6" },
];

const HI_LINE = "Namaste, Club Mahindra se Meera bol rahi hoon, ek AI sahayak. Is call ko quality aur training ke liye record kiya ja sakta hai. Agar aap record nahi karwana chahte, toh bata dijiye. Kya aap theek hain?";
const SAMPLE = "Namaste, main Meera bol rahi hoon. Kumbhalgarh mein aapke liye ek Studio available hai.";
const EN_LINE = "Hello, this is Meera from Club Mahindra, an AI assistant. This call may be recorded for quality and training. Tell me if you would rather not be recorded. How can I help you today?";

const COMPARE = [
  ["Average QA", "89.3", "91.4"], ["Language match", "81", "82"], ["Hold placed without consent", "0.9%", "0.2%"], ["Average handle time", "3m 54s", "3m 42s"], ["Opening line spoken", "24 s", "22 s"],
];

export default function AgentStudio() {
  const speaker = useSpeaker();
  const navigate = useNavigate();
  const { state, update, log } = useConsole();
  const [modal, setModal] = useState<null | "persona" | "word" | "compare">(null);
  const [persona, setPersona] = useState(state.persona);
  const [word, setWord] = useState({ written: "", spoken: "" });
  const rate = state.speed;

  const PlayBtn = ({ id, lines, label = "Play", variant = "outline" as const, className }: { id: string; lines: Line[]; label?: string; variant?: "outline" | "dark"; className?: string }) => {
    const on = speaker.playingId === id;
    return (
      <Btn size="sm" variant={variant} className={className} onClick={() => speaker.play(id, lines.map((l) => ({ ...l, rate: l.rate ?? rate })))} disabled={!speaker.supported} title={speaker.supported ? undefined : "Speech is not available in this browser"}>
        {on ? <Square className="h-3 w-3 fill-current" /> : <Play className="h-3 w-3" />} {on ? "Stop" : label}
      </Btn>
    );
  };

  const setLive = (v: string) => {
    update({ liveVersion: v });
    log(`${v === state.liveVersion ? "Republished" : v < state.liveVersion ? "Rolled back to" : "Published"} prompt ${v}`, v);
    toast({ title: `${v} is live`, description: "New calls use it from now. Calls in progress finish on the old prompt." });
  };
  const savePersona = () => {
    update({ persona });
    log(`Persona updated: tone "${persona.tone}", hands off ${persona.handoff}`, "Persona");
    setModal(null);
    toast({ title: "Persona saved", description: "It is written into the prompt and ships with the next publish." });
  };
  const addWord = () => {
    const w: [string, string] = [word.written.trim(), word.spoken.trim()];
    if (!w[0] || !w[1]) return;
    update((s) => ({ dictionary: [...s.dictionary.filter(([x]) => x !== w[0]), w] }));
    log(`Dictionary: "${w[0]}" spoken as "${w[1]}"`, "Dict");
    setWord({ written: "", spoken: "" });
    setModal(null);
  };
  const removeWord = (w: string) => {
    update((s) => ({ dictionary: s.dictionary.filter(([x]) => x !== w) }));
    log(`Dictionary: removed "${w}"`, "Dict");
  };
  const pickVoice = (v: "aarti" | "marin") => {
    if (v === state.voice) return;
    update({ voice: v });
    log(`Voice changed to ${v === "aarti" ? "Aarti Indic, Azure Speech" : "marin, gpt-realtime"}`, "Voice");
    toast({ title: v === "aarti" ? "Aarti Indic selected" : "marin selected", description: "Applies to new calls only." });
  };

  return (
    <>
      <PageTitle crumb="Build / Agent studio / Club Mahindra member line" title="Shape how Meera sounds and speaks" actions={<><Btn onClick={() => navigate("/voice")}>Test in browser</Btn><Btn onClick={() => setModal("compare")}>Compare v7 with v6</Btn></>} />

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          <Panel className="p-4">
            <div className="flex items-center gap-3">
              <IconTile emoji="🎤" size={48} className="rounded-xl" />
              <div className="flex-1">
                <p className="text-lg font-semibold">Meera</p>
                <p className="text-[13px] text-zinc-500">Club Mahindra member concierge</p>
              </div>
              <Pill tone="green">Live as {state.liveVersion}</Pill>
              <Btn size="sm" onClick={() => { setPersona(state.persona); setModal("persona"); }}>Edit persona</Btn>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2">
              <Fact k="Tone" v={state.persona.tone} />
              <Fact k="Languages" v={<span className="flex gap-1"><Lang code="HI" /><Lang code="EN" /></span>} />
              <Fact k="Hands off to a human" v={state.persona.handoff} />
            </div>
          </Panel>

          <Panel>
            <PanelHeader title="Prompt versions" hint="QA delta is the scorecard change against the previous version" />
            <ul className="px-2 py-2">
              {VERSIONS.map((x) => {
                const live = x.v === state.liveVersion;
                return (
                  <li key={x.v} className={cn("flex items-center gap-3 rounded-lg px-2 py-2.5", live && "bg-[#FDF6F1]")}>
                    <span className="flex h-7 w-8 items-center justify-center rounded-md bg-violet-50 text-[11px] font-semibold text-violet-700">{x.v}</span>
                    <div className="flex-1">
                      <p className="flex items-center gap-2 text-sm font-medium">{x.title}{live && <Pill tone="green">Live</Pill>}</p>
                      <p className="text-xs text-zinc-500">{x.meta}</p>
                    </div>
                    <span className={cn("text-sm font-semibold", x.delta.startsWith("-") ? "text-red-600" : "text-emerald-600")}>{x.delta}</span>
                    <Btn size="sm" variant={live ? "outline" : x.v > state.liveVersion ? "primary" : "outline"} disabled={live} onClick={() => setLive(x.v)}>
                      {live ? "Live now" : x.v > state.liveVersion ? "Publish" : "Roll back"}
                    </Btn>
                  </li>
                );
              })}
            </ul>
          </Panel>

          <Panel>
            <PanelHeader title="Opening line" hint="First thing every caller hears" right={<span className="flex items-center gap-2"><Pill tone="amber">Required wording</Pill><PlayBtn id="opening" label="Play both" lines={[{ text: HI_LINE, lang: "HI" }, { text: EN_LINE, lang: "EN" }]} /></span>} />
            <div className="space-y-3 p-4">
              <OpeningLine lang="HI" text={HI_LINE} note="Shown to members who prefer Hindi. 22 seconds spoken." />
              <OpeningLine lang="EN" text={EN_LINE} note="Used when language detect returns English." />
            </div>
          </Panel>
        </div>

        <div className="space-y-4">
          <Panel>
            <PanelHeader title="Pronunciation dictionary" hint="Applied before speech is synthesised" right={<Btn size="sm" onClick={() => setModal("word")}>Add word</Btn>} />
            <table className="w-full">
              <thead className="bg-zinc-50"><tr><Th>Written as</Th><Th>Spoken as</Th><Th className="text-right">Preview</Th></tr></thead>
              <tbody>
                {state.dictionary.map(([w, s]) => (
                  <tr key={w} className="group border-t border-zinc-100">
                    <Td className="font-medium">{w}</Td>
                    <Td className="text-zinc-600">{s}</Td>
                    <Td className="text-right">
                      <span className="inline-flex items-center gap-1">
                        <PlayBtn id={`dict:${w}`} lines={[{ text: s.replace(/\(.*\)/, ""), lang: /^[A-Za-z ,]+$/.test(s) && /digit|zero|one|two/.test(s) ? "EN" : "HI", rate: 0.9 }]} />
                        <button onClick={() => removeWord(w)} aria-label={`Remove ${w}`} className="rounded-md p-1.5 text-zinc-300 hover:bg-zinc-100 hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></button>
                      </span>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>

          <Panel>
            <PanelHeader title="Voice" hint="Changes apply to new calls only" right={speaker.engine && <Pill tone={speaker.engine === "azure" ? "green" : "neutral"}>{speaker.engine === "azure" ? "Previewing with Azure" : "Previewing with browser voice"}</Pill>} />
            <div className="grid gap-3 p-4 sm:grid-cols-2">
              <VoiceCard emoji="🎤" name="Aarti Indic" vendor="Azure Speech" desc="en-IN-AartiIndicNeural. Natural Hindi and English switching." selected={state.voice === "aarti"} onSelect={() => pickVoice("aarti")} play={<PlayBtn id="voice:aarti" label="Play sample" variant={state.voice === "aarti" ? "dark" : "outline"} className="mt-3" lines={[{ text: SAMPLE, lang: "HI" }]} />} />
              <VoiceCard emoji="🧊" name="marin" vendor="gpt-realtime voice" desc="Speech to speech. Lower latency, less control over Hindi names." selected={state.voice === "marin"} onSelect={() => pickVoice("marin")} play={<PlayBtn id="voice:marin" label="Play sample" variant={state.voice === "marin" ? "dark" : "outline"} className="mt-3" lines={[{ text: SAMPLE, lang: "EN", rate: 1.1 }]} />} />
            </div>
            <div className="space-y-4 px-4 pb-4">
              <Slider label="Speed" min={0.8} max={1.3} step={0.05} value={state.speed} display={`${state.speed.toFixed(2)}x, ${state.speed < 0.95 ? "slow" : state.speed > 1.15 ? "brisk" : "steady"}`} onChange={(speed) => update({ speed })} onCommit={() => log(`Voice speed set to ${state.speed.toFixed(2)}x`, "Voice")} />
              <Slider label="Warmth" min={0} max={100} step={5} value={state.warmth} display={`${state.warmth}, ${state.warmth < 40 ? "neutral" : state.warmth > 80 ? "very warm" : "friendly"}`} onChange={(warmth) => update({ warmth })} onCommit={() => log(`Voice warmth set to ${state.warmth}`, "Voice")} />
            </div>
          </Panel>
        </div>
      </div>

      {modal === "persona" && (
        <Modal title="Edit persona" hint="These two lines are injected into the prompt. Required disclosure wording is not editable here." onClose={() => setModal(null)} footer={<ModalActions onCancel={() => setModal(null)} onOk={savePersona} okDisabled={!persona.tone.trim() || !persona.handoff.trim()} />}>
          <Field label="Tone"><input value={persona.tone} onChange={(e) => setPersona({ ...persona, tone: e.target.value })} className={inputClass} /></Field>
          <Field label="Hands off to a human for"><input value={persona.handoff} onChange={(e) => setPersona({ ...persona, handoff: e.target.value })} className={inputClass} /></Field>
        </Modal>
      )}
      {modal === "word" && (
        <Modal title="Add a word" hint="Write it the way it appears in the CRM, then how Meera should say it." onClose={() => setModal(null)} footer={<ModalActions onCancel={() => setModal(null)} onOk={addWord} okLabel="Add word" okDisabled={!word.written.trim() || !word.spoken.trim()} />}>
          <Field label="Written as"><input value={word.written} onChange={(e) => setWord({ ...word, written: e.target.value })} className={inputClass} placeholder="Varca Beach" /></Field>
          <Field label="Spoken as"><input value={word.spoken} onChange={(e) => setWord({ ...word, spoken: e.target.value })} className={inputClass} placeholder="VAR-ka beach" /></Field>
        </Modal>
      )}
      {modal === "compare" && (
        <Modal title="v7 compared with v6" hint="Same 7 days, Club Mahindra desk, auto scored calls." onClose={() => setModal(null)} footer={<Btn size="sm" onClick={() => setModal(null)}>Close</Btn>}>
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs text-zinc-500"><th className="py-1">Measure</th><th className="py-1 text-right">v6</th><th className="py-1 text-right">v7</th></tr></thead>
            <tbody>{COMPARE.map(([k, a, b]) => <tr key={k} className="border-t border-zinc-100"><td className="py-2">{k}</td><td className="py-2 text-right text-zinc-500">{a}</td><td className="py-2 text-right font-semibold">{b}</td></tr>)}</tbody>
          </table>
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

function OpeningLine({ lang, text, note }: { lang: "HI" | "EN"; text: string; note: string }) {
  return (
    <div className="rounded-lg bg-zinc-50 p-3">
      <p className="text-sm leading-relaxed">{text}</p>
      <p className="mt-2 flex items-center gap-2 text-xs text-zinc-500"><Lang code={lang} />{note}</p>
    </div>
  );
}

function VoiceCard({ emoji, name, vendor, desc, selected, onSelect, play }: { emoji: string; name: string; vendor: string; desc: string; selected: boolean; onSelect: () => void; play: React.ReactNode }) {
  return (
    <div className={cn("rounded-xl border p-4", selected ? "border-[#E2703A] bg-[#FDF6F1]" : "border-zinc-200")}>
      <div className="flex items-center gap-3">
        <IconTile emoji={emoji} />
        <div className="flex-1">
          <p className="text-sm font-semibold">{name}</p>
          <p className="text-xs text-zinc-500">{vendor}</p>
        </div>
        {selected ? <Pill tone="orange">Selected</Pill> : <button onClick={onSelect} className="text-xs font-medium text-[#E2703A]">Use this voice</button>}
      </div>
      <p className="mt-3 text-xs text-zinc-600">{desc}</p>
      {play}
    </div>
  );
}

function Slider({ label, min, max, step, value, display, onChange, onCommit }: { label: string; min: number; max: number; step: number; value: number; display: string; onChange: (v: number) => void; onCommit: () => void }) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <label className="flex items-center gap-4 text-sm">
      <span className="w-16 text-zinc-600">{label}</span>
      <span className="relative h-4 flex-1">
        <span className="absolute top-1/2 h-1 w-full -translate-y-1/2 rounded-full bg-zinc-200" />
        <span className="absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-[#E2703A]" style={{ width: `${pct}%` }} />
        <span className="pointer-events-none absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[#E2703A] bg-white" style={{ left: `${pct}%` }} />
        <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} onMouseUp={onCommit} onTouchEnd={onCommit} onKeyUp={onCommit} aria-label={label} className="absolute inset-0 w-full cursor-pointer opacity-0" />
      </span>
      <span className="w-28 text-right font-medium">{display}</span>
    </label>
  );
}
