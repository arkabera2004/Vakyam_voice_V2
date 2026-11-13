import type { LiveCall } from "./calls";

export const SORTS = ["needs attention first", "longest running", "newest"] as const;
export type Sort = (typeof SORTS)[number];

const seconds = (mmss: string) => mmss.split(":").reduce((m, s) => m * 60 + Number(s), 0);
const urgency = (c: LiveCall) => (c.sentiment === "Frustrated" ? 2 : 0) + (c.stepHot ? 1 : 0);

export function sortCalls(calls: LiveCall[], sort: Sort): LiveCall[] {
  const by: Record<Sort, (a: LiveCall, b: LiveCall) => number> = {
    "needs attention first": (a, b) => urgency(b) - urgency(a) || seconds(b.elapsed) - seconds(a.elapsed),
    "longest running": (a, b) => seconds(b.elapsed) - seconds(a.elapsed),
    newest: (a, b) => seconds(a.elapsed) - seconds(b.elapsed),
  };
  return [...calls].sort(by[sort]);
}
