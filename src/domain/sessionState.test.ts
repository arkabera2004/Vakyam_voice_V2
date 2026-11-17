import { describe, expect, it } from "vitest";
import { SESSION_STATES, TERMINAL_STATES, canTransition, isTerminal, shouldAbandon, transition } from "./sessionState";

describe("session state machine", () => {
  it("follows the happy path and allows interruption recovery", () => {
    expect(transition("created", "initializing")).toEqual({ ok: true, changed: true });
    expect(transition("initializing", "active")).toEqual({ ok: true, changed: true });
    expect(transition("active", "interrupted")).toEqual({ ok: true, changed: true });
    expect(transition("interrupted", "active")).toEqual({ ok: true, changed: true });
    expect(transition("active", "completed")).toEqual({ ok: true, changed: true });
  });

  it("is idempotent on a repeated state and refuses illegal jumps", () => {
    expect(transition("active", "active")).toEqual({ ok: true, changed: false });
    expect(transition("created", "completed").ok).toBe(false);
    expect(transition("created", "active").ok).toBe(false);
    expect(transition("completed", "active")).toEqual({ ok: false, reason: "session is already completed" });
    expect(transition("failed", "completed").ok).toBe(false);
  });

  it("can fail or be cancelled from any live state, and abandoned only once active", () => {
    for (const s of ["created", "initializing", "active", "interrupted"] as const) {
      expect(canTransition(s, "failed")).toBe(true);
      expect(canTransition(s, "cancelled")).toBe(true);
    }
    expect(canTransition("created", "abandoned")).toBe(false);
    expect(canTransition("initializing", "abandoned")).toBe(false);
    expect(canTransition("active", "abandoned")).toBe(true);
    expect(canTransition("interrupted", "abandoned")).toBe(true);
  });

  it("terminal states are exactly the four end states", () => {
    expect(SESSION_STATES.filter(isTerminal)).toEqual([...TERMINAL_STATES]);
  });

  it("abandons only live sessions that have been silent too long", () => {
    const t0 = new Date("2026-11-17T10:00:00Z");
    const later = new Date("2026-11-17T10:16:00Z");
    expect(shouldAbandon("active", t0, later)).toBe(true);
    expect(shouldAbandon("interrupted", t0, later)).toBe(true);
    expect(shouldAbandon("active", t0, new Date("2026-11-17T10:10:00Z"))).toBe(false);
    expect(shouldAbandon("created", t0, later)).toBe(false);
    expect(shouldAbandon("completed", t0, later)).toBe(false);
  });
});
