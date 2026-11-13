import { useNavigate, useParams } from "react-router-dom";
import { Avatar, Btn, Dot, Langs, Panel, PanelHeader, Pill } from "@/console/ui";
import { LIVE_CALLS } from "@/console/data/calls";
import { transcriptFor } from "@/console/data/transcripts";
import { useConsole } from "@/console/store";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

export default function LiveCallDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { state, update, log } = useConsole();
  const call = LIVE_CALLS.find((c) => c.id === Number(id));
  if (!call) {
    return (
      <Panel className="p-8 text-center text-sm text-zinc-500">
        Call {id} is not live any more. <button className="font-medium text-[#E2703A]" onClick={() => navigate("/console/live")}>Back to the live wall</button>
      </Panel>
    );
  }
  const first = call.name.split(" ")[0];
  const { turns, tools, next } = transcriptFor(call);
  const mine = state.calls[call.id] ?? {};

  const setCall = (patch: typeof mine) => update((s) => ({ calls: { ...s.calls, [call.id]: { ...s.calls[call.id], ...patch } } }));
  const whisper = () => {
    setCall({ whisper: !mine.whisper, barge: false });
    toast({ title: mine.whisper ? "Whisper off" : "Whispering to Meera", description: mine.whisper ? "Meera is back to her own script." : `Only Meera hears you. ${first} hears nothing.` });
  };
  const barge = () => {
    setCall({ barge: !mine.barge, whisper: false });
    toast({ title: mine.barge ? "Left the call" : "You are on the call", description: mine.barge ? "Meera continues alone." : `${first} and Meera both hear you now.` });
  };
  const takeOver = () => {
    setCall({ takenOver: !mine.takenOver, whisper: false, barge: false });
    log(`${mine.takenOver ? "Returned" : "Took over"} call ${call.id}, ${call.name}`, "Live");
    toast({ title: mine.takenOver ? "Call returned to Meera" : "Call is yours", description: mine.takenOver ? "Meera picks up with the transcript so far." : "Meera has stopped speaking and is writing the handoff summary." });
  };

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
          {mine.takenOver ? <Pill tone="orange">With you, {call.elapsed}</Pill> : <Pill tone="green">Live {call.elapsed}</Pill>}
          <Pill>HI {call.hi}, EN {100 - call.hi}</Pill>
          <Pill tone={call.sentiment === "Frustrated" ? "red" : call.sentiment === "Positive" ? "green" : "neutral"}>{call.sentiment}</Pill>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <Panel className="min-h-[520px]">
          <PanelHeader title="Live transcript" hint="Streaming, language tagged per sentence" right={<Langs codes={["HI", "EN"]} />} />
          <ol className="px-4 py-2">
            {turns.map((turn, i) => (
              <li key={i} className={cn("grid grid-cols-[48px_1fr] gap-3 py-3", turn.live && "-mx-2 rounded-lg bg-zinc-50 px-2")}>
                <span className="pt-0.5 text-xs tabular-nums text-zinc-400">{turn.t}</span>
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-zinc-700">{turn.live && mine.takenOver ? "You are speaking" : turn.who}</span>
                    {turn.langs.length > 0 && <Langs codes={turn.langs} />}
                  </div>
                  <p className="mt-0.5 text-sm leading-relaxed text-zinc-800">
                    {turn.live && mine.takenOver ? "Meera has handed the line to you." : turn.text}
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
              <Btn variant={mine.whisper ? "dark" : "outline"} onClick={whisper} disabled={mine.takenOver} aria-pressed={!!mine.whisper}>{mine.whisper ? "Stop whisper" : "Whisper"}</Btn>
              <Btn variant={mine.barge ? "dark" : "outline"} onClick={barge} disabled={mine.takenOver} aria-pressed={!!mine.barge}>{mine.barge ? "Leave call" : "Barge in"}</Btn>
            </div>
            <Btn variant="primary" className="mt-2 w-full" onClick={takeOver}>{mine.takenOver ? "Hand back to Meera" : "Take over this call"}</Btn>
            <p className="mt-3 text-xs text-zinc-500">
              {mine.takenOver ? `You are speaking with ${first}. Meera is silent and listening.` : mine.barge ? `You and Meera are both on the line with ${first}.` : mine.whisper ? `Meera hears your coaching. ${first} does not.` : `Listening silently. ${first} cannot hear you until you barge in.`}
            </p>
          </Panel>

          <Panel>
            <PanelHeader title="Tool trace" />
            <ul className="px-4 py-2">
              {tools.map((t) => (
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
            <p className="text-sm font-semibold">{mine.takenOver ? "Where Meera left off" : "Meera's next step"}</p>
            <p className="mt-1 text-[13px] leading-relaxed text-zinc-600">{next}</p>
          </div>
        </div>
      </div>
    </>
  );
}
