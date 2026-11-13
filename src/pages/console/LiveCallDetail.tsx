import { useParams } from "react-router-dom";
import { Avatar, Btn, Dot, Langs, Panel, PanelHeader, Pill } from "@/console/ui";
import { CALL_4821_TOOLS, CALL_4821_TRANSCRIPT, LIVE_CALLS } from "@/console/data/calls";
import { cn } from "@/lib/utils";

export default function LiveCallDetail() {
  const { id } = useParams();
  // shortcut: only call 4821 has a scripted transcript; other ids reuse it with the right header. Upgrade when calls come from the API.
  const call = LIVE_CALLS.find((c) => c.id === Number(id)) ?? LIVE_CALLS[2];
  const first = call.name.split(" ")[0];

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Avatar name={call.name} size={40} />
          <div>
            <h1 className="text-2xl font-semibold tracking-[-0.02em]">{call.name}, {call.tier} member</h1>
            <p className="text-[13px] text-zinc-500">Call {call.id}, inbound on Exotel, Club Mahindra member line. {call.lang === "prefers Hindi" ? "Prefers Hindi." : `Speaks ${call.lang}.`}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Pill tone="green">Live {call.elapsed}</Pill>
          <Pill>HI {call.hi}, EN {100 - call.hi}</Pill>
          <Pill tone={call.sentiment === "Frustrated" ? "red" : call.sentiment === "Positive" ? "green" : "neutral"}>{call.sentiment}</Pill>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <Panel className="min-h-[520px]">
          <PanelHeader title="Live transcript" hint="Streaming, language tagged per sentence" right={<Langs codes={["HI", "EN"]} />} />
          <ol className="px-4 py-2">
            {CALL_4821_TRANSCRIPT.map((turn, i) => (
              <li key={i} className={cn("grid grid-cols-[48px_1fr] gap-3 py-3", turn.live && "-mx-2 rounded-lg bg-zinc-50 px-2")}>
                <span className="pt-0.5 text-xs tabular-nums text-zinc-400">{turn.t}</span>
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-zinc-700">{turn.who === "Priya" ? first : turn.who}</span>
                    {turn.langs.length > 0 && <Langs codes={turn.langs} />}
                  </div>
                  <p className="mt-0.5 text-sm leading-relaxed text-zinc-800">
                    {turn.text}
                    {turn.live && <span className="ml-0.5 inline-block h-4 w-px animate-pulse bg-[#E2703A] align-middle" />}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </Panel>

        <div className="space-y-4">
          <Panel className="p-4">
            <h3 className="text-[15px] font-semibold">Your controls</h3>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Btn>Whisper</Btn>
              <Btn>Barge in</Btn>
            </div>
            <Btn variant="primary" className="mt-2 w-full">Take over this call</Btn>
            <p className="mt-3 text-xs text-zinc-500">Listening silently. {first} cannot hear you until you barge in.</p>
          </Panel>

          <Panel>
            <PanelHeader title="Tool trace" />
            <ul className="px-4 py-2">
              {CALL_4821_TOOLS.map((t) => (
                <li key={t.name} className="flex gap-2.5 py-2.5">
                  <span className="pt-1.5"><Dot tone={t.state === "done" ? "green" : t.state === "running" ? "orange" : "grey"} /></span>
                  <div>
                    <p className={cn("text-sm font-medium", t.state === "queued" && "text-zinc-400")}>{t.name}</p>
                    <p className="text-xs text-zinc-500">{t.detail}</p>
                  </div>
                </li>
              ))}
            </ul>
          </Panel>

          <div className="rounded-xl bg-zinc-100 p-4">
            <p className="text-sm font-semibold">Meera's next step</p>
            <p className="mt-1 text-[13px] leading-relaxed text-zinc-600">
              Confirm the hold, read back dates, offer a callback if {first}'s husband needs to confirm. No policy gate on this request.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
