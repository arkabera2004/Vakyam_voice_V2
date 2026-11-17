// Merges a call's resolved agent_versions row (set by start_call()) over the
// seed prompt.ts defaults. Pure, so it is testable without Deno or network;
// kept separate from index.ts, which does the REST lookup.

import { FIRST_MESSAGE, INSTRUCTIONS, TEXT_INSTRUCTIONS } from "./prompt.ts";

export type AgentVersionRow = { prompt: string | null; first_message: string | null; voice: string | null } | null | undefined;

export type ResolvedAgentConfig = {
  firstMessage: string;
  /** For the audio-voice path (the model speaks with its own voice). */
  instructions: string;
  /** For the text + Azure Speech path. */
  textInstructions: string;
  /** Only set when the stored value is a real Azure neural voice id (xx-XX-NameNeural); a cosmetic label like "aarti" leaves this undefined so env configuration decides, since agent_versions.voice was not designed to hold a real Azure identifier. */
  voiceOverride: string | undefined;
};

const AZURE_VOICE_PATTERN = /^[a-z]{2}-[A-Z]{2}-\w+Neural$/;

export function isAzureVoiceName(value: string | null | undefined): value is string {
  return !!value && AZURE_VOICE_PATTERN.test(value);
}

/** An empty or missing field falls back to the prompt.ts seed rather than producing a blank prompt. */
export function resolveAgentConfig(agentVersion: AgentVersionRow): ResolvedAgentConfig {
  const prompt = agentVersion?.prompt?.trim();
  const firstMessage = agentVersion?.first_message?.trim();
  return {
    firstMessage: firstMessage || FIRST_MESSAGE,
    instructions: prompt || INSTRUCTIONS,
    textInstructions: prompt || TEXT_INSTRUCTIONS,
    voiceOverride: isAzureVoiceName(agentVersion?.voice) ? agentVersion?.voice : undefined,
  };
}
