// Voice session state machine. Mirrored by public.advance_call() in
// supabase/migrations/20261117100000_voice_platform.sql; change both together.

export const SESSION_STATES = ["created", "initializing", "active", "interrupted", "completed", "failed", "cancelled", "abandoned"] as const;
export type SessionState = (typeof SESSION_STATES)[number];

export const TERMINAL_STATES: readonly SessionState[] = ["completed", "failed", "cancelled", "abandoned"];

const NEXT: Record<SessionState, readonly SessionState[]> = {
  created: ["initializing", "failed", "cancelled"],
  initializing: ["active", "failed", "cancelled"],
  active: ["interrupted", "completed", "failed", "cancelled", "abandoned"],
  interrupted: ["active", "completed", "failed", "cancelled", "abandoned"],
  completed: [],
  failed: [],
  cancelled: [],
  abandoned: [],
};

export function isTerminal(state: SessionState): boolean {
  return TERMINAL_STATES.includes(state);
}

/** True when `to` is a legal next state, or the same state (idempotent repeat). */
export function canTransition(from: SessionState, to: SessionState): boolean {
  return from === to || NEXT[from].includes(to);
}

export type TransitionResult = { ok: true; changed: boolean } | { ok: false; reason: string };

export function transition(from: SessionState, to: SessionState): TransitionResult {
  if (from === to) return { ok: true, changed: false };
  if (NEXT[from].includes(to)) return { ok: true, changed: true };
  return { ok: false, reason: isTerminal(from) ? `session is already ${from}` : `cannot go from ${from} to ${to}` };
}

/** Sessions silent for longer than this are abandoned by the sweeper, not by the browser. */
export const ABANDON_AFTER_MS = 15 * 60 * 1000;

export function shouldAbandon(state: SessionState, lastEventAt: Date, now = new Date()): boolean {
  return (state === "active" || state === "interrupted") && now.getTime() - lastEventAt.getTime() > ABANDON_AFTER_MS;
}
