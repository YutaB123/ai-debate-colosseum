"use client";
import { useEffect, useRef } from "react";

export interface SpeakArgs {
  voiceUri: string;
  text: string;
  active: boolean;
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

// Speaks `text` aloud as it grows. Debounces by 600ms so we don't fragment words
// during streaming, and don't require `active` to ever be true within a render
// (React often batches turn_start → chunks → turn_end into a single update).
export function useSpeak(args: SpeakArgs) {
  const lastSpokenUpTo = useRef(0);
  const prevTextLen = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

    // Text shrunk → new speech started; reset cursor and cancel any pending flush.
    if (args.text.length < prevTextLen.current) {
      lastSpokenUpTo.current = 0;
    }
    prevTextLen.current = args.text.length;

    if (timer.current) clearTimeout(timer.current);
    if (args.text.length <= lastSpokenUpTo.current) return;

    timer.current = setTimeout(() => {
      const newText = args.text.slice(lastSpokenUpTo.current).trim();
      if (!newText) return;
      const voices = window.speechSynthesis.getVoices();
      const voice = args.voiceUri ? voices.find((v) => v.voiceURI === args.voiceUri) : undefined;
      const u = new SpeechSynthesisUtterance(newText);
      if (voice) u.voice = voice;
      window.speechSynthesis.speak(u);
      lastSpokenUpTo.current = args.text.length;
    }, 600);

    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [args.text, args.voiceUri]);
}
