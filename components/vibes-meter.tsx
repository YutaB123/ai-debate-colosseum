"use client";
import type { Debater, Team } from "../lib/types";
import { findModel } from "../lib/providers/catalog";

export interface VibesMeterProps {
  debate: { debaters: Debater[]; teams: Team[]; teamsEnabled: boolean };
  scores: Record<string, number> | null;
  loading?: boolean;
}

export function VibesMeter({ debate, scores, loading }: VibesMeterProps) {
  const debatersByName = new Map(debate.debaters.map((d) => [d.displayName, d]));

  const segments: { key: string; label: string; pct: number; color: string }[] = [];

  if (debate.teamsEnabled && debate.teams.length >= 2) {
    // Sum scores per team.
    const teamTotals: Record<string, number> = {};
    for (const t of debate.teams) teamTotals[t.id] = 0;
    if (scores) {
      for (const [name, score] of Object.entries(scores)) {
        const d = debatersByName.get(name);
        if (d?.teamId) teamTotals[d.teamId] = (teamTotals[d.teamId] ?? 0) + score;
      }
    }
    for (const t of debate.teams) {
      segments.push({ key: t.id, label: t.name, pct: scores ? teamTotals[t.id] : 100 / debate.teams.length, color: t.color });
    }
  } else {
    for (const d of debate.debaters) {
      const desc = findModel(d.provider, d.model);
      segments.push({
        key: d.id,
        label: d.displayName,
        pct: scores ? (scores[d.displayName] ?? 0) : 100 / debate.debaters.length,
        color: desc?.brandColor ?? "#888",
      });
    }
  }

  const total = segments.reduce((s, x) => s + x.pct, 0) || 1;

  return (
    <div className="mb-4 p-3 rounded-lg bg-white border shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs uppercase tracking-widest font-bold text-gray-700">
          🎯 Vibes meter
        </div>
        <div className="text-[10px] text-gray-500">
          {loading ? "scoring…" : scores ? "after last speech" : "waiting for first speech"}
        </div>
      </div>
      <div className="flex h-8 rounded overflow-hidden border bg-gray-100 transition-all duration-700">
        {segments.map((s) => {
          const width = (s.pct / total) * 100;
          return (
            <div
              key={s.key}
              className="flex items-center justify-center text-[11px] font-bold text-white transition-all duration-700 overflow-hidden whitespace-nowrap"
              style={{ width: `${width}%`, background: s.color, minWidth: width > 0 ? 8 : 0 }}
              title={`${s.label}: ${Math.round(s.pct)}`}
            >
              {width > 10 && (
                <span className="px-1">
                  {s.label} {Math.round(s.pct)}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
