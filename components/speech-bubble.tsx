"use client";
import { findModel } from "../lib/providers/catalog";
import type { Debater } from "../lib/types";
import { ProviderLogo } from "./provider-logo";

export function SpeechBubble({
  debater, text, tokenProgress, maxTokens,
}: { debater: Debater; text: string; tokenProgress: number; maxTokens: number }) {
  const desc = findModel(debater.provider, debater.model);
  const pct = Math.min(100, (tokenProgress / maxTokens) * 100);
  const brand = desc?.brandColor ?? "#888";

  return (
    <div className="relative max-w-2xl mx-auto">
      {/* Soft brand-color glow behind the lectern */}
      <div
        aria-hidden
        className="absolute -inset-4 rounded-3xl blur-2xl -z-10 opacity-40"
        style={{ background: brand }}
      />

      {/* Lectern (the top surface where the speaker stands) */}
      <div
        className="bg-white rounded-2xl shadow-2xl p-6 border-t-8 relative"
        style={{ borderTopColor: brand }}
      >
        <div className="flex items-center gap-3 mb-3">
          <ProviderLogo provider={debater.provider} size={48} />
          <div className="flex-1 min-w-0">
            <div className="font-bold text-lg truncate">{debater.displayName}</div>
            <div className="text-xs text-gray-500 truncate" style={{ color: brand }}>
              "{debater.stance || "(picking own side)"}"
            </div>
          </div>
          <div className="text-2xl animate-pulse" title="Now speaking">🎤</div>
        </div>

        <div className="text-lg leading-relaxed min-h-[96px]">
          {text || <span className="text-gray-400 italic">…thinking…</span>}
        </div>

        <div className="mt-3 h-1.5 bg-gray-200 rounded overflow-hidden">
          <div className="h-full transition-all" style={{ width: `${pct}%`, background: brand }} />
        </div>
      </div>

      {/* Podium base — gradient block with a thin floor line */}
      <div
        aria-hidden
        className="mx-auto h-5 bg-gradient-to-b from-gray-300 via-gray-400 to-gray-600 rounded-b-md shadow-inner"
        style={{ width: "70%" }}
      />
      <div aria-hidden className="mx-auto h-1 bg-gray-700 rounded-b" style={{ width: "85%" }} />
    </div>
  );
}
