import { describe, expect, it } from "vitest";
import { greeting, istClock, istHour, todayLabel } from "./clock";

// 2026-11-12T08:40:00Z is 14:10 IST on Thursday 12 November.
const at = new Date("2026-11-12T08:40:00Z");

describe("clock", () => {
  it("renders the desk date in IST", () => {
    expect(todayLabel(at)).toBe("Thursday, 12 November, 14:10 IST");
    expect(istClock(at)).toBe("14:10");
    expect(istHour(at)).toBe(14);
  });
  it("greets by IST hour", () => {
    expect(greeting(at)).toBe("Good afternoon");
    expect(greeting(new Date("2026-11-12T02:00:00Z"))).toBe("Good morning"); // 07:30 IST
    expect(greeting(new Date("2026-11-12T13:00:00Z"))).toBe("Good evening"); // 18:30 IST
  });
});
