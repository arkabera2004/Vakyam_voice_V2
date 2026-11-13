import { Play } from "lucide-react";
import { Avatar, Btn, Dot, Langs, Panel, PanelHeader, Pill } from "@/console/ui";
import { cn } from "@/lib/utils";

type Turn = { t: string; who: string; text: string; langs: ("HI" | "EN")[]; tool?: { name: string; detail: string } };

const TRANSCRIPT: Turn[] = [
  { t: "00:04", who: "Meera", langs: ["HI"], text: "Namaste, Club Mahindra se Meera bol rahi hoon, ek AI sahayak. Yeh call record ho sakti hai. Aap theek hain?" },
  { t: "00:17", who: "Anita", langs: ["EN", "HI"], text: "Yes, that is fine. Mujhe apni Goa booking Mussoorie mein shift karni hai.", tool: { name: "lookup_caller", detail: "Member 27613, Gold, English and Hindi. 187 ms" } },
  { t: "00:41", who: "Meera", langs: ["EN"], text: "Of course, Anita ji. Which dates, and should I look for a 2BR again?" },
  { t: "01:08", who: "Anita", langs: ["EN"], text: "20 to 23 December, 2BR please.", tool: { name: "check_availability", detail: "Mussoorie, 2BR, 20 to 23 Dec. 2 options. 611 ms" } },
  { t: "02:02", who: "Meera", langs: ["HI", "EN"], text: "Main Mussoorie 2BR ko 24 ghante ke liye hold kar doon? Koi payment abhi nahi lagegi." },
  { t: "02:14", who: "Anita", langs: ["EN"], text: "Yes please, go ahead.", tool: { name: "place_hold", detail: "Mussoorie 2BR, expires in 24 h, no payment taken. 433 ms" } },
];

const RUBRIC = [
  { name: "Disclosure given", detail: "AI and recording stated at 00:04", score: 100 },
  { name: "Consent captured", detail: "Explicit yes before place_hold", score: 100 },
  { name: "Intent understood", detail: "Change request, not new booking", score: 94 },
  { name: "Correct tool use", detail: "Right order, no retries needed", score: 96 },
  { name: "Policy followed", detail: "No upgrade or refund promised", score: 100 },
  { name: "Tone", detail: "Warm, a little rushed at 02:02", score: 84 },
  { name: "Language match", detail: "Replied in Hindi to an English turn", score: 70 },
];

// deterministic waveform so the recording strip looks the same on every render
const WAVE = Array.from({ length: 110 }, (_, i) => 6 + Math.abs(Math.sin(i * 0.7) * 14 + Math.cos(i * 1.9) * 8));

