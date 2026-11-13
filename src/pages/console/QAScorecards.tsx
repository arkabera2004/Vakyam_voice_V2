import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Btn, IconTile, PageTitle, Panel, PanelHeader, Pill, Td, Th } from "@/console/ui";
import { Dropdown } from "@/console/Dropdown";
import { Modal, Field, inputClass, ModalActions } from "@/console/Modal";
import { useConsole } from "@/console/store";
import { downloadCsv } from "@/console/export";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const RANGES = ["Last 7 days", "Last 30 days", "Today"] as const;
const DESKS = ["Club Mahindra desk", "All desks"] as const;
const REVIEWERS = ["Unassigned", "Asha Nair", "Kavita Rao", "Rohit Verma"] as const;

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
// Rubric weights live in the store? No: they are prompt-side config, kept here until a rubric API exists.
const DEFAULT_WEIGHTS = Object.fromEntries(RUBRIC.map((r) => [r.name, r.name === "Disclosure given" || r.name === "Consent captured" ? 20 : 12]));

const FLAGGED = [
  { call: 4801, member: "Rohan Mehta", tier: "Platinum", criterion: "Policy followed", score: 52, desk: "Club Mahindra desk", day: 0 },
  { call: 4795, member: "Priya Sharma", tier: "Gold", criterion: "Language match", score: 64, desk: "Club Mahindra desk", day: 0 },
  { call: 4790, member: "Anita Iyer", tier: "Gold", criterion: "Language match", score: 70, desk: "Club Mahindra desk", day: 1 },
  { call: 4783, member: "Neha Kapoor", tier: "Gold", criterion: "Tone", score: 66, desk: "Club Mahindra desk", day: 1 },
  { call: 4777, member: "Vikram Joshi", tier: "Silver", criterion: "Intent understood", score: 68, desk: "Club Mahindra desk", day: 2 },
  { call: 4768, member: "Priya Sharma", tier: "Gold", criterion: "Correct tool use", score: 71, desk: "Club Mahindra desk", day: 3 },
  { call: 4731, member: "Sameer Khan", tier: "Gold", criterion: "Tone", score: 69, desk: "Goa resort desk", day: 2 },
  { call: 4702, member: "Deepa Rao", tier: "Silver", criterion: "Language match", score: 73, desk: "Goa resort desk", day: 9 },
];

