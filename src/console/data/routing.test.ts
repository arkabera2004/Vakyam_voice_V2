import { describe, expect, it } from "vitest";
import { routeCall } from "./routing";

const base = { tier: "Gold" as const, hour: 14, lang: "Hindi" as const, queueWait: 5, intent: "Booking or hold" as const };

describe("routeCall", () => {
  it("checks rules top to bottom, first match wins", () => {
    expect(routeCall({ ...base, tier: "Platinum", hour: 23, queueWait: 40 }).rule).toBe(1);
    expect(routeCall({ ...base, hour: 23, queueWait: 40 }).rule).toBe(3);
    expect(routeCall({ ...base, queueWait: 40 }).rule).toBe(4);
    expect(routeCall(base).rule).toBe(2);
  });
  it("marks refunds and upgrades as ending with a human", () => {
    expect(routeCall({ ...base, intent: "Upgrade" }).thenHuman).toMatch(/warm transfer/);
    expect(routeCall(base).thenHuman).toBeUndefined();
  });
});
