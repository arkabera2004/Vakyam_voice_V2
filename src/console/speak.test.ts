import { describe, expect, it } from "vitest";
import { pickVoice } from "./speak";

const v = (name: string, lang: string) => ({ name, lang }) as SpeechSynthesisVoice;

describe("pickVoice", () => {
  it("prefers an exact Indian locale, then the language, then any Indian voice", () => {
    const voices = [v("US", "en-US"), v("Lekha", "hi-IN"), v("Rishi", "en-IN"), v("Other", "fr-FR")];
    expect(pickVoice(voices, "HI")?.name).toBe("Lekha");
    expect(pickVoice(voices, "EN")?.name).toBe("Rishi");
    expect(pickVoice([v("US", "en-US")], "EN")?.name).toBe("US");
    expect(pickVoice([v("Rishi", "en-IN")], "HI")?.name).toBe("Rishi");
    expect(pickVoice([], "HI")).toBeUndefined();
  });
});
