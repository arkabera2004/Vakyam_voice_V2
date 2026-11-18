import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Btn, IconTile, PageTitle, Panel, PanelHeader, Pill, Td, Th } from "@/console/ui";
import { Dropdown } from "@/console/Dropdown";
import { Modal, Field, inputClass, ModalActions } from "@/console/Modal";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOrg } from "@/hooks/useOrg";
import { can } from "@/domain/roles";
import { downloadCsv } from "@/console/export";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const RANGES = ["Last 7 days", "Last 30 days", "Today"] as const;
type Range = (typeof RANGES)[number];
const RANGE_DAYS: Record<Range, number> = { "Today": 1, "Last 7 days": 7, "Last 30 days": 30 };

type FlaggedEvaluation = {
  id: string;
  callId: string;
  callerName: string;
  overallScore: number | null;
  assignedReviewerId: string | null;
  reviewCount: number;
  createdAt: string;
};
type CriterionAverage = { criterionId: string; name: string; average: number; count: number };
type Reviewer = { userId: string; name: string };

const scoreTone = (s: number) => (s >= 95 ? "bg-emerald-50 text-emerald-700" : s >= 90 ? "bg-emerald-50/60 text-emerald-700" : s >= 85 ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-700");
const since = (days: number) => new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

/** Real evaluations and evaluation_scores, no localStorage. Degrades to empty states before the migration is applied or if the org has no evaluations yet. */
export default function QAScorecards() {
  const me = useOrg();
  const { user } = useAuth();
  const navigate = useNavigate();
  const canReview = can(me.role, "evaluations.review");

  const [range, setRange] = useState<Range>("Last 7 days");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [flagged, setFlagged] = useState<FlaggedEvaluation[]>([]);
  const [criteria, setCriteria] = useState<CriterionAverage[]>([]);
  const [reviewers, setReviewers] = useState<Reviewer[]>([]);
  const [showAll, setShowAll] = useState(false);
  const [rubricOpen, setRubricOpen] = useState(false);
  const [reviewTarget, setReviewTarget] = useState<FlaggedEvaluation | null>(null);

  const load = useCallback(async () => {
    if (!me.orgId) {
      setFlagged([]);
      setCriteria([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(null);
    const sinceIso = since(RANGE_DAYS[range]);

    const [evalResult, scoresResult, membersResult] = await Promise.all([
      supabase.from("evaluations").select("id, call_id, overall_score, flagged, assigned_reviewer_id, created_at, calls(caller_name)").eq("org_id", me.orgId).gte("created_at", sinceIso).order("created_at", { ascending: false }),
      supabase.from("evaluation_scores").select("score, criterion_id, evaluation_criteria(name), evaluations(org_id, created_at)").eq("org_id", me.orgId),
      supabase.from("org_members").select("user_id, role").eq("org_id", me.orgId),
    ]);

    if (evalResult.error) {
      setLoadError(evalResult.error.message);
      setLoading(false);
      return;
    }
    const evalRows = evalResult.data ?? [];
    const evaluationIds = evalRows.map((e) => e.id);
    const { data: reviewRows } = evaluationIds.length
      ? await supabase.from("evaluation_reviews").select("evaluation_id").in("evaluation_id", evaluationIds)
      : { data: [] as { evaluation_id: string }[] };
    const reviewCountByEval = new Map<string, number>();
    for (const r of reviewRows ?? []) reviewCountByEval.set(r.evaluation_id, (reviewCountByEval.get(r.evaluation_id) ?? 0) + 1);

    setFlagged(
      evalRows
        .filter((e) => e.flagged)
        .map((e) => ({
          id: e.id,
          callId: e.call_id,
          callerName: e.calls?.caller_name || "Unknown caller",
          overallScore: e.overall_score,
          assignedReviewerId: e.assigned_reviewer_id,
          reviewCount: reviewCountByEval.get(e.id) ?? 0,
          createdAt: e.created_at,
        })),
    );

    if (!scoresResult.error) {
      const sinceTime = new Date(sinceIso).getTime();
      const byCriterion = new Map<string, { name: string; total: number; count: number }>();
      for (const row of scoresResult.data ?? []) {
        const createdAt = row.evaluations?.created_at;
        if (!createdAt || new Date(createdAt).getTime() < sinceTime) continue;
        const name = row.evaluation_criteria?.name ?? "Unknown criterion";
        const entry = byCriterion.get(row.criterion_id) ?? { name, total: 0, count: 0 };
        entry.total += row.score;
        entry.count += 1;
        byCriterion.set(row.criterion_id, entry);
      }
      setCriteria([...byCriterion.entries()].map(([criterionId, v]) => ({ criterionId, name: v.name, average: Math.round((v.total / v.count) * 10) / 10, count: v.count })));
    }

    const reviewerUserIds = (membersResult.data ?? []).map((m) => m.user_id);
    const { data: profileRows } = reviewerUserIds.length
      ? await supabase.from("profiles").select("user_id, display_name, email").in("user_id", reviewerUserIds)
      : { data: [] as { user_id: string; display_name: string | null; email: string | null }[] };
    const profileByUser = new Map((profileRows ?? []).map((p) => [p.user_id, p]));
    setReviewers(
      (membersResult.data ?? [])
        .filter((m) => can(m.role, "evaluations.review"))
        .map((m) => {
          const p = profileByUser.get(m.user_id);
          return { userId: m.user_id, name: p?.display_name?.trim() || p?.email?.split("@")[0] || "Reviewer" };
        }),
    );
    setLoading(false);
  }, [me.orgId, range]);

  useEffect(() => {
    if (!me.loading) void load();
  }, [me.loading, load]);

  const assign = async (evaluationId: string, reviewerId: string | null) => {
    const { error } = await supabase.rpc("assign_evaluation_reviewer", { target_evaluation_id: evaluationId, new_reviewer_id: reviewerId });
    if (error) return toast({ variant: "destructive", title: "Could not assign the reviewer", description: error.message });
    void load();
  };

  const exportReport = () => {
    downloadCsv(`qa-report-${range.toLowerCase().replace(/\s+/g, "-")}.csv`, [
      ["Criterion", "Average score", "Scored calls"], ...criteria.map((c) => [c.name, c.average, c.count]), [],
      ["Call", "Caller", "Overall score", "Reviewer", "Reviewed"], ...flagged.map((f) => [f.callId, f.callerName, f.overallScore ?? "", reviewers.find((r) => r.userId === f.assignedReviewerId)?.name ?? "Unassigned", f.reviewCount > 0 ? "Yes" : "No"]),
    ]);
    toast({ title: "QA report exported", description: `${flagged.length} flagged calls and criterion averages, ${range.toLowerCase()}.` });
  };

  const rows = showAll ? flagged : flagged.slice(0, 6);
  const unassigned = flagged.filter((f) => !f.assignedReviewerId).length;
  const scored = flagged.filter((f) => f.overallScore != null);
  const avgScore = scored.length ? Math.round((scored.reduce((s, f) => s + (f.overallScore ?? 0), 0) / scored.length) * 10) / 10 : null;

  return (
    <>
      <PageTitle
        crumb="Govern / Quality across calls"
        title="QA scorecards"
        actions={
          <>
            <Dropdown value={range} options={RANGES} onChange={setRange} />
            <Btn onClick={() => setRubricOpen(true)}>View rubric</Btn>
            <Btn variant="dark" onClick={exportReport} disabled={loading}>Export report</Btn>
          </>
        }
      />

      {!me.orgId && !me.loading && <Panel className="p-4 text-sm text-zinc-600">You do not belong to an organisation yet.</Panel>}

      {me.orgId && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi emoji="📊" label="Average flagged score" value={avgScore != null ? avgScore.toFixed(1) : "—"} sub={`${scored.length} scored`} />
            <Kpi emoji="🚩" label="Flagged for review" value={<span className="text-red-600">{flagged.length}</span>} sub={`${range.toLowerCase()}`} />
            <Kpi emoji="🧑‍💻" label="Unassigned" value={unassigned} sub="need a reviewer" />
            <Kpi emoji="✅" label="Reviewed" value={flagged.filter((f) => f.reviewCount > 0).length} sub="of flagged" />
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1.4fr]">
            <Panel className="overflow-x-auto">
              <PanelHeader title="Average score by criterion" hint={range.toLowerCase()} />
              {loading ? (
                <p className="px-4 py-8 text-sm text-zinc-500">Loading…</p>
              ) : criteria.length === 0 ? (
                <p className="px-4 py-8 text-sm text-zinc-500">No scored calls yet for {range.toLowerCase()}.</p>
              ) : (
                <table className="w-full">
                  <thead className="bg-zinc-50"><tr><Th>Criterion</Th><Th className="text-right">Average</Th><Th className="text-right">Scored</Th></tr></thead>
                  <tbody>
                    {criteria.map((c) => (
                      <tr key={c.criterionId} className="border-t border-zinc-100">
                        <Td>{c.name}</Td>
                        <Td className="text-right"><span className={cn("inline-flex h-7 min-w-10 items-center justify-center rounded-md px-2 text-sm font-medium", scoreTone(c.average))}>{c.average}</span></Td>
                        <Td className="text-right text-zinc-500">{c.count}</Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Panel>

            <Panel className="overflow-x-auto">
              <PanelHeader title="Flagged calls" hint="Below the rubric's pass threshold" right={<Pill tone="red">{flagged.length} open</Pill>} />
              {loadError ? (
                <p className="px-4 py-8 text-sm text-red-600">Could not load: {loadError}</p>
              ) : loading ? (
                <p className="px-4 py-8 text-sm text-zinc-500">Loading…</p>
              ) : (
                <table className="w-full min-w-[640px]">
                  <thead className="bg-zinc-50"><tr><Th>Caller</Th><Th>Score</Th><Th>Reviewer</Th><Th>Status</Th><Th /></tr></thead>
                  <tbody>
                    {rows.map((f) => (
                      <tr key={f.id} className="border-t border-zinc-100">
                        <Td className="font-medium">{f.callerName}</Td>
                        <Td>{f.overallScore != null && <span className={cn("rounded px-1.5 py-0.5 text-xs font-semibold", f.overallScore < 65 ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700")}>{f.overallScore}</span>}</Td>
                        <Td className="py-1">
                          {canReview ? (
                            <select value={f.assignedReviewerId ?? ""} onChange={(e) => assign(f.id, e.target.value || null)} aria-label={`Reviewer for ${f.callerName}`} className={cn("h-8 rounded-md border border-transparent bg-transparent pr-1 text-sm hover:border-zinc-200", !f.assignedReviewerId && "text-zinc-400")}>
                                <option value="">Unassigned</option>
                                {reviewers.map((r) => <option key={r.userId} value={r.userId}>{r.name}{r.userId === user?.id ? " (you)" : ""}</option>)}
                              </select>
                          ) : (
                            <span className="text-sm text-zinc-500">{reviewers.find((r) => r.userId === f.assignedReviewerId)?.name ?? "Unassigned"}</span>
                          )}
                        </Td>
                        <Td>{f.reviewCount > 0 ? <Pill tone="green">Reviewed</Pill> : <Pill tone="amber">Pending</Pill>}</Td>
                        <Td className="text-right">
                          <span className="inline-flex gap-1">
                            {canReview && <Btn size="sm" onClick={() => setReviewTarget(f)}>Review</Btn>}
                            <Btn size="sm" onClick={() => navigate(`/console/review?call=${f.callId}`)}>Open</Btn>
                          </span>
                        </Td>
                      </tr>
                    ))}
                    {rows.length === 0 && <tr><Td colSpan={5} className="py-8 text-center text-zinc-500">No flagged calls for {range.toLowerCase()}.</Td></tr>}
                  </tbody>
                </table>
              )}
              {flagged.length > 6 && (
                <div className="flex items-center justify-between border-t border-zinc-100 px-4 py-3 text-xs">
                  <span className="text-zinc-500">Showing {rows.length} of {flagged.length}</span>
                  <button className="font-medium text-[#E2703A]" onClick={() => setShowAll((v) => !v)}>{showAll ? "Show fewer" : "View all flagged calls"}</button>
                </div>
              )}
            </Panel>
          </div>
        </>
      )}

      {rubricOpen && (
        <Modal title="Rubric criteria" hint="Weights for the active evaluation template. Editing weights on a live template would change the meaning of past scores, so this is read-only; a new template version is the correct way to change them." onClose={() => setRubricOpen(false)} footer={<Btn size="sm" onClick={() => setRubricOpen(false)}>Close</Btn>}>
          {criteria.length === 0 ? (
            <p className="text-sm text-zinc-500">No criteria have been scored yet in {range.toLowerCase()}.</p>
          ) : (
            criteria.map((c) => (
              <div key={c.criterionId} className="flex items-center justify-between border-b border-zinc-100 py-2 text-sm last:border-0">
                <span>{c.name}</span>
                <span className="font-medium">{c.average} avg · {c.count} scored</span>
              </div>
            ))
          )}
        </Modal>
      )}

      {reviewTarget && <ReviewModal evaluation={reviewTarget} onClose={() => setReviewTarget(null)} onDone={() => { setReviewTarget(null); void load(); }} />}
    </>
  );
}

function ReviewModal({ evaluation, onClose, onDone }: { evaluation: FlaggedEvaluation; onClose: () => void; onDone: () => void }) {
  const [scores, setScores] = useState<{ criterion: string; score: number; rationale: string }[]>([]);
  const [loadingScores, setLoadingScores] = useState(true);
  const [comment, setComment] = useState("");
  const [overrideOverall, setOverrideOverall] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void (async () => {
      const { data } = await supabase.from("evaluation_scores").select("score, rationale, evaluation_criteria(name)").eq("evaluation_id", evaluation.id);
      setScores((data ?? []).map((d) => ({ criterion: d.evaluation_criteria?.name ?? "Criterion", score: d.score, rationale: d.rationale })));
      setLoadingScores(false);
    })();
  }, [evaluation.id]);

  const submit = async () => {
    setBusy(true);
    const override = overrideOverall.trim() ? Number(overrideOverall) : null;
    const { error } = await supabase.rpc("add_evaluation_review", { evaluation_id: evaluation.id, comment, override_overall: override });
    setBusy(false);
    if (error) return toast({ variant: "destructive", title: "Could not add the review", description: error.message });
    toast({ title: "Review added", description: "The original evaluation keeps its own score; your review is recorded alongside it." });
    onDone();
  };

  return (
    <Modal title={`Review: ${evaluation.callerName}`} hint="Adding a review never changes the original evaluation score." onClose={onClose} footer={<ModalActions onCancel={onClose} onOk={submit} okLabel={busy ? "Saving…" : "Add review"} okDisabled={busy} />}>
      {loadingScores ? (
        <p className="text-sm text-zinc-500">Loading scores…</p>
      ) : (
        <div className="mb-3 space-y-1.5 rounded-lg bg-zinc-50 p-3 text-sm">
          {scores.map((s, i) => (
            <div key={i} className="flex items-center justify-between"><span>{s.criterion}</span><span className="font-medium">{s.score}</span></div>
          ))}
          {scores.length === 0 && <p className="text-zinc-500">No per-criterion scores found.</p>}
        </div>
      )}
      <Field label="Comment"><textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={3} className={inputClass + " h-auto py-2"} /></Field>
      <Field label="Override overall score (optional)"><input type="number" min={0} max={100} value={overrideOverall} onChange={(e) => setOverrideOverall(e.target.value)} className={inputClass} placeholder={evaluation.overallScore != null ? String(evaluation.overallScore) : undefined} /></Field>
    </Modal>
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
