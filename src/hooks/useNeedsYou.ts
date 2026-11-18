import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "./useOrg";

export type FlaggedCall = { id: string; callId: string; callerName: string; overallScore: number | null; createdAt: string };

export type NeedsYou = { transfersRinging: number; flaggedUnreviewed: FlaggedCall[]; loading: boolean; reload: () => void };

/**
 * The two queue signals that are actually real today: ringing transfers and
 * flagged evaluations nobody has reviewed yet. Shared by Home.tsx's "Needs
 * you" table and ConsoleShell's sidebar badges, so both read the same count.
 * Unlike QAScorecards.tsx's reporting view, this has no date range -- a
 * flag from last month still needs a reviewer until one exists.
 */
export function useNeedsYou(): NeedsYou {
  const me = useOrg();
  const [transfersRinging, setTransfersRinging] = useState(0);
  const [flaggedUnreviewed, setFlaggedUnreviewed] = useState<FlaggedCall[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!me.orgId) {
      setTransfersRinging(0);
      setFlaggedUnreviewed([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const [transfersRes, evalRes] = await Promise.all([
      supabase.from("transfers").select("id", { count: "exact", head: true }).eq("org_id", me.orgId).eq("state", "ringing"),
      supabase.from("evaluations").select("id, call_id, overall_score, created_at, calls(caller_name)").eq("org_id", me.orgId).eq("flagged", true).order("created_at", { ascending: false }).limit(20),
    ]);
    setTransfersRinging(transfersRes.count ?? 0);
    const evalRows = evalRes.data ?? [];
    const evalIds = evalRows.map((e) => e.id);
    const { data: reviewRows } = evalIds.length
      ? await supabase.from("evaluation_reviews").select("evaluation_id").in("evaluation_id", evalIds)
      : { data: [] as { evaluation_id: string }[] };
    const reviewed = new Set((reviewRows ?? []).map((r) => r.evaluation_id));
    setFlaggedUnreviewed(
      evalRows
        .filter((e) => !reviewed.has(e.id))
        .map((e) => ({ id: e.id, callId: e.call_id, callerName: e.calls?.caller_name || "Unknown caller", overallScore: e.overall_score, createdAt: e.created_at })),
    );
    setLoading(false);
  }, [me.orgId]);

  useEffect(() => void load(), [load]);

  return { transfersRinging, flaggedUnreviewed, loading, reload: load };
}
