import { useCallback, useEffect, useRef, useState } from "react";
import type { SpeechOutput } from "@/lib/speechOutput";

export type SpeakLang = "HI" | "EN";
const LOCALE: Record<SpeakLang, string> = { HI: "hi-IN", EN: "en-IN" };

/** Picks an Indian voice for the language when the browser has one, else the default. */
export function pickVoice(voices: SpeechSynthesisVoice[], lang: SpeakLang): SpeechSynthesisVoice | undefined {
  const locale = LOCALE[lang].toLowerCase();
  return (
    voices.find((v) => v.lang.toLowerCase() === locale) ??
    voices.find((v) => v.lang.toLowerCase().startsWith(locale.slice(0, 2))) ??
    voices.find((v) => v.lang.toLowerCase().endsWith("-in"))
  );
}

export type Line = { text: string; lang: SpeakLang; rate?: number };
export type Engine = "azure" | "browser";

/**
 * Speaks console previews (opening lines, dictionary, recordings) with Meera's
 * real Azure voice when the realtime-token function hands out a Speech token,
 * and the browser's own hi-IN / en-IN voices otherwise.
 */
export function useSpeaker() {
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [lineIndex, setLineIndex] = useState(-1);
  const [engine, setEngine] = useState<Engine | null>(null);
  const runRef = useRef(0);
  const azureRef = useRef<{ speech: SpeechOutput; context: AudioContext; speaking: boolean; waiters: (() => void)[] } | null>(null);

  const stop = useCallback(() => {
    runRef.current += 1;
    window.speechSynthesis?.cancel();
    azureRef.current?.speech.interrupt();
    setPlayingId(null);
    setLineIndex(-1);
  }, []);

  useEffect(
    () => () => {
      stop();
      azureRef.current?.speech.close();
      void azureRef.current?.context.close();
    },
    [stop],
  );

  /** One Azure session per page visit; null when the token endpoint has no Speech key. */
  const azure = useCallback(async () => {
    if (azureRef.current) return azureRef.current;
    try {
      const [{ requestSession }, { SpeechOutput }] = await Promise.all([import("@/hooks/useVoiceAgent"), import("@/lib/speechOutput")]);
      const { data } = await requestSession();
      if (!data?.speech) return null;
      const context = new AudioContext({ sampleRate: 24000 });
      const entry = { speech: null as unknown as SpeechOutput, context, speaking: false, waiters: [] as (() => void)[] };
      entry.speech = new SpeechOutput(data.speech, context, (speaking) => {
        entry.speaking = speaking;
        if (!speaking) entry.waiters.splice(0).forEach((w) => w());
      });
      azureRef.current = entry;
      return entry;
    } catch (e) {
      console.warn("Azure voice unavailable, using browser speech:", e);
      return null;
    }
  }, []);

  const speakBrowser = useCallback((run: number, lines: Line[], onLine?: (i: number) => void) => {
    const synth = window.speechSynthesis;
    if (!synth) return stop();
    const voices = synth.getVoices();
    lines.forEach((line, i) => {
      const u = new SpeechSynthesisUtterance(line.text);
      u.lang = LOCALE[line.lang];
      const voice = pickVoice(voices, line.lang);
      if (voice) u.voice = voice;
      u.rate = line.rate ?? 1;
      u.onstart = () => {
        if (runRef.current !== run) return;
        setLineIndex(i);
        onLine?.(i);
      };
      if (i === lines.length - 1) u.onend = () => runRef.current === run && stop();
      synth.speak(u);
    });
  }, [stop]);

  const speakAzure = useCallback(async (run: number, lines: Line[], onLine?: (i: number) => void) => {
    const az = await azure();
    if (runRef.current !== run) return;
    if (!az) {
      setEngine("browser");
      return speakBrowser(run, lines, onLine);
    }
    setEngine("azure");
    if (az.context.state === "suspended") await az.context.resume();
    for (let i = 0; i < lines.length; i++) {
      if (runRef.current !== run) return;
      setLineIndex(i);
      onLine?.(i);
      az.speech.addText(lines[i].text + " ");
      az.speech.finish();
      // wait for this line to finish before the next, so the highlight follows the audio
      await new Promise<void>((resolve) => {
        const check = () => (az.speaking ? az.waiters.push(resolve) : resolve());
        setTimeout(check, 150);
      });
    }
    if (runRef.current === run) stop();
  }, [azure, speakBrowser, stop]);

  /** Speaks lines in order; calling with the id already playing stops it. */
  const play = useCallback(
    (id: string, lines: Line[], onLine?: (i: number) => void) => {
      if (playingId === id) return stop();
      stop();
      if (lines.length === 0) return;
      const run = runRef.current;
      setPlayingId(id);
      void speakAzure(run, lines, onLine);
    },
    [playingId, stop, speakAzure],
  );

  const supported = typeof window !== "undefined" && ("speechSynthesis" in window || "AudioContext" in window);
  return { play, stop, playingId, lineIndex, supported, engine };
}
