import { describe, expect, it } from "vitest";
import { searchConsole } from "./search";

describe("searchConsole", () => {
  it("returns nothing for blank input", () => {
    expect(searchConsole("   ")).toEqual([]);
  });

  it("finds a live call by id and by caller name, case-insensitively", () => {
    expect(searchConsole("4821")[0]).toMatchObject({ kind: "Call", to: "/console/live/4821" });
    expect(searchConsole("priya")[0]).toMatchObject({ kind: "Caller", title: "Priya Sharma" });
  });

  it("finds tool verbs typed with spaces, and pages", () => {
    expect(searchConsole("check avail")[0]).toMatchObject({ kind: "Tool", title: "check_availability" });
    expect(searchConsole("compliance")[0]).toMatchObject({ kind: "Page", to: "/console/compliance" });
  });

  it("caps results at 8", () => {
    expect(searchConsole("a").length).toBeLessThanOrEqual(8);
  });
});
