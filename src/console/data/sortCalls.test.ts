import { describe, expect, it } from "vitest";
import { LIVE_CALLS } from "./calls";
import { sortCalls } from "./sortCalls";

describe("sortCalls", () => {
  it("puts frustrated callers with a hot step first", () => {
    const [first, second] = sortCalls(LIVE_CALLS, "needs attention first");
    expect(first.sentiment).toBe("Frustrated");
    expect(second.sentiment).toBe("Frustrated");
    expect(first.elapsed >= second.elapsed || first.stepHot).toBe(true);
  });

  it("orders by elapsed time in both directions without mutating the input", () => {
    const before = [...LIVE_CALLS];
    expect(sortCalls(LIVE_CALLS, "longest running")[0].elapsed).toBe("09:02");
    expect(sortCalls(LIVE_CALLS, "newest")[0].elapsed).toBe("00:48");
    expect(LIVE_CALLS).toEqual(before);
  });
});