const scoreTone = (s: number) => (s >= 95 ? "bg-emerald-50 text-emerald-700" : s >= 90 ? "bg-emerald-50/60 text-emerald-700" : s >= 85 ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-700");

export default function QAScorecards() {
  const [range, setRange] = useState<(typeof RANGES)[number]>(RANGES[0]);
  const [desk, setDesk] = useState<(typeof DESKS)[number]>(DESKS[0]);
  const [showAll, setShowAll] = useState(false);
  const [rubricOpen, setRubricOpen] = useState(false);
  const [weights, setWeights] = useState<Record<string, number>>(DEFAULT_WEIGHTS);
  const { state, update, log } = useConsole();
  const navigate = useNavigate();

  const days = range === "Today" ? 1 : range === "Last 7 days" ? 7 : 30;
  const flagged = FLAGGED.filter((f) => f.day < days && (desk === "All desks" || f.desk === desk));
  const rows = showAll ? flagged : flagged.slice(0, 6);
  const unassigned = flagged.filter((f) => !state.reviewers[f.call]).length;
  const total = Object.values(weights).reduce((a, b) => a + b, 0);

  const assign = (call: number, who: string) => {
    update((s) => {
      const reviewers = { ...s.reviewers };
      if (who === "Unassigned") delete reviewers[call];
      else reviewers[call] = who;
      return { reviewers };
    });
    log(who === "Unassigned" ? `Unassigned reviewer on call ${call}` : `Assigned call ${call} to ${who} for review`, "QA");
  };

  const exportReport = () => {
    downloadCsv(`qa-report-${range.toLowerCase().replace(/\s+/g, "-")}.csv`, [
      ["Criterion", ...VERSIONS], ...RUBRIC.map((r) => [r.name, ...r.scores]), [],
      ["Call", "Member", "Tier", "Criterion", "Score", "Reviewer"], ...flagged.map((f) => [f.call, f.member, f.tier, f.criterion, f.score, state.reviewers[f.call] ?? "Unassigned"]),
    ]);
    toast({ title: "QA report exported", description: `${flagged.length} flagged calls and the rubric heatmap, ${range.toLowerCase()}, ${desk}.` });
  };

  const saveRubric = () => {
    setRubricOpen(false);
    log("Rubric weights updated", "Rubric v4.1");
    toast({ title: "Rubric saved as v4.1", description: "New calls are scored with the new weights from the next call. Past scores are not rescored." });
  };

  return (
    <>
      <PageTitle
        crumb="Govern / Quality across calls"
        title="QA scorecards"
        actions={
          <>
            <Dropdown value={range} options={RANGES} onChange={setRange} />
            <Dropdown value={desk} options={DESKS} onChange={setDesk} />
            <Btn onClick={() => setRubricOpen(true)}>Edit rubric</Btn>
            <Btn variant="dark" onClick={exportReport}>Export report</Btn>
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi emoji="📊" label="Average QA score" value="91.4" sub={<span className="text-emerald-600">+1.2 vs last week</span>} />
        <Kpi emoji="📞" label="Calls scored today" value="1,284" sub="auto, plus 60 human reviewed" />
        <Kpi emoji="🚩" label="Flagged for review" value={<span className="text-red-600">{flagged.length + 15}</span>} sub={`${unassigned + 7} unassigned`} />
        <Kpi emoji="🛡️" label="Disclosure compliance" value="99.8%" sub={<span className="text-emerald-600">Target 99.5%</span>} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1.2fr]">
        <Panel>
          <PanelHeader title="Rubric by prompt version" hint={`Mean score, Meera v7, ${range.toLowerCase()}, ${desk}`} />
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
                  <Td className="py-4">{r.name}<span className="ml-1.5 text-[11px] text-zinc-400">{weights[r.name]}%</span></Td>
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
          <PanelHeader title="Flagged calls" hint="Any criterion under 75, newest first" right={<Pill tone="red">{flagged.length + 15} open</Pill>} />
          <table className="w-full">
            <thead className="bg-zinc-50">
              <tr><Th>Call</Th><Th>Member</Th><Th>Criterion</Th><Th>Score</Th><Th>Reviewer</Th><Th /></tr>
            </thead>
            <tbody>
              {rows.map((f) => {
                const who = state.reviewers[f.call] ?? "Unassigned";
                return (
                  <tr key={f.call} className="border-t border-zinc-100">
                    <Td className="font-medium">{f.call}</Td>
                    <Td><p>{f.member}</p><p className="text-xs text-zinc-500">{f.tier}</p></Td>
                    <Td>{f.criterion}</Td>
                    <Td><span className={cn("rounded px-1.5 py-0.5 text-xs font-semibold", f.score < 65 ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700")}>{f.score}</span></Td>
                    <Td className="py-1">
                      <select value={who} onChange={(e) => assign(f.call, e.target.value)} aria-label={`Reviewer for call ${f.call}`} className={cn("h-8 rounded-md border border-transparent bg-transparent pr-1 text-sm hover:border-zinc-200", who === "Unassigned" && "text-zinc-400")}>
                        {REVIEWERS.map((r) => <option key={r}>{r}</option>)}
                      </select>
                    </Td>
                    <Td className="text-right"><Btn size="sm" onClick={() => navigate(f.call === 4790 ? "/console/review" : `/console/review?call=${f.call}`)}>Open</Btn></Td>
                  </tr>
                );
              })}
              {rows.length === 0 && <tr><Td colSpan={6} className="py-8 text-center text-zinc-500">No flagged calls for {range.toLowerCase()} on {desk}.</Td></tr>}
            </tbody>
          </table>
          <div className="flex items-center justify-between border-t border-zinc-100 px-4 py-3 text-xs">
            <span className="text-zinc-500">Showing {rows.length} of {flagged.length + 15}</span>
            <button className="font-medium text-[#E2703A]" onClick={() => setShowAll((v) => !v)}>{showAll ? "Show fewer" : "View all flagged calls"}</button>
          </div>
        </Panel>
      </div>

      {rubricOpen && (
        <Modal title="Edit rubric weights" hint="Weights must add up to 100. Disclosure and consent are mandatory criteria and cannot drop below 15." onClose={() => setRubricOpen(false)} footer={<ModalActions onCancel={() => setRubricOpen(false)} onOk={saveRubric} okLabel="Save as v4.1" okDisabled={total !== 100} />}>
          {RUBRIC.map((r) => (
            <Field key={r.name} label={r.name}>
              <input type="number" min={r.name === "Disclosure given" || r.name === "Consent captured" ? 15 : 0} max={40} value={weights[r.name]} onChange={(e) => setWeights((w) => ({ ...w, [r.name]: Number(e.target.value) }))} className={inputClass} />
            </Field>
          ))}
          <p className={cn("text-xs", total === 100 ? "text-emerald-600" : "text-red-600")}>Total {total}%{total !== 100 && ", must be 100"}</p>
        </Modal>
      )}
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
