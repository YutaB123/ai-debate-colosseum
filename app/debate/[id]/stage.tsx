"use client";
import { useMemo } from "react";
import { useSse } from "../../../lib/client/use-sse";
import { useSpeak } from "../../../lib/client/use-speak";
import { Podium } from "../../../components/podium";
import { SpeechBubble } from "../../../components/speech-bubble";
import { postControl } from "../../../lib/client/api";
import { VoteBar } from "../../../components/vote-bar";
import { InterjectInput } from "../../../components/interject-input";
import type { DebateConfig, Debater, Team } from "../../../lib/types";
import type { EngineEvent } from "../../../lib/engine/events";

export function Stage({ debate }: { debate: DebateConfig }) {
  const { events, connected } = useSse<EngineEvent>(`/api/debates/${debate.id}/stream`);

  const state = useMemo(() => deriveState(debate, events), [debate, events]);

  return (
    <main className="min-h-screen bg-gradient-to-b from-yellow-50 to-white p-6">
      <header className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold">{debate.topic}</h1>
        <div className="text-sm">
          Round {state.roundNumber}/{debate.roundCount} · {connected ? "● live" : "○ disconnected"}
        </div>
        <div className="flex gap-2">
          <button onClick={() => postControl(debate.id, { action: state.paused ? "resume" : "pause" })}
                  className="px-3 py-1 border rounded text-sm">{state.paused ? "▶ Resume" : "⏸ Pause"}</button>
          <button onClick={() => postControl(debate.id, { action: "skip" })}
                  className="px-3 py-1 border rounded text-sm">⏭ Skip</button>
        </div>
      </header>

      <div className="mb-8 min-h-[180px]">
        {state.activeDebater && (
          <SpeechBubble debater={state.activeDebater}
                        text={state.currentText}
                        tokenProgress={state.currentTokens}
                        maxTokens={debate.maxTokens} />
        )}
      </div>

      <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${debate.debaters.length}, minmax(0, 1fr))` }}>
        {debate.debaters.map((d) => {
          const team = debate.teams.find((t) => t.id === d.teamId);
          const active = state.activeDebater?.id === d.id;
          return <PodiumSlot key={d.id} debater={d} team={team} active={active}
                             debateText={state.textByDebater[d.id] ?? ""} />;
        })}
      </div>

      <div className="mt-6 p-3 border rounded bg-white space-y-2 max-w-3xl mx-auto">
        <VoteBar
          debaters={debate.debaters}
          currentVote={null}
          onVote={(debaterId) => {
            fetch(`/api/debates/${debate.id}`)
              .then((r) => r.json())
              .then((j) => {
                const rounds = j.transcript?.rounds ?? [];
                const latest = rounds[rounds.length - 1];
                if (!latest) return;
                postControl(debate.id, { action: "vote", roundId: latest.roundId, debaterId });
              });
          }}
        />
        <InterjectInput onSend={(text) => postControl(debate.id, { action: "interject", text })} />
      </div>

      {state.verdict && (
        <div className="mt-8 p-4 border-2 border-amber-400 bg-amber-50 rounded">
          <div className="font-bold mb-1">Verdict</div>
          <div>Winner: {findWinnerLabel(debate, state.verdict)}</div>
          <p className="text-sm mt-2">{state.verdict.reasoning}</p>
        </div>
      )}

      {state.errors.length > 0 && (
        <div className="mt-4 text-sm text-red-600">
          {state.errors.map((e, i) => <div key={i}>⚠ {e}</div>)}
        </div>
      )}
    </main>
  );
}

function PodiumSlot({ debater, team, active, debateText }: { debater: Debater; team?: Team; active: boolean; debateText: string }) {
  useSpeak({ voiceUri: debater.voiceUri, text: debateText, active });
  return <Podium debater={debater} team={team} active={active} disabled={debater.disabled} />;
}

interface DerivedState {
  roundNumber: number;
  activeDebater: Debater | null;
  currentText: string;
  currentTokens: number;
  textByDebater: Record<string, string>;
  paused: boolean;
  verdict: { winnerDebaterId: string | null; winnerTeamId: string | null; reasoning: string } | null;
  errors: string[];
}

function deriveState(debate: DebateConfig, events: EngineEvent[]): DerivedState {
  let roundNumber = 1;
  let activeId: string | null = null;
  let currentText = "";
  let currentTokens = 0;
  const textByDebater: Record<string, string> = {};
  const paused = false;
  let verdict: DerivedState["verdict"] = null;
  const errors: string[] = [];

  for (const e of events) {
    switch (e.type) {
      case "turn_start":
        roundNumber = e.roundNumber;
        activeId = e.debaterId;
        currentText = "";
        currentTokens = 0;
        textByDebater[e.debaterId] = "";
        break;
      case "chunk":
        if (activeId === e.debaterId) {
          currentText += e.text;
          currentTokens = Math.max(1, Math.round(currentText.length / 4));
          textByDebater[e.debaterId] = currentText;
        }
        break;
      case "turn_end":
        textByDebater[e.debaterId] = e.fullText;
        activeId = null;
        break;
      case "turn_error":
        textByDebater[e.debaterId] = e.partialText;
        errors.push(`${e.debaterId} failed: ${e.reason}`);
        activeId = null;
        break;
      case "verdict":
        verdict = { winnerDebaterId: e.winnerDebaterId, winnerTeamId: e.winnerTeamId, reasoning: e.reasoning };
        break;
      case "error":
        errors.push(e.message);
        break;
    }
  }
  const activeDebater = activeId ? debate.debaters.find((d) => d.id === activeId) ?? null : null;
  return { roundNumber, activeDebater, currentText, currentTokens, textByDebater, paused, verdict, errors };
}

function findWinnerLabel(debate: DebateConfig, v: { winnerDebaterId: string | null; winnerTeamId: string | null }): string {
  if (v.winnerDebaterId) return debate.debaters.find((d) => d.id === v.winnerDebaterId)?.displayName ?? "?";
  if (v.winnerTeamId) return debate.teams.find((t) => t.id === v.winnerTeamId)?.name ?? "?";
  return "no clear winner";
}