export default function CallReview() {
  return (
    <>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Avatar name="Anita Iyer" size={40} />
          <div>
            <h1 className="text-2xl font-semibold tracking-[-0.02em]">Call 4790, Anita Iyer, Gold member</h1>
            <p className="text-[13px] text-zinc-500">Inbound on Exotel, Club Mahindra member line, yesterday 16:12, 6:44 long. Meera v7</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Pill tone="green">Resolved by Meera</Pill>
          <Pill>HI 38, EN 62</Pill>
          <Btn size="sm">Share</Btn>
          <Btn size="sm">Flag for coaching</Btn>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <div className="space-y-4">
          <Panel className="p-4">
            <div className="flex items-center gap-3">
              <button className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-900 text-white" aria-label="Play"><Play className="h-3.5 w-3.5 fill-current" /></button>
              <span className="text-sm font-semibold">Recording</span>
              <span className="text-xs text-zinc-500">03:36 / 06:44, 1x</span>
              <span className="ml-auto flex items-center gap-3 text-xs text-zinc-600">
                <span className="flex items-center gap-1"><Dot tone="grey" /><span className="-ml-2 h-2 w-2 rounded-full bg-zinc-900" /> Meera</span>
                <span className="flex items-center gap-1"><Dot tone="orange" /> Anita</span>
              </span>
            </div>
            <div className="relative mt-4 flex h-14 items-center gap-[2px]">
              {WAVE.map((h, i) => (
                <span key={i} className="flex-1 rounded-sm" style={{ height: h * 2, background: i % 3 === 1 ? "#E2703A" : "#18181b" }} />
              ))}
              <span className="absolute left-[53%] top-0 h-full w-px bg-[#E2703A]" />
            </div>
            <div className="mt-2 flex justify-between text-[11px] text-zinc-500"><span>00:00</span><span>01:30</span><span>03:00</span><span>04:30</span><span>06:44</span></div>
          </Panel>

          <Panel>
            <PanelHeader title="Transcript" hint="Language tagged per sentence, tool calls inline" right={<Langs codes={["HI", "EN"]} />} />
            <ol className="px-4 py-2">
              {TRANSCRIPT.map((turn) => (
                <li key={turn.t} className="py-2.5">
                  <div className="grid grid-cols-[48px_1fr] gap-3">
                    <span className="text-xs tabular-nums text-zinc-400">{turn.t}</span>
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-zinc-700">{turn.who}</span>
                        <Langs codes={turn.langs} />
                      </div>
                      <p className="mt-0.5 text-sm text-zinc-800">{turn.text}</p>
                    </div>
                  </div>
                  {turn.tool && (
                    <div className="ml-[60px] mt-2 flex items-center gap-2 rounded-md bg-zinc-50 px-3 py-1.5 text-xs">
                      <Dot tone="green" />
                      <span className="font-semibold text-zinc-800">{turn.tool.name}</span>
                      <span className="text-zinc-500">{turn.tool.detail}</span>
                    </div>
                  )}
                </li>
              ))}
            </ol>
          </Panel>
        </div>

        <div className="space-y-4">
          <Panel className="p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-[15px] font-semibold">Disposition</h3>
              <Pill tone="green">Resolved by Meera</Pill>
            </div>
            <p className="mt-3 text-xs text-zinc-500">Reason</p>
            <p className="text-sm">Booking change request met. Mussoorie 2BR held for 20 to 23 Dec, no policy gate, no human needed.</p>
            <p className="mt-3 text-xs text-zinc-500">Callback task</p>
            <div className="mt-1 flex items-center justify-between rounded-lg bg-zinc-50 p-3">
              <div>
                <p className="text-sm font-medium">Send payment link and confirm hold</p>
                <p className="text-xs text-zinc-500">Tomorrow 11:00, assigned to Asha Nair</p>
              </div>
              <span className="text-xs font-medium text-[#E2703A]">Open</span>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <Pill>log_call written</Pill>
              <Pill>No handoff</Pill>
              <Pill>CSAT 5</Pill>
            </div>
          </Panel>

          <Panel>
            <div className="flex items-center gap-4 px-4 py-4">
              <span className="text-[44px] font-semibold leading-none tracking-[-0.03em]">92</span>
              <div className="flex-1">
                <p className="text-sm font-semibold">QA score, auto scored</p>
                <p className="text-xs text-zinc-500">Rubric v4. 6 pass, 1 flag. Fleet average 91.4</p>
              </div>
              <Pill tone="green">Pass</Pill>
            </div>
            <ul className="divide-y divide-zinc-100 border-t border-zinc-100 px-4">
              {RUBRIC.map((r) => (
                <li key={r.name} className="flex items-center justify-between py-2.5">
                  <div>
                    <p className="text-sm font-medium">{r.name}</p>
                    <p className="text-xs text-zinc-500">{r.detail}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={cn("text-sm font-semibold", r.score < 75 && "text-red-600")}>{r.score}</span>
                    <Pill tone={r.score < 75 ? "red" : "green"}>{r.score < 75 ? "Flag" : "Pass"}</Pill>
                  </div>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </div>
    </>
  );
}
