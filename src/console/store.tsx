import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

/** Everything the supervisor changes in the console, persisted per browser so a demo survives reloads. */
export type AuditRow = { when: string; who: string; change: string; version: string };
export type Campaign = { emoji: string; name: string; sub: string; dialed: number; total: number; connected: number; dlt: string; series: string; status: "Running" | "Scheduled" | "Completed" | "Paused" };
export type Source = { emoji: string; name: string; sub: string; live: boolean };
export type AdapterStatus = "Connected" | "Not connected" | "Degraded 1 retry" | "Planned" | "Testing";

export type ConsoleState = {
  decided: Record<string, string>; // needs-you item id -> outcome
  transfer: { state: "ringing" | "accepted" | "declined"; notes: string[] };
  calls: Record<number, { takenOver?: boolean; whisper?: boolean; barge?: boolean }>;
  reviewers: Record<number, string>;
  coaching: number[];
  callbackDone: boolean;
  liveVersion: string;
  dictionary: [string, string][];
  persona: { tone: string; handoff: string };
  voice: "aarti" | "marin";
  speed: number; // 0.8..1.3
  warmth: number; // 0..100
  adapters: Record<string, AdapterStatus>;
  campaigns: Campaign[];
  gates: Record<string, boolean>;
  sources: Source[];
  knowledgeDirty: boolean;
  knowledgeVersions: string[];
  pii: Record<string, boolean>;
  disclosure: { text: string; version: string };
  audit: AuditRow[];
  weeklyReport?: string;
};

export const DEFAULT_STATE: ConsoleState = {
  decided: {},
  transfer: { state: "ringing", notes: [] },
  calls: {},
  reviewers: { 4801: "Asha Nair", 4795: "Kavita Rao", 4783: "Asha Nair", 4768: "Kavita Rao" },
  coaching: [],
  callbackDone: false,
  liveVersion: "v7",
  dictionary: [
    ["Club Mahindra", "klub muh-HIN-dra"],
    ["Kumbhalgarh", "koom-bhul-GARH"],
    ["Lonavala", "lo-NAV-la"],
    ["Mussoorie", "moo-SOO-ree"],
    ["Member id 20418", "two, zero, four, one, eight (digit by digit)"],
  ],
  persona: { tone: "Warm and brief", handoff: "Refunds and upgrades" },
  voice: "aarti",
  speed: 1.05,
  warmth: 70,
  adapters: { Salesforce: "Connected", "Dynamics 365": "Connected", Zoho: "Not connected", LeadSquared: "Connected", Freshdesk: "Degraded 1 retry", HubSpot: "Not connected", Exotel: "Connected", Twilio: "Connected", "SIP trunk": "Connected", "Azure Communication Services": "Planned" },
  campaigns: [
    { emoji: "🌿", name: "Renewal reminder, Gold members", sub: "Hindi first, 4,200 contacts", dialed: 2730, total: 4200, connected: 1184, dlt: "CLBMHN", series: "160 service", status: "Running" },
    { emoji: "💬", name: "Stay feedback calls", sub: "Checked out in the last 3 days", dialed: 1120, total: 1850, connected: 548, dlt: "CLBMHN", series: "160 service", status: "Running" },
    { emoji: "🧥", name: "Winter offer, Platinum members", sub: "Promotional, starts tomorrow 09:00", dialed: 0, total: 960, connected: 0, dlt: "CLBMHP", series: "140 promotional", status: "Scheduled" },
    { emoji: "⏳", name: "Arrival reminder, Lonavala stays", sub: "Finished yesterday 20:40", dialed: 640, total: 640, connected: 402, dlt: "CLBMHN", series: "160 service", status: "Completed" },
  ],
  gates: { "Upgrade room type": true, "Refund above 25,000 rupees": true, "Waive cancellation fee": true, "Hold extension beyond 24 h": true, "Reschedule inside 48 h": false },
  sources: [
    { emoji: "📘", name: "Booking and cancellation", sub: "86 articles, updated 10 Nov, owner Kavita Rao", live: true },
    { emoji: "🏨", name: "Resort amenities", sub: "142 articles, updated 4 Nov, owner Asha Nair", live: true },
    { emoji: "🌿", name: "Member benefits", sub: "64 articles, updated 29 Oct, owner Kavita Rao", live: false },
    { emoji: "📒", name: "Billing", sub: "38 articles, updated 11 Nov, owner Asha Nair", live: true },
  ],
  knowledgeDirty: false,
  knowledgeVersions: ["11 Nov, 16:40 · Billing updated · Asha Nair", "10 Nov, 09:30 · Booking and cancellation updated · Kavita Rao", "6 Nov, 11:00 · Reschedule inside 48 h gate turned off · Kavita Rao"],
  pii: { "Phone number": true, "Card number": true, Aadhaar: true, "Email address": true },
  disclosure: { text: "Namaste, main Meera hoon, Club Mahindra ki AI assistant. Yeh call quality aur training ke liye record hoti hai. Kya aap is recording ke liye sahmat hain?", version: "v4.2" },
  audit: [
    { when: "12 Nov, 11:20", who: "Kavita Rao", change: "Opening disclosure approved", version: "v4.2" },
    { when: "11 Nov, 17:45", who: "Asha Nair", change: "Deletion request closed for Priya Sharma", version: "DR 214" },
    { when: "10 Nov, 09:12", who: "Kavita Rao", change: "Aadhaar redaction set to full", version: "PII 3" },
    { when: "8 Nov, 14:30", who: "System", change: "DLT consent registry sync completed", version: "Auto" },
    { when: "6 Nov, 10:05", who: "Kavita Rao", change: "Call audio retention set to 90 days", version: "RET 2" },
  ],
};

const KEY = "vakyam-console-v1";
export const SUPERVISOR = "Kavita Rao";

export function nowLabel(d = new Date()) {
  return `${d.getDate()} ${d.toLocaleString("en-IN", { month: "short" })}, ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function load(): ConsoleState {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...DEFAULT_STATE, ...JSON.parse(raw) } : DEFAULT_STATE;
  } catch {
    return DEFAULT_STATE;
  }
}

type Ctx = {
  state: ConsoleState;
  /** Shallow-merge a patch, or compute one from the previous state. */
  update: (patch: Partial<ConsoleState> | ((s: ConsoleState) => Partial<ConsoleState>)) => void;
  /** Prepend an audit row, as every governed change must. */
  log: (change: string, version: string, who?: string) => void;
  reset: () => void;
};

const ConsoleCtx = createContext<Ctx | null>(null);

export function ConsoleProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ConsoleState>(load);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      /* private mode: demo still works for this tab */
    }
  }, [state]);

  const update = useCallback<Ctx["update"]>((patch) => setState((s) => ({ ...s, ...(typeof patch === "function" ? patch(s) : patch) })), []);
  const log = useCallback<Ctx["log"]>((change, version, who = SUPERVISOR) => update((s) => ({ audit: [{ when: nowLabel(), who, change, version }, ...s.audit] })), [update]);
  const reset = useCallback(() => setState(DEFAULT_STATE), []);

  const value = useMemo(() => ({ state, update, log, reset }), [state, update, log, reset]);
  return <ConsoleCtx.Provider value={value}>{children}</ConsoleCtx.Provider>;
}

export function useConsole() {
  const ctx = useContext(ConsoleCtx);
  if (!ctx) throw new Error("useConsole must be used inside ConsoleProvider");
  return ctx;
}
