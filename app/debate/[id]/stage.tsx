"use client";
import { useEffect, useMemo, useState } from "react";
import { useSse } from "../../../lib/client/use-sse";
import { useNarrator } from "../../../lib/client/use-narrator";
import { Podium } from "../../../components/podium";
import { SpeechBubble } from "../../../components/speech-bubble";
import { ProviderLogo } from "../../../components/provider-logo";
import { findModel } from "../../../lib/providers/catalog";
import { postControl } from "../../../lib/client/api";
import { VoteBar } from "../../../components/vote-bar";
import { InterjectInput } from "../../../components/interject-input";
import { HuddlePanel } from "../../../components/huddle-panel";
import type { DebateConfig, Debater, ProviderId, Team } from "../../../lib/types";
import type { EngineEvent } from "../../../lib/engine/events";

async function pollForVerdict(
  debateId: string,
  setFallbackVerdict: (v: { winnerDebaterId: string | null; winnerTeamId: string | null; reasoning: string }) => void,
) {
  for (let i = 0; i < 10; i++) {
    await new Promise((r) => setTimeout(r, 1500));
    try {
      const res = await fetch(`/api/debates/${debateId}`);
      if (!res.ok) continue;
      const j = await res.json();
      const v = j.transcript?.verdict;
      if (v) {
        setFallbackVerdict({
          winnerDebaterId: v.winnerDebaterId,
          winnerTeamId: v.winnerTeamId,
          reasoning: v.reasoning,
        });
        return;
      }
    } catch { /* keep trying */ }
  }
}

function parseProviderModel(s: string): { provider: ProviderId | null; model: string } {
  const i = s.indexOf(":");
  if (i < 0) return { provider: null, model: s };
  return { provider: s.slice(0, i) as ProviderId, model: s.slice(i + 1) };
}

