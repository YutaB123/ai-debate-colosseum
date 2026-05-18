"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Debater } from "../types";

export interface NarratableSpeech {
  debaterId: string;
  text: string;
}

export interface NarratorState {
  /** Index into the speeches array currently being voiced, or -1 if idle. */
  speakingIndex: number;
  /** Index of the last speech that finished playing (so transcript shows everything up to this). */
  playedThrough: number;
  /** Character position within the current utterance (used to reveal text in sync with audio). */
  spokenChars: number;
}

/**
 * Centralized TTS narrator: plays speeches in order, one at a time,
 * and reports progress so the UI can stay in sync with the audio.
 */
export function useNarrator(speeches: NarratableSpeech[], debaters: Debater[]): NarratorState {
  const [state, setState] = useState<NarratorState>({ speakingIndex: -1, playedThrough: -1, spokenChars: 0 });

  // Keep latest collections accessible inside async callbacks without re-binding.
  const speechesRef = useRef(speeches);
  speechesRef.current = speeches;
  const debatersRef = useRef(debaters);
  debatersRef.current = debaters;

  const playedThroughRef = useRef(-1);
  const inFlightRef = useRef(false);
  const fallbackTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastBoundaryAtRef = useRef(0);

  const clearFallback = () => {
    if (fallbackTimerRef.current) {
      clearInterval(fallbackTimerRef.current);
      fallbackTimerRef.current = null;
    }
  };

  const speakNext = useCallback(() => {
    if (inFlightRef.current) return;
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      // No TTS — just play through silently at reading pace so the transcript still reveals.
      revealNextWithoutAudio();
      return;
    }
    const nextIndex = playedThroughRef.current + 1;
    if (nextIndex >= speechesRef.current.length) return;

    const speech = speechesRef.current[nextIndex];
    const debater = debatersRef.current.find((d) => d.id === speech.debaterId);
    if (!debater || !speech.text) {
      playedThroughRef.current = nextIndex;
      setState({ speakingIndex: -1, playedThrough: nextIndex, spokenChars: 0 });
      speakNext();
      return;
    }

    const utter = new SpeechSynthesisUtterance(speech.text);
    if (debater.voiceUri) {
      const v = window.speechSynthesis.getVoices().find((vc) => vc.voiceURI === debater.voiceUri);
      if (v) utter.voice = v;
    }
    utter.rate = 1.0;

    inFlightRef.current = true;
    setState({ speakingIndex: nextIndex, playedThrough: playedThroughRef.current, spokenChars: 0 });

    let endedNaturally = false;

    utter.onstart = () => {
      lastBoundaryAtRef.current = Date.now();
      // Fallback: if boundary events never fire, advance spokenChars on a timer.
      clearFallback();
      const charsPerSec = 14; // approximate speech rate
      fallbackTimerRef.current = setInterval(() => {
        // If a real boundary event fired recently, skip — TTS is driving.
        if (Date.now() - lastBoundaryAtRef.current < 300) return;
        setState((s) => {
          if (s.speakingIndex !== nextIndex) return s;
          const next = Math.min(s.spokenChars + Math.round(charsPerSec * 0.1), speech.text.length);
          return { ...s, spokenChars: next };
        });
      }, 100);
    };

    utter.onboundary = (e: SpeechSynthesisEvent) => {
      lastBoundaryAtRef.current = Date.now();
      const pos = (e.charIndex ?? 0) + ((e as any).charLength ?? 1);
      setState((s) => (s.speakingIndex === nextIndex ? { ...s, spokenChars: pos } : s));
    };

    utter.onend = () => {
      endedNaturally = true;
      clearFallback();
      playedThroughRef.current = nextIndex;
      inFlightRef.current = false;
      setState({ speakingIndex: -1, playedThrough: nextIndex, spokenChars: 0 });
      speakNext();
    };
    utter.onerror = () => {
      if (endedNaturally) return;
      clearFallback();
      playedThroughRef.current = nextIndex;
      inFlightRef.current = false;
      setState({ speakingIndex: -1, playedThrough: nextIndex, spokenChars: 0 });
      speakNext();
    };

    window.speechSynthesis.speak(utter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const revealNextWithoutAudio = useCallback(() => {
    const nextIndex = playedThroughRef.current + 1;
    if (nextIndex >= speechesRef.current.length) return;
    inFlightRef.current = true;
    const speech = speechesRef.current[nextIndex];
    setState({ speakingIndex: nextIndex, playedThrough: playedThroughRef.current, spokenChars: 0 });
    const charsPerSec = 18;
    let pos = 0;
    const id = setInterval(() => {
      pos = Math.min(pos + Math.round(charsPerSec * 0.1), speech.text.length);
      setState((s) => (s.speakingIndex === nextIndex ? { ...s, spokenChars: pos } : s));
      if (pos >= speech.text.length) {
        clearInterval(id);
        playedThroughRef.current = nextIndex;
        inFlightRef.current = false;
        setState({ speakingIndex: -1, playedThrough: nextIndex, spokenChars: 0 });
        revealNextWithoutAudio();
      }
    }, 100);
  }, []);

  useEffect(() => {
    speakNext();
  }, [speeches.length, speakNext]);

  // On unmount, cancel any in-flight utterance.
  useEffect(() => {
    return () => {
      clearFallback();
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  return state;
}
