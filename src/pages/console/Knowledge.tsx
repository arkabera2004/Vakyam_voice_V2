import { Btn, IconTile, PageTitle, Panel, PanelHeader, Pill, Td, Th, Toggle } from "@/console/ui";
import { cn } from "@/lib/utils";

const SOURCES = [
  { emoji: "📘", name: "Booking and cancellation", sub: "86 articles, updated 10 Nov, owner Kavita Rao", live: true },
  { emoji: "🏨", name: "Resort amenities", sub: "142 articles, updated 4 Nov, owner Asha Nair", live: true },
  { emoji: "🌿", name: "Member benefits", sub: "64 articles, updated 29 Oct, owner Kavita Rao", live: false },
  { emoji: "📒", name: "Billing", sub: "38 articles, updated 11 Nov, owner Asha Nair", live: true },
];

const GATES = [
  { on: true, name: "Upgrade room type", sub: "Studio to 1BR or 2BR, any resort", meera: "Needs human", approver: "Asha Nair queue", sla: "SLA 5 min", n: 41 },
  { on: true, name: "Refund above 25,000 rupees", sub: "Any cancellation refund over the limit", meera: "Needs human", approver: "Asha Nair queue", sla: "SLA 5 min", n: 27 },
  { on: true, name: "Waive cancellation fee", sub: "Full or partial waiver", meera: "Needs human", approver: "Asha Nair queue", sla: "SLA 10 min", n: 33 },
  { on: true, name: "Hold extension beyond 24 h", sub: "place_hold past the standard window", meera: "Needs human", approver: "Asha Nair queue", sla: "SLA 15 min", n: 19 },
  { on: false, name: "Reschedule inside 48 h", sub: "One change per booking, same resort", meera: "Meera may", approver: "No approver", sla: "Limit 1 change", n: 112 },
];

export default function Knowledge() {
  return (
    <>
      <PageTitle crumb="Build, Club Mahindra member line, Meera v7" title="Knowledge and policies" actions={<><Btn>Version history</Btn><Btn variant="primary">Publish changes</Btn></>} />

      <div className="grid gap-4 lg:grid-cols-[380px_1fr]">
        <div className="space-y-4">
          <Panel>
            <PanelHeader title="Knowledge sources" right={<span className="text-xs font-medium text-[#E2703A]">Add source</span>} />
            <ul className="divide-y divide-zinc-100">
              {SOURCES.map((s) => (
                <li key={s.name} className="flex items-center gap-3 px-4 py-3">
                  <IconTile emoji={s.emoji} />
                  <div className="flex-1"><p className="text-sm font-medium">{s.name}</p><p className="text-xs text-zinc-500">{s.sub}</p></div>
                  <Pill tone={s.live ? "green" : "amber"}>{s.live ? "Live" : "Review due"}</Pill>
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
              {GATES.map((g) => (
                <tr key={g.name} className="border-t border-zinc-100">
                  <Td className="py-5"><Toggle on={g.on} label={g.name} /></Td>
                  <Td><p className="font-medium">{g.name}</p><p className="text-xs text-zinc-500">{g.sub}</p></Td>
                  <Td><Pill tone={g.on ? "red" : "green"}>{g.meera}</Pill></Td>
                  <Td><p>{g.approver}</p><p className="text-xs text-zinc-500">{g.sla}</p></Td>
                  <Td className="text-right text-base font-semibold">{g.n}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      </div>

      <Panel className="mt-4 grid gap-4 p-4 lg:grid-cols-[1fr_1.5fr]">
        <div>
          <p className="text-sm font-semibold">Ask Meera a policy question</p>
          <div className="mt-3 rounded-lg bg-zinc-50 px-3 py-2.5 text-sm">Can I move my Goa booking to next weekend?</div>
          <div className="mt-3 flex gap-2"><Btn variant="dark" size="sm">Run test</Btn><Btn size="sm">Use a Hinglish question</Btn></div>
        </div>
        <div className={cn("rounded-lg bg-[#FDF6F1] p-4")}>
          <p className="flex items-center gap-2 text-sm"><span className="font-semibold text-[#E2703A]">Meera would say</span><Pill tone="green">Allowed, no handoff</Pill></p>
          <p className="mt-2 text-sm">Ji bilkul, aapki booking 48 ghante se pehle hai isliye main ek baar free reschedule kar sakti hoon. Kaun si date dekhun?</p>
          <p className="mt-3 flex items-center gap-2 text-xs text-zinc-500">Cited source <Pill>Booking and cancellation, article 14, Reschedule rules</Pill></p>
        </div>
      </Panel>
    </>
  );
}
