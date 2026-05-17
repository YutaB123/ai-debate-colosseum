"use client";
import { useVoices } from "../lib/client/use-voices";

export function VoicePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const voices = useVoices();
  if (voices.length === 0) {
    return <span className="text-xs text-gray-500">(no voices available)</span>;
  }
  return (
    <select
      className="border rounded px-2 py-1 text-sm"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">— pick a voice —</option>
      {voices.map((v) => (
        <option key={v.voiceURI} value={v.voiceURI}>{v.name} ({v.lang})</option>
      ))}
    </select>
  );
}
