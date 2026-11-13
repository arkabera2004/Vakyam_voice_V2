import { describe, expect, it } from "vitest";
import { LIVE_CALLS } from "./calls";
import { transcriptFor } from "./transcripts";

describe("transcriptFor", () => {
  it("gives every live call an opening disclosure, a live turn and a tool trace", () => {
    for (const c of LIVE_CALLS) {
      const { turns, tools, next } = transcriptFor(c);
      expect(turns[0].text).toMatch(/record/);
      expect(turns.at(-1)?.live).toBe(true);
      expect(tools.length).toBeGreaterThan(0);
      expect(next.length).toBeGreaterThan(10);
    }
  });
  it("keeps Priya's scripted call and names the right resort elsewhere", () => {
    expect(transcriptFor(LIVE_CALLS.find((c) => c.id === 4821)!).turns[1].text).toMatch(/Lonavala/);
    const sunil = LIVE_CALLS.find((c) => c.name.startsWith("Sunil"))!;
    expect(transcriptFor(sunil).turns[1].text).toMatch(/Mussoorie/);
  });
});
