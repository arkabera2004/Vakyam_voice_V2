import { describe, expect, it } from "vitest";
import { answerPolicy } from "./policy";
import { DEFAULT_STATE } from "../store";

const gates = DEFAULT_STATE.gates;

describe("answerPolicy", () => {
  it("lets Meera reschedule outside 48 h, but defers inside 48 h only when that gate is on", () => {
    expect(answerPolicy("Can I move my Goa booking to next weekend?", gates).verdict).toBe("Allowed, no handoff");
    expect(answerPolicy("Can I move my booking to tomorrow?", gates).verdict).toBe("Allowed, no handoff");
    expect(answerPolicy("Can I move my booking to tomorrow?", { ...gates, "Reschedule inside 48 h": true }).verdict).toBe("Needs a human");
  });
  it("sends big refunds and upgrades to a human while those gates are on", () => {
    expect(answerPolicy("Mujhe 38,400 ka refund chahiye", gates).verdict).toBe("Needs a human");
    expect(answerPolicy("refund of 4,000 please", gates).verdict).toBe("Allowed, no handoff");
    expect(answerPolicy("Can I upgrade to a 2BR?", { ...gates, "Upgrade room type": false }).verdict).toBe("Allowed, no handoff");
  });
  it("cites a source every time", () => {
    expect(answerPolicy("anything else", gates).source.length).toBeGreaterThan(5);
  });
});
