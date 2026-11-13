import { ChevronDown } from "lucide-react";
import { Btn, IconTile, PageTitle, Panel, PanelHeader, Pill, Td, Th } from "@/console/ui";
import { cn } from "@/lib/utils";

const VERSIONS = ["v6.8", "v7.0", "v7.1", "v7.2", "v7.3 live"];
const RUBRIC: { name: string; scores: number[] }[] = [
  { name: "Disclosure given", scores: [97, 98, 98, 99, 99] },
  { name: "Consent captured", scores: [92, 93, 94, 95, 96] },
  { name: "Intent understood", scores: [84, 86, 88, 89, 90] },
  { name: "Correct tool use", scores: [86, 88, 90, 91, 92] },
  { name: "Policy followed", scores: [88, 89, 91, 92, 93] },
  { name: "Tone", scores: [82, 84, 86, 87, 88] },
  { name: "Language match", scores: [72, 76, 79, 81, 82] },
];

const FLAGGED = [
  { call: 4801, member: "Rohan Mehta", tier: "Platinum", criterion: "Policy followed", score: 52, reviewer: "Asha Nair" },
  { call: 4795, member: "Priya Sharma", tier: "Gold", criterion: "Language match", score: 64, reviewer: "Kavita Rao" },
  { call: 4790, member: "Anita Iyer", tier: "Gold", criterion: "Language match", score: 70, reviewer: "" },
  { call: 4783, member: "Neha Kapoor", tier: "Gold", criterion: "Tone", score: 66, reviewer: "Asha Nair" },
  { call: 4777, member: "Vikram Joshi", tier: "Silver", criterion: "Intent understood", score: 68, reviewer: "" },
  { call: 4768, member: "Priya Sharma", tier: "Gold", criterion: "Correct tool use", score: 71, reviewer: "Kavita Rao" },
];

export const scoreTone = (s: number) => (s >= 95 ? "bg-emerald-50 text-emerald-700" : s >= 90 ? "bg-emerald-50/60 text-emerald-700" : s >= 85 ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-700");

export default function QAScorecards() {
  return (
    <>
      <PageTitle
        crumb="Govern / Quality across calls"
        title="QA scorecards"
        actions={
          <>
            <Btn>Last 7 days <ChevronDown className="h-3.5 w-3.5" /></Btn>
            <Btn>Club Mahindra desk <ChevronDown className="h-3.5 w-3.5" /></Btn>
            <Btn>Edit rubric</Btn>
            <Btn variant="dark">Export report</Btn>
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi emoji="📊" label="Average QA score" value="91.4" sub={<span className="text-emerald-600">+1.2 vs last week</span>} />
        <Kpi emoji="📞" label="Calls scored today" value="1,284" sub="auto, plus 60 human reviewed" />
        <Kpi emoji="🚩" label="Flagged for review" value={<span className="text-red-600">23</span>} sub="9 unassigned" />
        <Kpi emoji="🛡️" label="Disclosure compliance" value="99.8%" sub={<span className="text-emerald-600">Target 99.5%</span>} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1.2fr]">
        <Panel>
          <PanelHeader title="Rubric by prompt version" hint="Mean score, Meera v7" />
          <table className="w-full">
            <thead className="bg-zinc-50">
              <tr>
                <Th>Criterion</Th>
                {VERSIONS.map((v) => <Th key={v} className={cn("text-center", v.includes("live") && "font-semibold text-zinc-900")}>{v}</Th>)}
              </tr>
            </thead>
            <tbody>
              {RUBRIC.map((r) => (
                <tr key={r.name} className="border-t border-zinc-100">
                  <Td className="py-4">{r.name}</Td>
                  {r.scores.map((s, i) => (
                    <Td key={i} className="py-2 text-center">
                      <span className={cn("inline-flex h-8 w-12 items-center justify-center rounded-md text-sm font-medium", scoreTone(s))}>{s}</span>
                    </Td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex gap-4 border-t border-zinc-100 px-4 py-3 text-[11px] text-zinc-500">
            <Legend c="bg-emerald-200" t="95 and up" /><Legend c="bg-emerald-100" t="90 to 94" /><Legend c="bg-amber-200" t="85 to 89" /><Legend c="bg-red-200" t="Below 85" />
          </div>
        </Panel>

        <Panel>
          <PanelHeader title="Flagged calls" hint="Any criterion under 75, newest first" right={<Pill tone="red">23 open</Pill>} />
          <table className="w-full">
            <thead className="bg-zinc-50">
              <tr><Th>Call</Th><Th>Member</Th><Th>Criterion</Th><Th>Score</Th><Th>Reviewer</Th><Th /></tr>
            </thead>
            <tbody>
              {FLAGGED.map((f) => (
                <tr key={f.call} className="border-t border-zinc-100">
                  <Td className="font-medium">{f.call}</Td>
                  <Td><p>{f.member}</p><p className="text-xs text-zinc-500">{f.tier}</p></Td>
                  <Td>{f.criterion}</Td>
                  <Td><span className={cn("rounded px-1.5 py-0.5 text-xs font-semibold", f.score < 65 ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700")}>{f.score}</span></Td>
                  <Td className={cn(!f.reviewer && "text-zinc-400")}>{f.reviewer || "Unassigned"}</Td>
                  <Td className="text-right"><Btn size="sm">Open</Btn></Td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex items-center justify-between border-t border-zinc-100 px-4 py-3 text-xs">
            <span className="text-zinc-500">Showing 6 of 23</span>
            <span className="font-medium text-[#E2703A]">View all flagged calls</span>
          </div>
        </Panel>
      </div>
    </>
  );
}

function Kpi({ emoji, label, value, sub }: { emoji: string; label: string; value: React.ReactNode; sub: React.ReactNode }) {
  return (
    <Panel className="flex items-center gap-3 p-4">
      <IconTile emoji={emoji} size={44} />
      <div>
        <p className="text-xs text-zinc-500">{label}</p>
        <p className="text-[26px] font-semibold leading-tight tracking-[-0.02em]">{value}</p>
        <p className="text-[11px] text-zinc-500">{sub}</p>
      </div>
    </Panel>
  );
}

function Legend({ c, t }: { c: string; t: string }) {
  return <span className="flex items-center gap-1.5"><span className={cn("h-2.5 w-2.5 rounded-sm", c)} />{t}</span>;
}