export function Stage({ debate, replay }: { debate: DebateConfig; replay?: { rounds: any[]; verdict: any } }) {
  const live = useSse<EngineEvent>(
    replay ? null : `/api/debates/${debate.id}/stream`,
    { stopWhen: (e) => (e as EngineEvent).type === "verdict" },
  );
  const replayed = useReplayEvents(replay, debate);
  const events = replay ? replayed.events : live.events;
  const connected = replay ? replayed.done : live.connected;

  const derived = useMemo(() => deriveState(debate, events), [debate, events]);
  const [paused, setPaused] = useState(false);
  const [votedFor, setVotedFor] = useState<{ roundId: string; debaterId: string } | null>(null);
  const [controlError, setControlError] = useState<string | null>(null);
  const [ending, setEnding] = useState(false);
  const [fallbackVerdict, setFallbackVerdict] = useState<DerivedState["verdict"]>(null);

  // Merge the SSE-driven verdict with the polled fallback (in case the engine
  // never emits one — e.g. it failed before judgment).
  const state: DerivedState = useMemo(() => {
    if (derived.verdict || !fallbackVerdict) return derived;
    return { ...derived, verdict: fallbackVerdict };
  }, [derived, fallbackVerdict]);

  const ctrl = async (action: any) => {
    setControlError(null);
    try {
      await postControl(debate.id, action);
    } catch (e: any) {
      setControlError(e?.message ?? "control request failed");
      setTimeout(() => setControlError(null), 4000);
    }
  };

  // The narrator plays speeches one at a time and drives all UI sync.
  const narrator = useNarrator(state.speeches, debate.debaters);

  // When the user ends the debate, cancel any in-flight TTS so the verdict
  // can show immediately instead of waiting for queued narration to finish.
  useEffect(() => {
    if (!ending) return;
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
  }, [ending]);

  // When the verdict arrives, have the judge "take the stage" and read it
  // out loud in TTS. Fire-once on the verdict transition.
  const verdictReasoning = state.verdict?.reasoning ?? null;
  useEffect(() => {
    if (!verdictReasoning) return;
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const winnerName = state.verdict ? findWinnerLabel(debate, state.verdict) : null;
    const intro = winnerName && winnerName !== "no clear winner"
      ? `My verdict: ${winnerName} wins. `
      : "My verdict: ";
    const u = new SpeechSynthesisUtterance(intro + verdictReasoning);
    u.rate = 1.0;
    window.speechSynthesis.speak(u);
    return () => { window.speechSynthesis.cancel(); };
  }, [verdictReasoning, debate, state.verdict]);

  // What the audience is currently hearing (not necessarily what the engine just emitted).
  const speakingSpeech = !ending && narrator.speakingIndex >= 0 ? state.speeches[narrator.speakingIndex] : null;
  const speakingDebater = speakingSpeech
    ? debate.debaters.find((d) => d.id === speakingSpeech.debaterId) ?? null
    : null;
  const revealedText = speakingSpeech ? speakingSpeech.text.slice(0, narrator.spokenChars) : "";

  // Transcript follows the narrator normally, but if the debate is being
  // force-ended we reveal everything so the verdict isn't gated on narration.
  const transcriptSpeeches = ending ? state.speeches : state.speeches.slice(0, narrator.playedThrough + 1);
  const narrationLagging = !ending && (narrator.playedThrough < state.speeches.length - 1 || narrator.speakingIndex >= 0);
  const showVerdict = state.verdict && !narrationLagging;

  const heardCount = (narrator.playedThrough + 1) + (narrator.speakingIndex >= 0 ? 1 : 0);

  const interjections = events.filter((e) => e.type === "interjection_received") as Array<{ type: "interjection_received"; roundNumber: number; text: string }>;
  const debateEnded = ending || !!state.verdict;

  return (
    <main className="min-h-screen bg-gradient-to-b from-yellow-50 to-white p-4 sm:p-6 text-gray-900">
      <header className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h1 className="text-xl font-bold min-w-0 break-words flex-1">{debate.topic}</h1>
        <div className="text-sm text-gray-700 shrink-0">
          {showVerdict ? "done" : `turn ${Math.max(heardCount, 1)}`} · {connected ? "● live" : "○ disconnected"}
        </div>
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          <button onClick={() => {
                    const newPaused = !paused;
                    setPaused(newPaused);
                    ctrl({ action: newPaused ? "pause" : "resume" });
                  }}
                  disabled={debateEnded}
                  className="px-3 py-2 border rounded text-sm bg-white text-gray-900 disabled:opacity-50 min-h-[40px]">{paused ? "▶ Resume" : "⏸ Pause"}</button>
          <button onClick={() => ctrl({ action: "skip" })}
                  disabled={debateEnded}
                  className="px-3 py-2 border rounded text-sm bg-white text-gray-900 disabled:opacity-50 min-h-[40px]">⏭ Skip</button>
          <button onClick={async () => {
                    if (debateEnded) return;
                    if (!confirm("End the debate now? The judge will evaluate whatever has been said so far.")) return;
                    setEnding(true);
                    await ctrl({ action: "end" });
                    // Belt-and-suspenders: if the SSE verdict event never
                    // arrives (engine crashed, network blip, etc.), poll the
                    // DB so the UI doesn't hang on the "judge is finishing up"
                    // banner forever.
                    void pollForVerdict(debate.id, setFallbackVerdict);
                  }}
                  disabled={debateEnded}
                  className="px-3 py-2 border rounded text-sm bg-red-50 text-red-700 border-red-300 disabled:opacity-50 min-h-[40px]">⏹ End Debate</button>
        </div>
      </header>

      {controlError && (
        <div className="mb-4 p-2 rounded bg-red-50 border border-red-300 text-sm text-red-800">
          Control failed: {controlError}
        </div>
      )}

      {ending && !state.verdict && (
        <div className="mb-4 p-3 rounded bg-amber-50 border border-amber-300 text-sm text-amber-900 font-medium">
          ⏹ Ending debate — the judge is finishing up…
        </div>
      )}

      {interjections.length > 0 && (
        <div className="mb-4 p-3 rounded bg-blue-50 border border-blue-200">
          <div className="text-sm font-semibold text-blue-900">Moderator notes</div>
          <ul className="text-sm text-blue-900 mt-1 list-disc pl-5 space-y-1">
            {interjections.map((i, idx) => <li key={idx}><span className="font-medium">Round {i.roundNumber}:</span> {i.text}</li>)}
          </ul>
        </div>
      )}

      <div className="mb-12 min-h-[260px]">
        {speakingDebater && speakingSpeech ? (
          <SpeechBubble debater={speakingDebater}
                        text={revealedText}
                        tokenProgress={Math.round(narrator.spokenChars / 4)}
                        maxTokens={Math.max(debate.maxTokens, Math.round(speakingSpeech.text.length / 4))} />
        ) : narrationLagging ? (
          <div className="text-center text-gray-500 italic pt-12">…the next speaker is preparing…</div>
        ) : null}
      </div>

      <section
        className="relative rounded-2xl overflow-hidden pt-20 pb-12 px-3 sm:px-6 mb-6 shadow-2xl"
        style={{
          background:
            // soft purple wash from top center (the stage haze)
            "radial-gradient(ellipse 70% 35% at 50% 0%, rgba(180,160,255,0.18), transparent 60%)," +
            // curtain folds (repeating vertical bands)
            "repeating-linear-gradient(90deg, #181550 0px, #2a2480 50px, #181550 100px, #16133a 140px)," +
            // base
            "linear-gradient(180deg, #16133a 0%, #0a0925 100%)",
        }}
      >
        {/* hex-pattern strip across the top of the stage (the show-set canopy) */}
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 h-14 pointer-events-none opacity-40"
          style={{
            backgroundImage:
              "radial-gradient(circle at center, rgba(255,255,255,0.25) 1px, transparent 1.6px)",
            backgroundSize: "22px 22px",
            maskImage: "linear-gradient(180deg, black, transparent)",
            WebkitMaskImage: "linear-gradient(180deg, black, transparent)",
          }}
        />

        {/* row of podiums */}
        <div
          className={"relative grid gap-3 sm:gap-5 items-end transition-opacity duration-700 " + (state.verdict ? "opacity-50" : "")}
          style={{ gridTemplateColumns: `repeat(auto-fit, minmax(110px, 1fr))` }}
        >
          {debate.debaters.map((d) => {
            const team = debate.teams.find((t) => t.id === d.teamId);
            const active = speakingDebater?.id === d.id;
            return <PodiumSlot key={d.id} debater={d} team={team} active={active} />;
          })}
        </div>

        {state.verdict && (
          <JudgeAnnouncement debate={debate} verdict={state.verdict} />
        )}

        {/* stage floor wash at the bottom */}
        <div
          aria-hidden
          className="absolute inset-x-0 bottom-0 h-16 pointer-events-none"
          style={{
            background:
              "linear-gradient(180deg, transparent, rgba(0,0,0,0.55))," +
              "radial-gradient(ellipse 60% 100% at 50% 100%, rgba(255,255,255,0.05), transparent 60%)",
          }}
        />
      </section>

      <div className="mt-6 p-3 border rounded bg-white space-y-2 max-w-3xl mx-auto">
        <VoteBar
          debaters={debate.debaters}
          currentVote={votedFor?.debaterId ?? null}
          onVote={(debaterId) => {
            fetch(`/api/debates/${debate.id}`)
              .then((r) => r.json())
              .then((j) => {
                const rounds = j.transcript?.rounds ?? [];
                const latest = rounds[rounds.length - 1];
                if (!latest) return;
                ctrl({ action: "vote", roundId: latest.roundId, debaterId });
                setVotedFor({ roundId: latest.roundId, debaterId });
              });
          }}
        />
        <InterjectInput onSend={(text) => ctrl({ action: "interject", text })} />
      </div>

      {state.huddleActive && (
        <HuddlePanel debate={debate} whispers={state.currentHuddleWhispers} />
      )}

      <TranscriptPanel
        debate={debate}
        speeches={transcriptSpeeches}
        activeSpeech={speakingSpeech ? { debaterId: speakingSpeech.debaterId, text: revealedText } : null}
      />

      {showVerdict && state.verdict && (
        <div className="mt-8 p-4 border-2 border-amber-400 bg-amber-50 rounded text-gray-900">
          <div className="font-bold mb-1">Verdict</div>
          <div>Winner: {findWinnerLabel(debate, state.verdict)}</div>
          <p className="text-sm mt-2 whitespace-pre-wrap">{state.verdict.reasoning}</p>
          <div className="mt-3 pt-3 border-t border-amber-300 flex flex-wrap gap-2 items-center">
            <span className="text-sm font-semibold">Override winner:</span>
            {debate.debaters.map((d) => (
              <button key={d.id}
                      className="px-3 py-2 border rounded text-sm bg-white text-gray-900 min-h-[40px]"
                      onClick={() =>
                        fetch(`/api/debates/${debate.id}/verdict`, {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ override: d.id }),
                        })
                      }>
                {d.displayName}
              </button>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t border-amber-300">
            <a href="/"
               className="inline-block px-4 py-2 border rounded text-sm bg-white text-gray-900 font-semibold hover:bg-gray-50 min-h-[40px]">
              ← Back to Home
            </a>
          </div>
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

function JudgeAnnouncement({
  debate,
  verdict,
}: {
  debate: DebateConfig;
  verdict: { winnerDebaterId: string | null; winnerTeamId: string | null; reasoning: string };
}) {
  const { provider: judgeProvider, model: judgeModelId } = parseProviderModel(debate.judgeModel);
  const judgeDesc = judgeProvider ? findModel(judgeProvider, judgeModelId) : undefined;
  const winnerName = findWinnerLabel(debate, verdict);

  return (
    <div className="relative z-10 mt-10 flex flex-col items-center">
      {/* spotlight on the judge */}
      <div
        aria-hidden
        className="absolute -top-20 left-1/2 -translate-x-1/2 w-72 h-72 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 60% 80% at 50% 0%, rgba(255,250,220,0.7), rgba(255,240,180,0.25) 40%, transparent 70%)",
          filter: "blur(10px)",
        }}
      />

      {/* judge avatar (provider logo as the "head") */}
      <div className="z-10 mb-[-12px] drop-shadow-[0_0_20px_rgba(255,255,255,0.65)]">
        {judgeProvider ? <ProviderLogo provider={judgeProvider} size={80} /> : null}
      </div>

      {/* judge podium */}
      <div
        className="relative w-full max-w-md mx-auto"
        style={{
          clipPath: "polygon(8% 0%, 92% 0%, 100% 100%, 0% 100%)",
          background:
            "linear-gradient(180deg, rgba(255,255,255,0.25) 0%, rgba(180,200,255,0.10) 35%, rgba(255,255,255,0.05) 100%)",
          backdropFilter: "blur(6px)",
          WebkitBackdropFilter: "blur(6px)",
          boxShadow: "0 0 50px rgba(255,210,74,0.55), inset 0 1px 0 rgba(255,255,255,0.45)",
          paddingTop: 22, paddingBottom: 26, paddingLeft: 16, paddingRight: 16,
        }}
      >
        <div
          className="bg-[#0b1d4a] text-white text-center px-3 py-2 mx-auto"
          style={{ borderTop: "2px solid #ffd24a", maxWidth: "94%" }}
        >
          <div className="text-xs uppercase tracking-[0.2em] font-extrabold" style={{ color: "#ffd24a" }}>
            ★ THE JUDGE ★
          </div>
          <div className="mt-1 text-sm font-extrabold uppercase tracking-wider">
            {judgeDesc?.label ?? debate.judgeModel}
          </div>
        </div>
      </div>

      {/* verdict bubble */}
      <div className="mt-5 max-w-2xl w-full bg-white text-gray-900 rounded-lg shadow-2xl border-2 border-amber-400 px-4 py-3">
        <div className="text-xs uppercase tracking-widest font-bold text-amber-700 mb-1">Verdict</div>
        <div className="text-2xl font-extrabold mb-2">
          {winnerName === "no clear winner" ? "No clear winner" : `${winnerName} wins`}
        </div>
        <p className="text-sm leading-relaxed whitespace-pre-wrap">{verdict.reasoning}</p>
      </div>
    </div>
  );
}

function PodiumSlot({ debater, team, active }: { debater: Debater; team?: Team; active: boolean }) {
  return <Podium debater={debater} team={team} active={active} disabled={debater.disabled} />;
}

function TranscriptPanel({ debate, speeches, activeSpeech }: {
  debate: DebateConfig;
  speeches: CompletedSpeech[];
  activeSpeech: { debaterId: string; text: string } | null;
}) {
  if (speeches.length === 0 && !activeSpeech) return null;
  const nameById = new Map(debate.debaters.map((d) => [d.id, d.displayName]));
  const colorById = new Map(
    debate.debaters.map((d) => [d.id, findModel(d.provider, d.model)?.brandColor ?? "#888"])
  );
  return (
    <section className="mt-8 max-w-3xl mx-auto">
      <h2 className="text-lg font-bold mb-3">Conversation</h2>
      <div className="space-y-3">
        {speeches.map((s, i) => {
          const dbtr = debate.debaters.find((d) => d.id === s.debaterId);
          return (
            <div key={i} className="border-l-4 pl-3 bg-white border rounded-r p-3"
                 style={{ borderLeftColor: colorById.get(s.debaterId) }}>
              <div className="flex items-center gap-2">
                {dbtr && <ProviderLogo provider={dbtr.provider} size={24} />}
                <div className="text-sm font-semibold" style={{ color: colorById.get(s.debaterId) }}>
                  {nameById.get(s.debaterId) ?? s.debaterId}
                  {s.error && <span className="ml-2 text-xs text-red-600">(interrupted: {s.error})</span>}
                </div>
              </div>
              <p className="text-base leading-relaxed mt-1 whitespace-pre-wrap">{s.text || <span className="text-gray-400 italic">(no text)</span>}</p>
            </div>
          );
        })}
        {activeSpeech && (() => {
          const dbtr = debate.debaters.find((d) => d.id === activeSpeech.debaterId);
          return (
            <div className="border-l-4 pl-3 bg-white border rounded-r p-3 animate-pulse"
                 style={{ borderLeftColor: colorById.get(activeSpeech.debaterId) }}>
              <div className="flex items-center gap-2">
                {dbtr && <ProviderLogo provider={dbtr.provider} size={24} />}
                <div className="text-sm font-semibold" style={{ color: colorById.get(activeSpeech.debaterId) }}>
                  {nameById.get(activeSpeech.debaterId) ?? activeSpeech.debaterId}
                </div>
              </div>
              <p className="text-base leading-relaxed mt-1 whitespace-pre-wrap">
                {activeSpeech.text || <span className="text-gray-400 italic">…thinking…</span>}
              </p>
            </div>
          );
        })()}
      </div>
    </section>
  );
}

interface CompletedSpeech {
  roundNumber: number;
  debaterId: string;
  text: string;
  error: string | null;
}

interface DerivedState {
  roundNumber: number;
  activeDebater: Debater | null;
  currentText: string;
  currentTokens: number;
  textByDebater: Record<string, string>;
  speeches: CompletedSpeech[];
  verdict: { winnerDebaterId: string | null; winnerTeamId: string | null; reasoning: string } | null;
  errors: string[];
  huddleActive: boolean;
  currentHuddleWhispers: { teamId: string; debaterId: string; text: string }[];
}

function deriveState(debate: DebateConfig, events: EngineEvent[]): DerivedState {
  let roundNumber = 1;
  let activeId: string | null = null;
  let currentText = "";
  let currentTokens = 0;
  const textByDebater: Record<string, string> = {};
  const speechMap = new Map<string, CompletedSpeech>();
  let currentRoundForTurn = 1;
  let verdict: DerivedState["verdict"] = null;
  const errors: string[] = [];
  let huddleActive = false;
  let currentHuddleWhispers: { teamId: string; debaterId: string; text: string }[] = [];

  for (const e of events) {
    switch (e.type) {
      case "turn_start":
        roundNumber = e.roundNumber;
        currentRoundForTurn = e.roundNumber;
        activeId = e.debaterId;
        currentText = "";
        currentTokens = 0;
        textByDebater[e.debaterId] = "";
        break;
      case "chunk":
        if (activeId !== e.debaterId) {
          activeId = e.debaterId;
          currentText = textByDebater[e.debaterId] ?? "";
        }
        currentText += e.text;
        currentTokens = Math.max(1, Math.round(currentText.length / 4));
        textByDebater[e.debaterId] = currentText;
        break;
      case "turn_end":
        textByDebater[e.debaterId] = e.fullText;
        speechMap.set(`${currentRoundForTurn}|${e.debaterId}`, {
          roundNumber: currentRoundForTurn, debaterId: e.debaterId, text: e.fullText, error: null,
        });
        activeId = null;
        break;
      case "turn_error":
        textByDebater[e.debaterId] = e.partialText;
        speechMap.set(`${currentRoundForTurn}|${e.debaterId}`, {
          roundNumber: currentRoundForTurn, debaterId: e.debaterId, text: e.partialText, error: e.reason,
        });
        errors.push(`${e.debaterId} failed: ${e.reason}`);
        activeId = null;
        break;
      case "huddle_start":
        huddleActive = true;
        currentHuddleWhispers = [];
        roundNumber = e.roundNumber;
        break;
      case "whisper":
        currentHuddleWhispers.push({ teamId: e.teamId, debaterId: e.debaterId, text: e.text });
        break;
      case "huddle_end":
        huddleActive = false;
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
  const speeches = Array.from(speechMap.values()).sort((a, b) => {
    if (a.roundNumber !== b.roundNumber) return a.roundNumber - b.roundNumber;
    const ai = debate.debaters.findIndex((d) => d.id === a.debaterId);
    const bi = debate.debaters.findIndex((d) => d.id === b.debaterId);
    return ai - bi;
  });
  return { roundNumber, activeDebater, currentText, currentTokens, textByDebater, speeches, verdict, errors, huddleActive, currentHuddleWhispers };
}

function findWinnerLabel(debate: DebateConfig, v: { winnerDebaterId: string | null; winnerTeamId: string | null }): string {
  if (v.winnerDebaterId) return debate.debaters.find((d) => d.id === v.winnerDebaterId)?.displayName ?? "?";
  if (v.winnerTeamId) return debate.teams.find((t) => t.id === v.winnerTeamId)?.name ?? "?";
  return "no clear winner";
}

function useReplayEvents(replay: { rounds: any[]; verdict: any } | undefined, debate: DebateConfig) {
  const [events, setEvents] = useState<EngineEvent[]>([]);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!replay) return;
    let cancelled = false;
    (async () => {
      const out: EngineEvent[] = [];
      for (const r of replay.rounds) {
        for (const s of r.speeches) {
          out.push({ type: "turn_start", roundNumber: r.roundNumber, debaterId: s.debaterId });
          setEvents([...out]);
          for (let i = 0; i < s.text.length; i += 80) {
            await new Promise((res) => setTimeout(res, 150));
            if (cancelled) return;
            out.push({ type: "chunk", debaterId: s.debaterId, text: s.text.slice(i, i + 80) });
            setEvents([...out]);
          }
          out.push({ type: "turn_end", debaterId: s.debaterId, fullText: s.text, tokenCount: s.tokenCount });
          setEvents([...out]);
        }
        if (r.whispers.length > 0) {
          out.push({ type: "huddle_start", roundNumber: r.roundNumber });
          for (const w of r.whispers) {
            out.push({ type: "whisper", teamId: w.teamId, debaterId: w.debaterId, text: w.text });
          }
          out.push({ type: "huddle_end", roundNumber: r.roundNumber });
          setEvents([...out]);
        }
        out.push({ type: "round_end", roundNumber: r.roundNumber });
        setEvents([...out]);
      }
      if (replay.verdict) {
        out.push({
          type: "verdict",
          winnerDebaterId: replay.verdict.winnerDebaterId,
          winnerTeamId: replay.verdict.winnerTeamId,
          reasoning: replay.verdict.reasoning,
        });
        setEvents([...out]);
      }
      setDone(true);
    })();
    return () => { cancelled = true; };
  }, [replay, debate]);

  return { events, done };
}
