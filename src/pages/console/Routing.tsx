import { useState } from "react";
import { Bar, Btn, IconTile, Lang, PageTitle, Panel, PanelHeader, Pill, Td, Th, type Tone } from "@/console/ui";
import { useConsole, type Campaign } from "@/console/store";
import { Modal, Field, inputClass, ModalActions } from "@/console/Modal";
import { routeCall, type SimInput } from "@/console/data/routing";
import { toast } from "@/hooks/use-toast";

const RULES = [
  { title: "VIP Platinum goes to Meera first", body: "Platinum members skip the queue and reach Meera with the concierge prompt, such as Rohan Mehta.", tag: "Priority 1", tone: "purple" as Tone },
  { title: "Language detect, Hindi or English", body: "Meera listens for the first 6 seconds, then opens in the language the caller used and follows any switch.", langs: true },
  { title: "After hours, 21:00 to 08:00", body: "Route to Meera, then create a callback task for the morning desk when she cannot finish the request.", tag: "Callback task at 08:30", tone: "neutral" as Tone },
  { title: "Overflow to the human queue", body: "When the wait is over 20 seconds, send the call to the human queue with a summary attached.", tag: "Wait over 20 seconds", tone: "amber" as Tone },
  { title: "Transfer rules", body: "Refunds over ₹25,000 and upgrades always go to a human, such as Asha Nair, with a warm transfer.", tag: "Needs a human", tone: "red" as Tone },
];

const STATUS_TONE: Record<Campaign["status"], Tone> = { Running: "green", Scheduled: "purple", Completed: "neutral", Paused: "amber" };

