"use client";
import type { DebateConfig } from "../lib/types";

export function HuddlePanel({
  debate, whispers,
}: { debate: DebateConfig; whispers: { teamId: string; debaterId: string; text: string }[] }) {
  if (whispers.length === 0) return null;
  const byTeam = new Map<string, typeof whispers>();
  for (const w of whispers) {
    const arr = byTeam.get(w.teamId) ?? [];
    arr.push(w); byTeam.set(w.teamId, arr);
  }
  return (
    <div className="my-6 grid grid-cols-2 gap-4 max-w-3xl mx-auto">
      {debate.teams.map((t) => {
        const team = byTeam.get(t.id) ?? [];
        return (
          <div key={t.id} className="rounded-lg p-3 border-2" style={{ borderColor: t.color }}>
            <div className="font-bold mb-2" style={{ color: t.color }}>{t.name} · huddle</div>
            <ul className="space-y-1 text-sm">
              {team.map((w, i) => {
                const speaker = debate.debaters.find((d) => d.id === w.debaterId);
                return <li key={i}><b>{speaker?.displayName}:</b> {w.text}</li>;
              })}
              {team.length === 0 && <li className="italic text-gray-400">(silent)</li>}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
