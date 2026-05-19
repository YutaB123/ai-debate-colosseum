"use client";
import { useMemo } from "react";
import { useVoices } from "../lib/client/use-voices";

const PREVIEW_LINE = "Hello, this is my voice.";

// Common voice names exposed by Windows/macOS/Chrome/Edge speech synthesizers.
const FEMALE_NAMES = [
  "aria", "jenny", "samantha", "karen", "zira", "susan", "linda",
  "hazel", "sara", "eva", "catherine", "tessa", "allison", "victoria",
  "michelle", "fiona", "moira", "veena", "kate",
];

const MALE_NAMES = [
  "mark", "guy", "david", "daniel", "alex", "tom", "mike", "mateo",
  "george", "james", "brian", "ryan", "eric", "fred", "oliver",
  "rishi", "aaron", "arthur",
];

function classify(v: SpeechSynthesisVoice): "female" | "male" | "unknown" {
  const n = v.name.toLowerCase();
  if (FEMALE_NAMES.some((x) => n.includes(x))) return "female";
  if (MALE_NAMES.some((x) => n.includes(x))) return "male";
  return "unknown";
}

function pickSix(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice[] {
  const female: SpeechSynthesisVoice[] = [];
  const male: SpeechSynthesisVoice[] = [];
  const unknown: SpeechSynthesisVoice[] = [];

  for (const v of voices) {
    const g = classify(v);
    if (g === "female") female.push(v);
    else if (g === "male") male.push(v);
    else unknown.push(v);
  }

  // Take 3 of each gender, top up from the unknown bucket if a side is short.
  const out: SpeechSynthesisVoice[] = [];
  const takeF = female.slice(0, 3);
  const takeM = male.slice(0, 3);
  out.push(...takeF, ...takeM);
  if (out.length < 6) {
    for (const v of unknown) {
      if (out.length >= 6) break;
      if (!out.includes(v)) out.push(v);
    }
  }
  return out;
}

function previewVoice(voiceUri: string, voices: SpeechSynthesisVoice[]) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(PREVIEW_LINE);
  const v = voices.find((x) => x.voiceURI === voiceUri);
  if (v) u.voice = v;
  window.speechSynthesis.speak(u);
}

export function VoicePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const allEnglish = useVoices().filter((v) => v.lang.toLowerCase().startsWith("en"));
  const voices = useMemo(() => pickSix(allEnglish), [allEnglish]);

  if (voices.length === 0) {
    return <span className="text-xs text-gray-500">(no English voices available)</span>;
  }

  return (
    <span className="inline-flex items-center gap-1">
      <select
        className="border rounded px-2 py-1 text-sm"
        value={value}
        onChange={(e) => {
          const next = e.target.value;
          onChange(next);
          if (next) previewVoice(next, voices);
        }}
      >
        <option value="">— pick a voice —</option>
        {voices.map((v) => {
          const g = classify(v);
          const sym = g === "female" ? "♀" : g === "male" ? "♂" : "•";
          return (
            <option key={v.voiceURI} value={v.voiceURI}>
              {sym} {v.name}
            </option>
          );
        })}
      </select>
      <button
        type="button"
        title="Preview voice"
        className="px-2 py-1 text-sm border rounded hover:bg-gray-50 disabled:opacity-40"
        disabled={!value}
        onClick={() => previewVoice(value, voices)}
      >🔊</button>
    </span>
  );
}
