import { describe, expect, it } from "vitest";
import { FIRST_MESSAGE, INSTRUCTIONS, TEXT_INSTRUCTIONS } from "./prompt";
import { isAzureVoiceName, resolveAgentConfig } from "./agentConfig";

describe("isAzureVoiceName", () => {
  it("accepts a real Azure neural voice identifier", () => {
    expect(isAzureVoiceName("en-IN-AartiIndicNeural")).toBe(true);
    expect(isAzureVoiceName("hi-IN-SwaraNeural")).toBe(true);
  });

  it("rejects a cosmetic label, null, undefined or an empty string", () => {
    expect(isAzureVoiceName("aarti")).toBe(false);
    expect(isAzureVoiceName("")).toBe(false);
    expect(isAzureVoiceName(null)).toBe(false);
    expect(isAzureVoiceName(undefined)).toBe(false);
  });
});

describe("resolveAgentConfig", () => {
  it("falls back to the prompt.ts seed when there is no agent version", () => {
    expect(resolveAgentConfig(null)).toEqual({
      firstMessage: FIRST_MESSAGE,
      instructions: INSTRUCTIONS,
      textInstructions: TEXT_INSTRUCTIONS,
      voiceOverride: undefined,
    });
    expect(resolveAgentConfig(undefined)).toEqual(resolveAgentConfig(null));
  });

  it("falls back when the stored prompt or first message is blank or whitespace-only", () => {
    const blank = resolveAgentConfig({ prompt: "   ", first_message: "", voice: null });
    expect(blank.instructions).toBe(INSTRUCTIONS);
    expect(blank.textInstructions).toBe(TEXT_INSTRUCTIONS);
    expect(blank.firstMessage).toBe(FIRST_MESSAGE);
  });

  it("uses a real published prompt and first message for both instruction variants", () => {
    const custom = resolveAgentConfig({ prompt: "Be concise.", first_message: "Hello there!", voice: null });
    expect(custom.instructions).toBe("Be concise.");
    expect(custom.textInstructions).toBe("Be concise.");
    expect(custom.firstMessage).toBe("Hello there!");
  });

  it("only overrides the voice with a real Azure voice identifier, not a cosmetic label", () => {
    expect(resolveAgentConfig({ prompt: null, first_message: null, voice: "en-IN-AartiIndicNeural" }).voiceOverride).toBe("en-IN-AartiIndicNeural");
    expect(resolveAgentConfig({ prompt: null, first_message: null, voice: "aarti" }).voiceOverride).toBeUndefined();
    expect(resolveAgentConfig({ prompt: null, first_message: null, voice: null }).voiceOverride).toBeUndefined();
  });
});
