import { Link } from "react-router-dom";
import { Bar, Btn, IconTile, Panel, PanelHeader, Pill, SegmentBar, Stat, Td, Th, type Tone } from "@/console/ui";

const NEEDS_YOU: { emoji: string; title: string; detail: string; risk: string; riskTone: Tone; waiting: string; due: string; dueHot?: boolean; action: string; primary?: boolean; to: string }[] = [
  {
    emoji: "🚩",
    title: "Approve refund of ₹38,400 for Rohan Mehta, Platinum",
    detail: "Cancellation inside 48 hours at Kumbhalgarh. Refunds over ₹25,000 need a human.",
    risk: "High, money moves",
    riskTone: "red",
    waiting: "4 min on hold",
    due: "Now",
    dueHot: true,
    action: "Decide",
    primary: true,
    to: "/console/transfers",
  },
  {
    emoji: "🧳",
    title: "Approve upgrade from Studio to 2BR for Anita Iyer, Gold",
    detail: "Goa, 3 nights from 21 Dec. Meera cannot upgrade without approval.",
    risk: "Medium",
    riskTone: "amber",
    waiting: "11 min on hold",
    due: "Today 15:00",
    action: "Review",
    to: "/console/review",
  },
  {
    emoji: "🫱",
    title: "3 warm transfers waiting for a human agent",
    detail: "Summaries ready. Longest wait is 38 seconds. Floor has 2 agents free.",
    risk: "Medium",
    riskTone: "amber",
    waiting: "38 sec",
    due: "Within 2 min",
    action: "Open queue",
    to: "/console/transfers",
  },
  {
    emoji: "⏳",
    title: "2 room holds expire in 10 minutes without a booking",
    detail: "Lonavala 1BR for Neha Kulkarni, Mussoorie 2BR for Imran Qureshi. Callback queued.",
    risk: "Low",
    riskTone: "neutral",
    waiting: "Call ended",
    due: "Today 14:20",
    action: "Extend",
    to: "/console/knowledge",
  },
];

const REASONS = [
  { label: "Policy needs approval", pct: 38, color: "#18181b" },
  { label: "Caller asked for a person", pct: 31, color: "#18181b" },
  { label: "Low confidence", pct: 19, color: "#E2703A" },
  { label: "Tool or CRM failure", pct: 12, color: "#b91c1c" },
];

export default function Home() {
  return (
    <>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="mb-1 text-[13px] text-zinc-500">Thursday, 12 November, 14:10 IST</p>
          <h1 className="text-[28px] font-semibold leading-tight tracking-[-0.02em]">Good afternoon. Meera is handling 71% of calls.</h1>
        </div>
        <Btn>Export shift report</Btn>
      </div>

      <section className="flex flex-wrap items-center gap-6 rounded-xl border border-orange-100 bg-[#FBEFE8] p-5">
        <div className="flex min-w-[260px] flex-1 items-center gap-4">
          <IconTile emoji="🎤" size={56} className="rounded-xl" />
          <div>
            <p className="text-xs font-medium text-emerald-700">14 calls live, none stuck</p>
            <p className="text-lg font-semibold">Pune desk is on track</p>
            <p className="text-[13px] text-zinc-600">Meera v7 on Club Mahindra member line. 3 warm transfers waiting for a human.</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-x-8 gap-y-4 sm:grid-cols-5">
          <Stat value="1,284" label="Calls today" />
          <Stat value="71.4%" label="Contained by Meera" sub="+2.1 pts vs last week" />
          <Stat value="290" label="Warm transfers" />
          <Stat value="3m 42s" label="Average handle time" />
          <Stat value="₹11.4" label="AI cost per call" />
        </div>
        <Link to="/console/transfers">
          <Btn variant="primary">Review 7 items</Btn>
        </Link>
      </section>

      <div className="mt-7 mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">Needs you</h2>
          <Pill tone="orange">7 items, highest risk first</Pill>
        </div>
        <Link to="/console/transfers" className="text-[13px] font-medium text-[#E2703A]">See all 7 items</Link>
      </div>

      <Panel className="overflow-x-auto">
        <table className="w-full min-w-[820px]">
          <thead className="bg-zinc-50">
            <tr>
              <Th className="w-10">#</Th>
              <Th>What needs a decision</Th>
              <Th>Risk</Th>
              <Th>Caller waiting</Th>
              <Th>Due</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {NEEDS_YOU.map((r, i) => (
              <tr key={i} className={i === 0 ? "bg-[#FDF6F1]" : "border-t border-zinc-100"}>
                <Td className="text-zinc-500">{i + 1}</Td>
                <Td>
                  <div className="flex items-center gap-3">
                    <IconTile emoji={r.emoji} />
                    <div>
                      <p className="font-medium">{r.title}</p>
                      <p className="text-xs text-zinc-500">{r.detail}</p>
                    </div>
                  </div>
                </Td>
                <Td><Pill tone={r.riskTone}>{r.risk}</Pill></Td>
                <Td>{r.waiting}</Td>
                <Td className={r.dueHot ? "font-medium text-red-600" : ""}>{r.due}</Td>
                <Td className="text-right">
                  <Link to={r.to}><Btn size="sm" variant={r.primary ? "dark" : "outline"}>{r.action}</Btn></Link>
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <div>
          <h2 className="mb-3 text-lg font-semibold">Language mix today</h2>
          <Panel className="p-4">
            <SegmentBar segments={[{ value: 46, color: "#18181b" }, { value: 31, color: "#E2703A" }, { value: 23, color: "#F3C3A6" }]} />
            <div className="mt-4 flex justify-between gap-4">
              <Stat value="46%" label="Hindi calls" />
              <Stat value="31%" label="English calls" />
              <Stat value="23%" label="Switch mid call" />
              <Stat value={<span className="text-emerald-600">92%</span>} label="Mixed calls contained" />
            </div>
          </Panel>
        </div>
        <div>
          <h2 className="mb-3 text-lg font-semibold">Tool calls today</h2>
          <Panel className="flex items-start justify-between gap-4 p-4">
            <Stat value="2,310" label="check_availability" />
            <Stat value="402" label="place_hold" />
            <Stat value="138" label="create_case" />
            <Stat value={<span className="text-emerald-600">99.2%</span>} label="Succeeded first try" />
          </Panel>
        </div>
      </div>

      <h2 className="mt-6 mb-3 text-lg font-semibold">Why calls moved to a human today</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {REASONS.map((r) => (
          <Panel key={r.label} className="p-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-zinc-700">{r.label}</span>
              <span className="font-semibold" style={{ color: r.color }}>{r.pct}%</span>
            </div>
            <Bar value={r.pct} color={r.color} className="mt-3" />
          </Panel>
        ))}
      </div>
    </>
  );
}

// self-check: the "Needs you" preview must stay in the design's risk order.
if (import.meta.env.DEV) {
  const order: Tone[] = ["red", "amber", "amber", "neutral"];
  console.assert(NEEDS_YOU.every((r, i) => r.riskTone === order[i]), "Home: Needs-you rows out of risk order");
}
