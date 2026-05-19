"use client";
import clsx from "clsx";
import type { Debater, Team } from "../lib/types";
import { findModel } from "../lib/providers/catalog";
import { ProviderLogo } from "./provider-logo";

export function Podium({
  debater, team, active, disabled,
}: { debater: Debater; team?: Team; active: boolean; disabled: boolean }) {
  const desc = findModel(debater.provider, debater.model);
  const accent = team?.color ?? desc?.brandColor ?? "#dc2626";

  return (
    <div className={clsx(
      "relative flex flex-col items-center transition-all duration-500 ease-out",
      active && !disabled && "scale-[1.10] -translate-y-7",
      !active && !disabled && "opacity-75 saturate-75",
      disabled && "opacity-30 grayscale",
    )}>
      {active && !disabled && (
        <div
          aria-hidden
          className="absolute -top-24 left-1/2 -translate-x-1/2 w-48 h-48 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse 60% 80% at 50% 0%, rgba(255,250,220,0.75), rgba(255,240,180,0.25) 40%, transparent 70%)",
            filter: "blur(10px)",
          }}
        />
      )}

      <div className={clsx(
        "relative z-10 mb-[-10px]",
        active && !disabled
          ? "drop-shadow-[0_0_18px_rgba(255,255,255,0.55)]"
          : "drop-shadow-[0_4px_8px_rgba(0,0,0,0.55)]",
      )}>
        <ProviderLogo provider={debater.provider} size={active ? 60 : 52} />
      </div>

      <div
        className="relative w-full"
        style={{
          clipPath: "polygon(10% 0%, 90% 0%, 100% 100%, 0% 100%)",
          background:
            "linear-gradient(180deg, rgba(255,255,255,0.22) 0%, rgba(180,200,255,0.10) 35%, rgba(255,255,255,0.05) 100%)",
          backdropFilter: "blur(6px)",
          WebkitBackdropFilter: "blur(6px)",
          boxShadow: active && !disabled
            ? `0 0 40px ${accent}77, inset 0 1px 0 rgba(255,255,255,0.45)`
            : "inset 0 1px 0 rgba(255,255,255,0.30)",
          paddingTop: 18, paddingBottom: 20, paddingLeft: 10, paddingRight: 10,
        }}
      >
        <div className="bg-[#0b1d4a] text-white text-center px-2 py-2 mx-auto"
             style={{ borderTop: `2px solid ${accent}`, maxWidth: "94%" }}>
          <div className="text-[11px] font-extrabold uppercase tracking-wider leading-tight break-words">
            {debater.displayName}
          </div>
        </div>

        <div className="mt-1 mx-auto text-center bg-[#0b1d4a] px-2 py-1.5" style={{ maxWidth: "94%" }}>
          <div className="text-[9px] uppercase tracking-[0.15em] font-bold leading-none"
               style={{ color: active && !disabled ? "#ffd24a" : accent }}>
            {active && !disabled ? "★ NOW SPEAKING ★" : "★ DEBATE ★"}
          </div>
          <div className="text-[8.5px] text-blue-100/85 uppercase tracking-wider mt-1 leading-tight">
            {desc?.label ?? `${debater.provider}/${debater.model}`}
          </div>
        </div>
      </div>

      <div className="mt-2 text-[10px] italic text-blue-100/80 text-center max-w-[160px] line-clamp-2 leading-snug">
        &ldquo;{debater.stance}&rdquo;
      </div>
    </div>
  );
}
