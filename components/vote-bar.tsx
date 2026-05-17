"use client";
import type { Debater } from "../lib/types";

export function VoteBar({ debaters, currentVote, onVote }:
  { debaters: Debater[]; currentVote: string | null; onVote: (id: string) => void }) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-sm font-semibold">Who won this round?</span>
      {debaters.map((d) => (
        <button key={d.id}
                onClick={() => onVote(d.id)}
                className={`px-3 py-1 rounded border text-sm ${currentVote === d.id ? "bg-amber-200 border-amber-500" : "bg-white"}`}>
          {d.displayName}
        </button>
      ))}
    </div>
  );
}
