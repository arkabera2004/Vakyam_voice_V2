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
  /** Azure Speech text-to-speech voice id, used on the indianVoice (text + Speech) path. */
  speechVoiceOverride: string | undefined;
  /** gpt-realtime's own built-in voice name, used on the raw-audio realtime path. Azure Speech voice ids are a different namespace and never valid here. */
  realtimeVoiceOverride: string | undefined;
};

const AZURE_VOICE_PATTERN = /^[a-z]{2}-[A-Z]{2}-\w+Neural$/;

export function isAzureVoiceName(value: string | null | undefined): value is string {
  return !!value && AZURE_VOICE_PATTERN.test(value);
}

// agent_versions.voice holds whatever the Studio voice picker last set, which
// today is one of these short labels rather than a real Azure identifier
// (see the console's AgentStudio.tsx `pickVoice`). Mapping them here is what
// makes the picker actually affect a call instead of silently doing nothing.
const SPEECH_VOICE_LABELS: Record<string, string> = {
  aarti: "en-IN-AartiIndicNeural",
};
// gpt-realtime's own voice catalog is not independently verified here beyond
// the one name this codebase already uses as its hardcoded default
// (index.ts's `|| "marin"`); only that name is treated as known, rather than
// guessing at others that might not exist.
const KNOWN_REALTIME_VOICES = new Set(["marin"]);

function resolveVoice(voice: string | null | undefined): { speechVoiceOverride: string | undefined; realtimeVoiceOverride: string | undefined } {
  if (isAzureVoiceName(voice)) return { speechVoiceOverride: voice, realtimeVoiceOverride: undefined };
  if (voice && voice in SPEECH_VOICE_LABELS) return { speechVoiceOverride: SPEECH_VOICE_LABELS[voice], realtimeVoiceOverride: undefined };
  if (voice && KNOWN_REALTIME_VOICES.has(voice)) return { speechVoiceOverride: undefined, realtimeVoiceOverride: voice };
  return { speechVoiceOverride: undefined, realtimeVoiceOverride: undefined };
}

/** An empty or missing field falls back to the prompt.ts seed rather than producing a blank prompt. */
export function resolveAgentConfig(agentVersion: AgentVersionRow): ResolvedAgentConfig {
  const prompt = agentVersion?.prompt?.trim();
  const firstMessage = agentVersion?.first_message?.trim();
  const { speechVoiceOverride, realtimeVoiceOverride } = resolveVoice(agentVersion?.voice);
  return {
    firstMessage: firstMessage || FIRST_MESSAGE,
    instructions: prompt || INSTRUCTIONS,
    textInstructions: prompt || TEXT_INSTRUCTIONS,
    speechVoiceOverride,
    realtimeVoiceOverride,
  };
}
