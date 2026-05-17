"use client";
import { useEffect, useRef } from "react";

export interface SpeakArgs {
  voiceUri: string;
  text: string; // full streamed text so far
  active: boolean; // only speak when this debater is the active speaker
}

export function extractSentences(buffer: string): { sentences: string[]; rest: string } {
  const sentences: string[] = [];
  const re = /([.!?])\s+/g;
  let lastIdx = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(buffer)) !== null) {
    const end = m.index + m[1].length;
    sentences.push(buffer.slice(lastIdx, end));
    lastIdx = m.index + m[0].length;
  }
  return { sentences: sentences.map((s) => s.trim()), rest: buffer.slice(lastIdx) };
}

export function useSpeak(args: SpeakArgs) {
  const lastSpokenUpTo = useRef(0);

  useEffect(() => {
    if (!args.active) return;
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

    const buf = args.text.slice(lastSpokenUpTo.current);
    const { sentences, rest } = extractSentences(buf);
    if (sentences.length === 0) return;

    const voices = window.speechSynthesis.getVoices();
    const voice = voices.find((v) => v.voiceURI === args.voiceUri);

    for (const s of sentences) {
      const u = new SpeechSynthesisUtterance(s);
      if (voice) u.voice = voice;
      window.speechSynthesis.speak(u);
    }
    lastSpokenUpTo.current = args.text.length - rest.length;
  }, [args.text, args.active, args.voiceUri]);

  useEffect(() => {
    if (!args.active && typeof window !== "undefined" && "speechSynthesis" in window) {
      // When this debater becomes inactive, cancel any leftover queued speech and reset cursor.
      lastSpokenUpTo.current = 0;
    }
  }, [args.active]);
}
