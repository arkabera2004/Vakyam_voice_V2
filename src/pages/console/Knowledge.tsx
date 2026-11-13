import { useState } from "react";
import { Btn, IconTile, PageTitle, Panel, PanelHeader, Pill, Td, Th, Toggle } from "@/console/ui";
import { useConsole, nowLabel, SUPERVISOR } from "@/console/store";
import { Modal, Field, inputClass, ModalActions } from "@/console/Modal";
import { answerPolicy, type PolicyAnswer } from "@/console/data/policy";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const GATES = [
  { name: "Upgrade room type", sub: "Studio to 1BR or 2BR, any resort", approver: "Asha Nair queue", sla: "SLA 5 min", n: 41 },
  { name: "Refund above 25,000 rupees", sub: "Any cancellation refund over the limit", approver: "Asha Nair queue", sla: "SLA 5 min", n: 27 },
  { name: "Waive cancellation fee", sub: "Full or partial waiver", approver: "Asha Nair queue", sla: "SLA 10 min", n: 33 },
  { name: "Hold extension beyond 24 h", sub: "place_hold past the standard window", approver: "Asha Nair queue", sla: "SLA 15 min", n: 19 },
  { name: "Reschedule inside 48 h", sub: "One change per booking, same resort", approver: "Asha Nair queue", sla: "Limit 1 change", n: 112 },
];

const HINGLISH = "Mujhe 38,400 ka refund chahiye, booking Kumbhalgarh ki thi";
const ENGLISH = "Can I move my Goa booking to next weekend?";