export default function Routing() {
  const { state, update, log } = useConsole();
  const [sim, setSim] = useState<SimInput | null>(null);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ name: "", total: "500", series: "160 service", start: "tomorrow 09:00" });
  const result = sim && routeCall(sim);

  const toggle = (c: Campaign) => {
    if (c.status === "Completed") return;
    const status: Campaign["status"] = c.status === "Running" ? "Paused" : c.status === "Paused" ? "Running" : "Running";
    update((s) => ({ campaigns: s.campaigns.map((x) => (x.name === c.name ? { ...x, status, sub: status === "Running" && c.status === "Scheduled" ? "Started early by Kavita Rao" : x.sub } : x)) }));
    log(`Campaign "${c.name}" ${status.toLowerCase()}`, "Campaign");
    toast({ title: `${c.name}: ${status.toLowerCase()}`, description: status === "Paused" ? "Calls already connected finish. No new dials." : "Dialing resumes inside the 09:00 to 21:00 window." });
  };

  const addCampaign = () => {
    const name = draft.name.trim();
    const total = Number(draft.total);
    if (!name || !total) return;
    const promo = draft.series.startsWith("140");
    update((s) => ({ campaigns: [...s.campaigns, { emoji: promo ? "🎁" : "📣", name, sub: `${promo ? "Promotional" : "Service"}, starts ${draft.start}`, dialed: 0, total, connected: 0, dlt: promo ? "CLBMHP" : "CLBMHN", series: draft.series, status: "Scheduled" }] }));
    log(`Campaign "${name}" scheduled, ${total} contacts, ${draft.series}`, "Campaign");
    setAdding(false);
    setDraft({ name: "", total: "500", series: "160 service", start: "tomorrow 09:00" });
    toast({ title: `${name} scheduled`, description: promo ? "Promotional series: only contacts with recorded consent are dialed." : "Service series, no consent gate needed." });
  };

  return (
    <>
      <PageTitle crumb="Build / Routing and campaigns" title="Who Meera answers, and who she calls" actions={<><Btn onClick={() => setSim({ tier: "Gold", hour: 14, lang: "Hindi", queueWait: 5, intent: "Booking or hold" })}>Simulate a call</Btn><Btn variant="primary" onClick={() => setAdding(true)}>New campaign</Btn></>} />

      <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
        <Panel>
          <PanelHeader title="Inbound rules" hint="Checked top to bottom, the first match wins" stack />
          <ol className="divide-y divide-zinc-100">
            {RULES.map((r, i) => (
              <li key={r.title} className={`flex gap-3 p-4 ${result?.rule === i + 1 ? "bg-[#FDF6F1]" : ""}`}>
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-[11px] font-semibold text-white">{i + 1}</span>
                <div>
                  <p className="text-sm font-semibold">{r.title}</p>
                  <p className="mt-0.5 text-[13px] text-zinc-600">{r.body}</p>
                  <div className="mt-2">{r.langs ? <span className="flex gap-1"><Lang code="HI" /><Lang code="EN" /></span> : <Pill tone={r.tone}>{r.tag}</Pill>}</div>
                </div>
              </li>
            ))}
          </ol>
        </Panel>

        <div className="space-y-4">
          <Panel className="overflow-x-auto">
            <PanelHeader title="Outbound campaign queue" hint="Dialed through Twilio Media Streams" />
            <table className="w-full min-w-[640px]">
              <thead className="bg-zinc-50"><tr><Th>Campaign</Th><Th>Contacts dialed and connected</Th><Th>DLT sender and series</Th><Th>Status</Th><Th /></tr></thead>
              <tbody>
                {state.campaigns.map((c) => (
                  <tr key={c.name} className="border-t border-zinc-100">
                    <Td>
                      <div className="flex items-center gap-3">
                        <IconTile emoji={c.emoji} />
                        <div><p className="font-medium">{c.name}</p><p className="text-xs text-zinc-500">{c.sub}</p></div>
                      </div>
                    </Td>
                    <Td>
                      <div className="flex justify-between text-xs"><span>{c.dialed.toLocaleString("en-IN")} of {c.total.toLocaleString("en-IN")}</span><span className="font-medium text-emerald-600">{c.connected.toLocaleString("en-IN")} connected</span></div>
                      <Bar value={(c.dialed / c.total) * 100} className="mt-1.5" />
                    </Td>
                    <Td><p className="font-medium">{c.dlt}</p><p className="text-xs text-zinc-500">{c.series}</p></Td>
                    <Td><Pill tone={STATUS_TONE[c.status]}>{c.status}</Pill></Td>
                    <Td className="text-right">
                      {c.status !== "Completed" && <Btn size="sm" onClick={() => toggle(c)}>{c.status === "Running" ? "Pause" : c.status === "Paused" ? "Resume" : "Start now"}</Btn>}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>

          <div className="grid gap-4 md:grid-cols-[1.4fr_1fr]">
            <Panel>
              <PanelHeader title="Calling window" hint="India Standard Time, now 14:10" />
              <div className="p-4">
                <div className="flex justify-between text-[11px] text-zinc-500"><span>00:00</span><span>06:00</span><span>12:00</span><span>18:00</span><span>24:00</span></div>
                <div className="relative mt-2 h-24 rounded-lg bg-zinc-50">
                  <div className="absolute left-[37.5%] top-3 flex h-10 w-[50%] items-center justify-end rounded-md bg-[#E2703A] pr-3 text-xs font-semibold text-white">09:00 to 21:00</div>
                  <div className="absolute left-0 bottom-3 flex h-10 w-[33%] items-center rounded-md bg-zinc-900 px-3 text-xs font-medium text-white">Meera after hours</div>
                  <div className="absolute right-0 bottom-3 h-10 w-[12%] rounded-md bg-zinc-900" />
                  <div className="absolute left-[59%] top-0 h-full w-px bg-emerald-600" title="now 14:10" />
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-lg bg-zinc-50 p-3"><p className="font-semibold">Series 160, service</p><p className="text-zinc-500">Renewals, stay feedback</p></div>
                  <div className="rounded-lg bg-zinc-50 p-3"><p className="font-semibold">Series 140, promotional</p><p className="text-zinc-500">Offers, consent checked</p></div>
                </div>
                <p className="mt-3 text-xs text-zinc-500">Dialing pauses at 21:00. Calls already connected are allowed to finish.</p>
              </div>
            </Panel>

            <Panel>
              <PanelHeader title="Retry rules" />
              <div className="p-4">
                <div className="flex justify-around text-center text-xs text-zinc-500">
                  {["09:30", "13:30", "17:30"].map((t, i) => (
                    <div key={t}><span className="mx-auto mb-1 flex h-7 w-7 items-center justify-center rounded-full bg-zinc-900 text-[11px] font-semibold text-white">{i + 1}</span>{t}</div>
                  ))}
                </div>
                <dl className="mt-3 text-sm">
                  <Row k="Attempts" v="3 per contact" />
                  <Row k="Gap between attempts" v="4 hours" />
                  <Row k="On opt out" v={<Pill tone="red">Stop and suppress</Pill>} />
                  <Row k="Number on DND list" v="Skip, no retry" />
                </dl>
              </div>
            </Panel>
          </div>
        </div>
      </div>

      {sim && result && (
        <Modal title="Simulate a call" hint="Change the caller and watch which rule picks up the call." onClose={() => setSim(null)} footer={<Btn size="sm" onClick={() => setSim(null)}>Close</Btn>}>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Member tier"><select value={sim.tier} onChange={(e) => setSim({ ...sim, tier: e.target.value as SimInput["tier"] })} className={inputClass}>{["Platinum", "Gold", "Silver"].map((t) => <option key={t}>{t}</option>)}</select></Field>
            <Field label="Hour of day"><input type="number" min={0} max={23} value={sim.hour} onChange={(e) => setSim({ ...sim, hour: Math.min(23, Math.max(0, Number(e.target.value))) })} className={inputClass} /></Field>
            <Field label="Language heard"><select value={sim.lang} onChange={(e) => setSim({ ...sim, lang: e.target.value as SimInput["lang"] })} className={inputClass}>{["Hindi", "English", "Mixed"].map((t) => <option key={t}>{t}</option>)}</select></Field>
            <Field label="Queue wait, seconds"><input type="number" min={0} max={120} value={sim.queueWait} onChange={(e) => setSim({ ...sim, queueWait: Number(e.target.value) })} className={inputClass} /></Field>
            <Field label="What they want"><select value={sim.intent} onChange={(e) => setSim({ ...sim, intent: e.target.value as SimInput["intent"] })} className={inputClass + " col-span-2"}>{["Booking or hold", "Refund over 25,000", "Upgrade", "Billing", "Complaint"].map((t) => <option key={t}>{t}</option>)}</select></Field>
          </div>
          <div className="rounded-lg bg-[#FDF6F1] p-3">
            <p className="text-xs font-semibold text-[#E2703A]">Rule {result.rule} matched</p>
            <p className="mt-0.5 font-semibold">{result.route}</p>
            <p className="text-xs text-zinc-600">{result.why}</p>
            {result.thenHuman && <p className="mt-2 text-xs text-zinc-700">{result.thenHuman}</p>}
          </div>
        </Modal>
      )}
      {adding && (
        <Modal title="New outbound campaign" hint="Promotional (140) campaigns dial only consented contacts inside 09:00 to 21:00." onClose={() => setAdding(false)} footer={<ModalActions onCancel={() => setAdding(false)} onOk={addCampaign} okLabel="Schedule" okDisabled={!draft.name.trim() || !Number(draft.total)} />}>
          <Field label="Campaign name"><input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className={inputClass} placeholder="Diwali offer, Gold members" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Contacts"><input type="number" min={1} value={draft.total} onChange={(e) => setDraft({ ...draft, total: e.target.value })} className={inputClass} /></Field>
            <Field label="DLT series"><select value={draft.series} onChange={(e) => setDraft({ ...draft, series: e.target.value })} className={inputClass}><option>160 service</option><option>140 promotional</option></select></Field>
          </div>
          <Field label="Starts"><input value={draft.start} onChange={(e) => setDraft({ ...draft, start: e.target.value })} className={inputClass} /></Field>
        </Modal>
      )}
    </>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return <div className="flex items-center justify-between border-b border-zinc-100 py-2.5 last:border-0"><dt className="text-zinc-500">{k}</dt><dd className="font-medium">{v}</dd></div>;
}
