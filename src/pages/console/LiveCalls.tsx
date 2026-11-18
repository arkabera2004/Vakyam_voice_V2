import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Avatar, IconTile, PageTitle, Panel } from "@/console/ui";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/hooks/useOrg";
import { cn } from "@/lib/utils";

type LiveCall = { id: string; callerName: string; status: string; language: string | null; sentiment: string | null; startedAt: string };

const sentimentClass: Record<string, string> = { Positive: "text-emerald-600", Neutral: "text-zinc-500", Frustrated: "text-red-600" };

function elapsedSince(iso: string): string {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

/** Real calls where status is active or interrupted, for this organisation. No fleet-wide stats are shown: nothing in the schema backs a cross-org or demo-era 'desk' metric honestly. */
export default function LiveCalls() {
  const me = useOrg();
  const [calls, setCalls] = useState<LiveCall[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [, forceTick] = useState(0);

  const load = useCallback(async () => {
    if (!me.orgId) {
      setCalls([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(null);
    const { data, error } = await supabase.from("calls").select("id, caller_name, status, language, sentiment, started_at").eq("org_id", me.orgId).in("status", ["active", "interrupted"]).order("started_at", { ascending: false });
    if (error) {
      setLoadError(error.message);
      setLoading(false);
      return;
    }
    setCalls((data ?? []).map((c) => ({ id: c.id, callerName: c.caller_name || "Unknown caller", status: c.status, language: c.language, sentiment: c.sentiment, startedAt: c.started_at })));
    setLoading(false);
  }, [me.orgId]);

  useEffect(() => {
    if (!me.loading) void load();
  }, [me.loading, load]);

  // Re-render every second so each card's elapsed time ticks, without refetching.
  useEffect(() => {
    const id = window.setInterval(() => forceTick((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, []);

  const frustrated = calls.filter((c) => c.sentiment === "Frustrated").length;

  return (
    <>
      <PageTitle crumb="Operate" title="Live calls" />

      {!me.orgId && !me.loading && <Panel className="p-4 text-sm text-zinc-600">You do not belong to an organisation yet.</Panel>}
      {loadError && <Panel className="p-4 text-sm text-red-600">Could not load live calls: {loadError}</Panel>}

      {me.orgId && (
        <>
          <Panel className="flex items-center gap-3 p-4">
            <IconTile emoji="🎙️" />
            <div>
              <p className="text-lg font-semibold leading-tight">{loading ? "…" : calls.length} live</p>
              <p className="text-xs text-zinc-500">{loading ? "Loading" : frustrated > 0 ? `${frustrated} showing frustrated sentiment` : "No frustrated calls right now"}</p>
            </div>
          </Panel>

          {!loading && calls.length === 0 ? (
            <Panel className="mt-5 p-8 text-center text-sm text-zinc-500">No calls are live right now.</Panel>
          ) : (
            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {calls.map((c) => (
                <Link
                  key={c.id}
                  to={`/console/live/${c.id}`}
                  className={cn("rounded-xl border bg-white p-4 transition-colors hover:border-zinc-300", c.sentiment === "Frustrated" ? "border-[#E2703A] bg-[#FDF6F1]" : "border-zinc-200")}
                >
                  <div className="flex items-center gap-3">
                    <Avatar name={c.callerName} size={32} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{c.callerName}</p>
                      <p className="truncate text-xs text-zinc-500">{c.language ?? "Language not yet detected"}</p>
                    </div>
                    <span className="text-sm font-semibold tabular-nums">{elapsedSince(c.startedAt)}</span>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <span className={cn("truncate rounded-md px-2 py-1 text-[11px]", c.status === "interrupted" ? "bg-amber-100 text-amber-800" : "bg-zinc-100 text-zinc-700")}>{c.status}</span>
                    {c.sentiment && <span className={cn("shrink-0 text-xs font-medium", sentimentClass[c.sentiment] ?? "text-zinc-500")}>{c.sentiment}</span>}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </>
      )}
    </>
  );
}
