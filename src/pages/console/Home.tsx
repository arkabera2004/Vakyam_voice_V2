import { Link, useNavigate } from "react-router-dom";
import { Bar, Btn, IconTile, Panel, Pill, SegmentBar, Stat, Td, Th, type Tone } from "@/console/ui";
import { useNeedsYou } from "@/hooks/useNeedsYou";
import { downloadCsv } from "@/console/export";
import { toast } from "@/hooks/use-toast";
import { greeting, todayLabel } from "@/console/clock";

type QueueItem = { id: string; emoji: string; title: string; detail: string; risk: string; riskTone: Tone; due: string; action: string; to: string };

const REASONS = [
  { label: "Policy needs approval", pct: 38, color: "#18181b" },
  { label: "Caller asked for a person", pct: 31, color: "#18181b" },
  { label: "Low confidence", pct: 19, color: "#E2703A" },
  { label: "Tool or CRM failure", pct: 12, color: "#b91c1c" },
];

/**
 * "Needs you" shows only what is actually real today: ringing transfers and
 * flagged evaluations nobody has reviewed yet. Refund/upgrade/hold-extension
 * approvals, which the old demo invented here, have no backing table -- the
 * realtime agent has no tool-calling to raise one (GAP-B-02) -- so they are
 * dropped rather than faked. Call-volume stats, language mix and the
 * handoff-reason breakdown below stay demo data, out of scope for this pass.
 */
export default function Home() {
  const navigate = useNavigate();
  const { transfersRinging, flaggedUnreviewed, loading } = useNeedsYou();

  const items: QueueItem[] = [
    ...(transfersRinging > 0
      ? [
          {
            id: "transfers",
            emoji: "🫱",
            title: `${transfersRinging} warm transfer${transfersRinging > 1 ? "s" : ""} waiting for a human agent`,
            detail: "Open the queue to accept or decline.",
            risk: "Medium",
            riskTone: "amber" as Tone,
            due: "Now",
            action: "Open queue",
            to: "/console/transfers",
          },
        ]
      : []),
    ...flaggedUnreviewed.map((f) => ({
      id: f.id,
      emoji: "🚩",
      title: `QA flag on the call with ${f.callerName}`,
      detail: f.overallScore != null ? `Scored ${f.overallScore}, below the rubric's pass threshold.` : "Flagged, awaiting a score.",
      risk: "Needs a reviewer",
      riskTone: "red" as Tone,
      due: new Date(f.createdAt).toLocaleDateString(),
      action: "Review",
      to: "/console/qa",
    })),
  ];
  const openCount = items.length;

  const exportShift = () => {
    downloadCsv("shift-report.csv", [
      ["Metric", "Value"],
      ["Calls today", 1284],
      ["Contained by Meera", "71.4%"],
      ["Warm transfers", 290],
      ["Average handle time", "3m 42s"],
      ["AI cost per call", "₹11.4"],
      [],
      ["Open item", "Risk", "Due", "Status"],
      ...items.map((i) => [i.title, i.risk, i.due, "open"]),
    ]);
    toast({ title: "Shift report exported", description: "shift-report.csv is in your downloads." });
  };

  return (
    <>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="mb-1 text-[13px] text-zinc-500">{todayLabel()}</p>
          <h1 className="text-[28px] font-semibold leading-tight tracking-[-0.02em]">{greeting()}. Meera is handling 71% of calls.</h1>
        </div>
        <Btn onClick={exportShift}>Export shift report</Btn>
      </div>

      <section className="flex flex-wrap items-center gap-6 rounded-xl border border-orange-100 bg-[#FBEFE8] p-5">
        <div className="flex min-w-[260px] flex-1 items-center gap-4">
          <IconTile emoji="🎤" size={56} className="rounded-xl" />
          <div>
            <p className="text-xs font-medium text-emerald-700">14 calls live, none stuck</p>
            <p className="text-lg font-semibold">Pune desk is on track</p>
            <p className="text-[13px] text-zinc-600">Meera v7 on Club Mahindra member line. {transfersRinging} warm transfer{transfersRinging === 1 ? "" : "s"} waiting for a human.</p>
          </div>
        </div>
        <div className="grid min-w-0 grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-5">
          <Stat value="1,284" label="Calls today" />
          <Stat value="71.4%" label="Contained by Meera" sub="+2.1 pts vs last week" />
          <Stat value="290" label="Warm transfers" />
          <Stat value="3m 42s" label="Average handle time" />
          <Stat value="₹11.4" label="AI cost per call" />
        </div>
        <Btn variant="primary" onClick={() => navigate(items[0]?.to ?? "/console/qa")}>
          Review {openCount} item{openCount === 1 ? "" : "s"}
        </Btn>
      </section>

      <div className="mt-7 mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">Needs you</h2>
          <Pill tone="orange">{openCount} items, highest risk first</Pill>
        </div>
        <Link to="/console/qa" className="text-[13px] font-medium text-[#E2703A]">
          See all flagged calls
        </Link>
      </div>

      <Panel className="overflow-x-auto">
        <table className="w-full min-w-[820px]">
          <thead className="bg-zinc-50">
            <tr>
              <Th className="w-10">#</Th>
              <Th>What needs a decision</Th>
              <Th>Risk</Th>
              <Th>Due</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <Td className="py-8 text-center text-zinc-500" colSpan={5}>
                  Loading…
                </Td>
              </tr>
            )}
            {!loading && items.length === 0 && (
              <tr>
                <Td className="py-8 text-center text-zinc-500" colSpan={5}>
                  Nothing waiting on you. Meera is handling the floor.
                </Td>
              </tr>
            )}
            {!loading &&
              items.map((r, i) => (
                <tr key={r.id} className={i === 0 && r.riskTone === "red" ? "bg-[#FDF6F1]" : "border-t border-zinc-100"}>
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
                  <Td>
                    <Pill tone={r.riskTone}>{r.risk}</Pill>
                  </Td>
                  <Td>{r.due}</Td>
                  <Td className="text-right">
                    <Btn size="sm" variant={i === 0 ? "dark" : "outline"} onClick={() => navigate(r.to)}>
                      {r.action}
                    </Btn>
                  </Td>
                </tr>
              ))}
          </tbody>
        </table>
      </Panel>

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <div className="min-w-0">
          <h2 className="mb-3 text-lg font-semibold">Language mix today</h2>
          <Panel className="p-4">
            <SegmentBar segments={[{ value: 46, color: "#18181b" }, { value: 31, color: "#E2703A" }, { value: 23, color: "#F3C3A6" }]} />
            <div className="mt-4 flex flex-wrap justify-between gap-4">
              <Stat value="46%" label="Hindi calls" />
              <Stat value="31%" label="English calls" />
              <Stat value="23%" label="Switch mid call" />
              <Stat value={<span className="text-emerald-600">92%</span>} label="Mixed calls contained" />
            </div>
          </Panel>
        </div>
        <div className="min-w-0">
          <h2 className="mb-3 text-lg font-semibold">Tool calls today</h2>
          <Panel className="flex flex-wrap items-start justify-between gap-4 p-4">
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
              <span className="font-semibold" style={{ color: r.color }}>
                {r.pct}%
              </span>
            </div>
            <Bar value={r.pct} color={r.color} className="mt-3" />
          </Panel>
        ))}
      </div>
    </>
  );
}
