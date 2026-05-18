"use client";
import { useVoices } from "../lib/client/use-voices";

const PREVIEW_LINE = "Hello, this is my voice.";

function previewVoice(voiceUri: string, voices: SpeechSynthesisVoice[]) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(PREVIEW_LINE);
  const v = voices.find((x) => x.voiceURI === voiceUri);
  if (v) u.voice = v;
  window.speechSynthesis.speak(u);
}

export function VoicePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const voices = useVoices().filter((v) => v.lang.toLowerCase().startsWith("en"));
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
        {voices.map((v) => (
          <option key={v.voiceURI} value={v.voiceURI}>{v.name} ({v.lang})</option>
        ))}
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
