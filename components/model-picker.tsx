"use client";
import { useEffect, useRef, useState } from "react";
import { CATALOG } from "../lib/providers/catalog";
import { ProviderLogo } from "./provider-logo";

export function ModelPicker({
  value,
  onChange,
  excludeKeys,
}: {
  value: string;
  onChange: (v: string) => void;
  excludeKeys?: string[];
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const current = CATALOG.find((m) => `${m.provider}:${m.model}` === value);

  return (
    <div className="relative inline-block" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 border rounded px-2 py-1.5 text-sm bg-white hover:bg-gray-50 min-w-[180px]"
        style={{ borderLeft: current ? `4px solid ${current.brandColor}` : undefined }}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {current ? (
          <>
            <ProviderLogo provider={current.provider} size={20} />
            <span className="font-medium truncate flex-1 text-left">{current.label}</span>
          </>
        ) : (
          <span className="text-gray-500 flex-1 text-left">Pick a model</span>
        )}
        <span className="text-xs text-gray-500" aria-hidden>▾</span>
      </button>

      {open && (
        <div
          className="absolute z-30 mt-1 w-64 bg-white border rounded-md shadow-xl max-h-80 overflow-y-auto"
          role="listbox"
        >
          {CATALOG.map((m) => {
            const key = `${m.provider}:${m.model}`;
            const isSelected = key === value;
            const isDisabled = excludeKeys?.includes(key) ?? false;
            return (
              <button
                key={key}
                type="button"
                role="option"
                aria-selected={isSelected}
                disabled={isDisabled}
                onClick={() => {
                  if (isDisabled) return;
                  onChange(key);
                  setOpen(false);
                }}
                className={
                  "flex items-center gap-2 px-2.5 py-2 w-full text-left text-sm transition-colors " +
                  (isDisabled
                    ? "opacity-40 cursor-not-allowed"
                    : "hover:bg-gray-100 cursor-pointer ") +
                  (isSelected ? " bg-blue-50" : "")
                }
                style={{ borderLeft: `4px solid ${m.brandColor}` }}
              >
                <ProviderLogo provider={m.provider} size={22} />
                <span className="flex-1 truncate">{m.label}</span>
                {isSelected && <span className="text-blue-600 text-xs" aria-hidden>✓</span>}
                {isDisabled && !isSelected && <span className="text-xs text-gray-400">judge</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
