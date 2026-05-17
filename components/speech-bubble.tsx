"use client";
import { findModel } from "../lib/providers/catalog";
import type { Debater } from "../lib/types";

export function SpeechBubble({
  debater, text, tokenProgress, maxTokens,
}: { debater: Debater; text: string; tokenProgress: number; maxTokens: number }) {
  const desc = findModel(debater.provider, debater.model);
  const pct = Math.min(100, (tokenProgress / maxTokens) * 100);
  return (
    <div className="bg-white rounded-2xl shadow-lg p-6 border-l-8 max-w-3xl mx-auto" style={{ borderColor: desc?.brandColor }}>
      <div className="text-sm font-bold mb-2" style={{ color: desc?.brandColor }}>
        {debater.displayName} · "{debater.stance}"
      </div>
      <div className="text-lg leading-relaxed min-h-[80px]">{text || <span className="text-gray-400 italic">…thinking…</span>}</div>
      <div className="mt-3 h-1 bg-gray-200 rounded overflow-hidden">
        <div className="h-full transition-all" style={{ width: `${pct}%`, background: desc?.brandColor }} />
      </div>
    </div>
  );
}
