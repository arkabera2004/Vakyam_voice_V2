import { LIVE_CALLS, type LiveCall } from "./data/calls";
import { NAV } from "./nav";

export type SearchHit = { kind: "Call" | "Caller" | "Tool" | "Page"; title: string; sub: string; to: string };

const TOOLS = ["lookup_caller", "check_availability", "place_hold", "create_case", "log_call", "handoff"];
const REVIEWED = [{ id: 4790, name: "Anita Iyer", tier: "Gold" }];

/** Pure search over calls, callers, tool verbs and pages. Case-insensitive, prefix or substring. */
export function searchConsole(query: string, calls: LiveCall[] = LIVE_CALLS): SearchHit[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const hits: SearchHit[] = [];

  for (const c of calls) {
    if (String(c.id).includes(q)) hits.push({ kind: "Call", title: `Call ${c.id}`, sub: `${c.name}, live ${c.elapsed}`, to: `/console/live/${c.id}` });
    if (c.name.toLowerCase().includes(q)) hits.push({ kind: "Caller", title: c.name, sub: `${c.tier}, ${c.lang}, on call ${c.elapsed}`, to: `/console/live/${c.id}` });
  }
  for (const r of REVIEWED) {
    if (String(r.id).includes(q) || r.name.toLowerCase().includes(q)) hits.push({ kind: "Call", title: `Call ${r.id}`, sub: `${r.name}, ${r.tier}, reviewed`, to: "/console/review" });
  }
  for (const t of TOOLS) {
    if (t.includes(q.replace(/\s+/g, "_"))) hits.push({ kind: "Tool", title: t, sub: "Tool verb, see adapters and latency", to: "/console/tools" });
  }
  for (const g of NAV) for (const it of g.items) {
    if (it.label.toLowerCase().includes(q)) hits.push({ kind: "Page", title: it.label, sub: g.group ?? "Home", to: it.to });
  }
  return hits.slice(0, 8);
}
