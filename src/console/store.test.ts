import { describe, expect, it } from "vitest";
import { DEFAULT_STATE, nowLabel } from "./store";

describe("console store defaults", () => {
  it("starts with every policy gate but reschedule on, and 4 of 4 PII redactions on", () => {
    const { gates, pii } = DEFAULT_STATE;
    expect(Object.values(gates).filter(Boolean)).toHaveLength(4);
    expect(gates["Reschedule inside 48 h"]).toBe(false);
    expect(Object.values(pii).every(Boolean)).toBe(true);
  });
  it("formats audit timestamps like the design, e.g. 12 Nov, 09:05", () => {
    expect(nowLabel(new Date(2026, 10, 12, 9, 5))).toBe("12 Nov, 09:05");
  });
});
