import { useCallback, useEffect, useRef, useState } from "react";

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

/**
 * Browser speech for console previews (opening lines, dictionary, recordings).
 * shortcut: uses speechSynthesis, not the Azure voice Meera actually uses; swap for SpeechOutput once a token endpoint exists for the console.
 */
export function useSpeaker() {
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [lineIndex, setLineIndex] = useState(-1);
  const runRef = useRef(0);

  const stop = useCallback(() => {
    runRef.current += 1;
    window.speechSynthesis?.cancel();
    setPlayingId(null);
    setLineIndex(-1);
  }, []);

  useEffect(() => stop, [stop]);

  /** Speaks lines in order; calling with the id already playing stops it. */
  const play = useCallback(
    (id: string, lines: Line[], onLine?: (i: number) => void) => {
      if (playingId === id) return stop();
      stop();
      const synth = window.speechSynthesis;
      if (!synth || lines.length === 0) return;
      const run = runRef.current;
      setPlayingId(id);
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
    },
    [playingId, stop],
  );

  const supported = typeof window !== "undefined" && "speechSynthesis" in window;
  return { play, stop, playingId, lineIndex, supported };
}
