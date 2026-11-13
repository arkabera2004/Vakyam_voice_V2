import { useState } from "react";
import { Link } from "react-router-dom";
import { Avatar, IconTile, PageTitle, Panel, SegmentBar } from "@/console/ui";
import { Dropdown } from "@/console/Dropdown";
import { LIVE_CALLS, type Sentiment } from "@/console/data/calls";
import { SORTS, sortCalls, type Sort } from "@/console/data/sortCalls";
import { cn } from "@/lib/utils";

const LINES = ["Club Mahindra member line", "All lines"] as const;

const sentimentClass: Record<Sentiment, string> = {
  Positive: "text-emerald-600",
  Neutral: "text-zinc-500",
  Frustrated: "text-red-600",
};

export default function LiveCalls() {
  const [line, setLine] = useState<(typeof LINES)[number]>(LINES[0]);
  const [sort, setSort] = useState<Sort>(SORTS[0]);
  const calls = sortCalls(LIVE_CALLS, sort); // shortcut: only one line has calls today, so the line filter changes nothing until more desks exist
  const frustrated = LIVE_CALLS.filter((c) => c.sentiment === "Frustrated").length;
  return (
    <>
      <PageTitle
        crumb="Operate"
        title="Live calls"
        actions={
          <>
            <Dropdown value={line} options={LINES} onChange={setLine} />
            <Dropdown value={sort} options={SORTS} onChange={setSort} prefix="Sort: " />
          </>
        }
      />

      <Panel className="grid grid-cols-2 divide-zinc-200 md:grid-cols-5 md:divide-x">
        <div className="flex items-center gap-3 p-4">
          <IconTile emoji="🎙️" />
          <div>
            <p className="text-lg font-semibold leading-tight">14 live</p>
            <p className="text-xs text-zinc-500">11 with Meera, 3 with humans</p>
          </div>
        </div>
        <Metric value="3m 51s" label="Average live duration" />
        <Metric value="58 / 42" label="Hindi to English mix, live" />
        <Metric value={<span className="text-red-600">{frustrated} frustrated</span>} label="Sentiment dropped in last minute" />
        <Metric value={<span className="text-emerald-600">0 sec</span>} label="Longest ring wait" />
      </Panel>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {calls.map((c) => (
          <Link
            key={c.id}
            to={`/console/live/${c.id}`}
            className={cn(
              "rounded-xl border bg-white p-4 transition-colors hover:border-zinc-300",
              c.sentiment === "Frustrated" && c.stepHot ? "border-[#E2703A] bg-[#FDF6F1]" : "border-zinc-200",
            )}
          >
            <div className="flex items-center gap-3">
              <Avatar name={c.name} size={32} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{c.name}</p>
                <p className="truncate text-xs text-zinc-500">{c.tier}, {c.lang}</p>
              </div>
              <span className="text-sm font-semibold tabular-nums">{c.elapsed}</span>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <SegmentBar segments={[{ value: c.hi, color: "#18181b" }, { value: 100 - c.hi, color: "#E2703A" }]} className="h-1.5" />
              <span className="shrink-0 text-[10px] text-zinc-500">HI {c.hi} EN {100 - c.hi}</span>
            </div>
            <div className="mt-3 flex items-center justify-between gap-2">
              <span className={cn("truncate rounded-md px-2 py-1 text-[11px]", c.stepHot ? "bg-orange-100 text-orange-800" : "bg-zinc-100 text-zinc-700")}>{c.step}</span>
              <span className={cn("shrink-0 text-xs font-medium", sentimentClass[c.sentiment])}>{c.sentiment}</span>
            </div>
          </Link>
        ))}
      </div>
      <p className="mt-4 text-xs text-zinc-500">Showing {calls.length} of 14 live calls. 2 more are connecting.</p>
    </>
  );
}

function Metric({ value, label }: { value: React.ReactNode; label: string }) {
  return (
    <div className="p-4">
      <p className="text-lg font-semibold leading-tight">{value}</p>
      <p className="text-xs text-zinc-500">{label}</p>
    </div>
  );
}
