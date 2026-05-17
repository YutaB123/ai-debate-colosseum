"use client";
import clsx from "clsx";
import type { Debater, Team } from "../lib/types";
import { findModel } from "../lib/providers/catalog";

export function Podium({
  debater, team, active, disabled,
}: { debater: Debater; team?: Team; active: boolean; disabled: boolean }) {
  const desc = findModel(debater.provider, debater.model);
  return (
    <div className={clsx(
      "border-2 rounded-lg p-3 text-center transition-all bg-white shadow",
      active && "scale-110 ring-4",
      disabled && "opacity-40 grayscale",
    )} style={{ borderColor: desc?.brandColor ?? "#888", boxShadow: active ? `0 0 24px ${desc?.brandColor}` : undefined }}>
      {team && (
        <div className="h-2 -mx-3 -mt-3 mb-2 rounded-t" style={{ background: team.color }} />
      )}
      <div className="font-bold">{debater.displayName} {active && "🔊"}</div>
      <div className="text-xs text-gray-500">{desc?.label}</div>
      <div className="text-sm font-semibold mt-1" style={{ color: desc?.brandColor }}>
        "{debater.stance}"
      </div>
    </div>
  );
}
