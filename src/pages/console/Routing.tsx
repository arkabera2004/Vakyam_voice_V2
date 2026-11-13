import { Bar, Btn, IconTile, Lang, PageTitle, Panel, PanelHeader, Pill, Td, Th, type Tone } from "@/console/ui";

const RULES = [
  { title: "VIP Platinum goes to Meera first", body: "Platinum members skip the queue and reach Meera with the concierge prompt, such as Rohan Mehta.", tag: "Priority 1", tone: "purple" as Tone },
  { title: "Language detect, Hindi or English", body: "Meera listens for the first 6 seconds, then opens in the language the caller used and follows any switch.", langs: true },
  { title: "After hours, 21:00 to 08:00", body: "Route to Meera, then create a callback task for the morning desk when she cannot finish the request.", tag: "Callback task at 08:30", tone: "neutral" as Tone },
  { title: "Overflow to the human queue", body: "When the wait is over 20 seconds, send the call to the human queue with a summary attached.", tag: "Wait over 20 seconds", tone: "amber" as Tone },
  { title: "Transfer rules", body: "Refunds over ₹25,000 and upgrades always go to a human, such as Asha Nair, with a warm transfer.", tag: "Needs a human", tone: "red" as Tone },
];

const CAMPAIGNS = [
  { emoji: "🌿", name: "Renewal reminder, Gold members", sub: "Hindi first, 4,200 contacts", dialed: 2730, total: 4200, connected: 1184, dlt: "CLBMHN", series: "160 service", status: "Running", tone: "green" as Tone },
  { emoji: "💬", name: "Stay feedback calls", sub: "Checked out in the last 3 days", dialed: 1120, total: 1850, connected: 548, dlt: "CLBMHN", series: "160 service", status: "Running", tone: "green" as Tone },
  { emoji: "🧥", name: "Winter offer, Platinum members", sub: "Promotional, starts tomorrow 09:00", dialed: 0, total: 960, connected: 0, dlt: "CLBMHP", series: "140 promotional", status: "Scheduled", tone: "purple" as Tone },
  { emoji: "⏳", name: "Arrival reminder, Lonavala stays", sub: "Finished yesterday 20:40", dialed: 640, total: 640, connected: 402, dlt: "CLBMHN", series: "160 service", status: "Completed", tone: "neutral" as Tone },
];

export default function Routing() {
  return (
    <>
      <PageTitle crumb="Build / Routing and campaigns" title="Who Meera answers, and who she calls" actions={<><Btn>Simulate a call</Btn><Btn variant="primary">New campaign</Btn></>} />

      <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
        <Panel>
          <PanelHeader title="Inbound rules" hint="Checked top to bottom, the first match wins" stack />
          <ol className="divide-y divide-zinc-100">
            {RULES.map((r, i) => (
              <li key={r.title} className="flex gap-3 p-4">
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
              <thead className="bg-zinc-50"><tr><Th>Campaign</Th><Th>Contacts dialed and connected</Th><Th>DLT sender and series</Th><Th>Status</Th></tr></thead>
              <tbody>
                {CAMPAIGNS.map((c) => (
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
                    <Td><Pill tone={c.tone}>{c.status}</Pill></Td>
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
    </>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return <div className="flex items-center justify-between border-b border-zinc-100 py-2.5 last:border-0"><dt className="text-zinc-500">{k}</dt><dd className="font-medium">{v}</dd></div>;
}