export default function Knowledge() {
  const { state, update, log } = useConsole();
  const [question, setQuestion] = useState(ENGLISH);
  const [answer, setAnswer] = useState<PolicyAnswer>(() => answerPolicy(ENGLISH, state.gates));
  const [modal, setModal] = useState<null | "source" | "history">(null);
  const [src, setSrc] = useState({ name: "", owner: SUPERVISOR, articles: "20" });

  const toggleGate = (name: string) => {
    const on = !state.gates[name];
    update((s) => ({ gates: { ...s.gates, [name]: on }, knowledgeDirty: true }));
    log(`Policy gate "${name}" turned ${on ? "on, needs human" : "off, Meera may"}`, "Draft");
    setAnswer(answerPolicy(question, { ...state.gates, [name]: on }));
  };

  const runTest = (q = question) => {
    setQuestion(q);
    setAnswer(answerPolicy(q, state.gates));
  };

  const publish = () => {
    const stamp = `${nowLabel()} · ${Object.values(state.gates).filter(Boolean).length} gates on, ${state.sources.length} sources · ${SUPERVISOR}`;
    update((s) => ({ knowledgeDirty: false, knowledgeVersions: [stamp, ...s.knowledgeVersions] }));
    log("Knowledge and policy changes published to Meera v7", "KB");
    toast({ title: "Published", description: "Meera reads the new gates and sources from her next call." });
  };

  const addSource = () => {
    const name = src.name.trim();
    if (!name) return;
    update((s) => ({ sources: [...s.sources, { emoji: "📄", name, sub: `${src.articles || 0} articles, added ${nowLabel().split(",")[0]}, owner ${src.owner}`, live: false }], knowledgeDirty: true }));
    log(`Knowledge source "${name}" added, pending review`, "Draft");
    setModal(null);
    setSrc({ name: "", owner: SUPERVISOR, articles: "20" });
    toast({ title: `${name} added`, description: "It is indexed now and goes live with the next publish." });
  };

  const markReviewed = (name: string) => {
    update((s) => ({ sources: s.sources.map((x) => (x.name === name ? { ...x, live: true, sub: x.sub.replace(/updated [^,]+/, `updated ${nowLabel().split(",")[0]}`) } : x)), knowledgeDirty: true }));
    log(`Knowledge source "${name}" reviewed`, "Draft");
  };

  return (
    <>
      <PageTitle
        crumb="Build, Club Mahindra member line, Meera v7"
        title="Knowledge and policies"
        actions={
          <>
            <Btn onClick={() => setModal("history")}>Version history</Btn>
            <Btn variant="primary" onClick={publish} disabled={!state.knowledgeDirty} title={state.knowledgeDirty ? undefined : "Nothing changed since the last publish"}>{state.knowledgeDirty ? "Publish changes" : "Published"}</Btn>
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[380px_1fr]">
        <div className="space-y-4">
          <Panel>
            <PanelHeader title="Knowledge sources" right={<button onClick={() => setModal("source")} className="text-xs font-medium text-[#E2703A]">Add source</button>} />
            <ul className="divide-y divide-zinc-100">
              {state.sources.map((s) => (
                <li key={s.name} className="flex items-center gap-3 px-4 py-3">
                  <IconTile emoji={s.emoji} />
                  <div className="flex-1"><p className="text-sm font-medium">{s.name}</p><p className="text-xs text-zinc-500">{s.sub}</p></div>
                  {s.live ? <Pill tone="green">Live</Pill> : <button onClick={() => markReviewed(s.name)} title="Mark as reviewed"><Pill tone="amber">Review due</Pill></button>}
                </li>
              ))}
            </ul>
          </Panel>

          <Panel className="p-4">
            <div className="flex items-center gap-3">
              <IconTile emoji="🔒" />
              <div className="flex-1"><p className="text-sm font-medium">Resort inventory, live lookup</p><p className="text-xs text-zinc-500">10 resorts via check_availability, read only</p></div>
              <Pill tone="blue">Synced 14:08</Pill>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2">
              {[["Studio", "212 free"], ["1BR", "164 free"], ["2BR", "79 free"]].map(([k, v]) => (
                <div key={k} className="rounded-lg bg-zinc-50 p-3"><p className="text-xs text-zinc-500">{k}</p><p className="text-lg font-semibold">{v}</p></div>
              ))}
            </div>
            <p className="mt-3 text-xs text-zinc-500">Lonavala, Goa, Kumbhalgarh, Mussoorie and 6 more. Meera never quotes from memory, every answer comes from the live lookup.</p>
          </Panel>
        </div>

        <Panel className="overflow-x-auto">
          <PanelHeader title="Policy approval gates" right={<span className="text-xs text-zinc-500">Counts are for the last 7 days</span>} />
          <table className="w-full min-w-[620px]">
            <thead className="bg-zinc-50"><tr><Th>On</Th><Th>Policy</Th><Th>Meera</Th><Th>Approver and SLA</Th><Th className="text-right">Triggered</Th></tr></thead>
            <tbody>
              {GATES.map((g) => {
                const on = !!state.gates[g.name];
                return (
                  <tr key={g.name} className="border-t border-zinc-100">
                    <Td className="py-5"><button onClick={() => toggleGate(g.name)} aria-label={`Toggle ${g.name}`}><Toggle on={on} label={g.name} /></button></Td>
                    <Td><p className="font-medium">{g.name}</p><p className="text-xs text-zinc-500">{g.sub}</p></Td>
                    <Td><Pill tone={on ? "red" : "green"}>{on ? "Needs human" : "Meera may"}</Pill></Td>
                    <Td><p>{on ? g.approver : "No approver"}</p><p className="text-xs text-zinc-500">{g.sla}</p></Td>
                    <Td className="text-right text-base font-semibold">{g.n}</Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Panel>
      </div>

      <Panel className="mt-4 grid gap-4 p-4 lg:grid-cols-[1fr_1.5fr]">
        <div>
          <p className="text-sm font-semibold">Ask Meera a policy question</p>
          <form className="mt-3" onSubmit={(e) => { e.preventDefault(); runTest(); }}>
            <input value={question} onChange={(e) => setQuestion(e.target.value)} className={inputClass} aria-label="Policy question" />
            <div className="mt-3 flex gap-2"><Btn variant="dark" size="sm" type="submit">Run test</Btn><Btn size="sm" onClick={() => runTest(question === HINGLISH ? ENGLISH : HINGLISH)}>{question === HINGLISH ? "Use an English question" : "Use a Hinglish question"}</Btn></div>
          </form>
          <p className="mt-2 text-xs text-zinc-500">Answers use the gates as they are right now, published or not.</p>
        </div>
        <div className={cn("rounded-lg p-4", answer.verdict === "Allowed, no handoff" ? "bg-[#FDF6F1]" : answer.verdict === "Needs a human" ? "bg-amber-50" : "bg-zinc-100")}>
          <p className="flex items-center gap-2 text-sm"><span className="font-semibold text-[#E2703A]">Meera would say</span><Pill tone={answer.verdict === "Allowed, no handoff" ? "green" : answer.verdict === "Needs a human" ? "amber" : "neutral"}>{answer.verdict}</Pill></p>
          <p className="mt-2 text-sm">{answer.say}</p>
          <p className="mt-3 flex flex-wrap items-center gap-2 text-xs text-zinc-500">Cited source <Pill>{answer.source}</Pill>{answer.gate && <Pill tone={state.gates[answer.gate] ? "red" : "green"}>Gate: {answer.gate}</Pill>}</p>
        </div>
      </Panel>

      {modal === "source" && (
        <Modal title="Add a knowledge source" hint="Articles are chunked and indexed. Meera cites the article in every answer that uses it." onClose={() => setModal(null)} footer={<ModalActions onCancel={() => setModal(null)} onOk={addSource} okLabel="Add source" okDisabled={!src.name.trim()} />}>
          <Field label="Name"><input value={src.name} onChange={(e) => setSrc({ ...src, name: e.target.value })} className={inputClass} placeholder="Festival blackout dates" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Owner"><select value={src.owner} onChange={(e) => setSrc({ ...src, owner: e.target.value })} className={inputClass}><option>Kavita Rao</option><option>Asha Nair</option></select></Field>
            <Field label="Articles"><input type="number" min={1} value={src.articles} onChange={(e) => setSrc({ ...src, articles: e.target.value })} className={inputClass} /></Field>
          </div>
        </Modal>
      )}
      {modal === "history" && (
        <Modal title="Version history" hint="Every publish of gates and sources. Roll back by republishing after changing the gates." onClose={() => setModal(null)} footer={<Btn size="sm" onClick={() => setModal(null)}>Close</Btn>}>
          <ul className="divide-y divide-zinc-100">
            {state.knowledgeDirty && <li className="py-2 text-amber-700">Unpublished draft · {Object.values(state.gates).filter(Boolean).length} gates on, {state.sources.length} sources</li>}
            {state.knowledgeVersions.map((v, i) => <li key={i} className={cn("py-2", i === 0 && !state.knowledgeDirty && "font-medium")}>{v}{i === 0 && <Pill tone="green" className="ml-2">Live</Pill>}</li>)}
          </ul>
        </Modal>
      )}
    </>
  );
}
