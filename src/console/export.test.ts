import { describe, expect, it } from "vitest";
import { csvCell, toCsv } from "./export";

describe("csv", () => {
  it("quotes cells with commas, quotes and newlines, leaves plain cells alone", () => {
    expect(csvCell("Rohan Mehta")).toBe("Rohan Mehta");
    expect(csvCell("Goa, 2BR")).toBe('"Goa, 2BR"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell("a\nb")).toBe('"a\nb"');
    expect(csvCell(null)).toBe("");
  });
  it("joins rows with a trailing newline", () => {
    expect(toCsv([["Call", "Score"], [4790, 92]])).toBe("Call,Score\n4790,92\n");
  });
});
