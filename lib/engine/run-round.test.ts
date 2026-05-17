import { runRound } from "./run-round";
import type { EngineEvent } from "./events";
import type { ControlSignals } from "./state";
import type { DebateConfig } from "../types";
import { openDb } from "../db/connection";
import { createDebate, getDebate } from "../db/repo";
import { createRound, getFullTranscript } from "../db/round-repo";
import { setStubScript, clearStubScripts } from "../providers/stub";

function buildConfig() {
  process.env.DEBATE_USE_STUB_PROVIDERS = "true";
  const db = openDb(":memory:");
  const id = createDebate(db, {
    topic: "T", judgeModel: "openai:gpt-4o", roundCount: 2, maxTokens: 50, teamsEnabled: false,
    teams: [],
    debaters: [
      { provider: "openai", model: "gpt-4o", displayName: "G", stance: "yes", teamIndex: null, speakOrder: 0, voiceUri: "v" },
      { provider: "anthropic", model: "claude-opus-4-7", displayName: "C", stance: "no", teamIndex: null, speakOrder: 1, voiceUri: "v" },
    ],
  });
  const debate = getDebate(db, id)!;
  return { db, debate };
}

describe("runRound", () => {
  beforeEach(() => clearStubScripts());

  it("emits turn_start → chunks → turn_end for each debater in order", async () => {
    const { db, debate } = buildConfig();
    setStubScript("gpt-4o", { chunks: ["hello ", "world"] });
    setStubScript("claude-opus-4-7", { chunks: ["a ", "b"] });

    const roundId = createRound(db, debate.id, 1);
    const events: EngineEvent[] = [];
    const signals: ControlSignals = { paused: false, skipCurrent: false, pendingInterjection: null };
    await runRound({ db, debate, roundId, roundNumber: 1, signals, emit: (e) => events.push(e) });

    const order = events.map((e) => e.type);
    expect(order).toEqual([
      "turn_start", "chunk", "chunk", "turn_end",
      "turn_start", "chunk", "chunk", "turn_end",
      "round_end",
    ]);
    expect((events[1] as any).text).toBe("hello ");
    expect((events[3] as any).fullText).toBe("hello world");
  });

  it("emits turn_error and proceeds when a provider fails mid-stream", async () => {
    const { db, debate } = buildConfig();
    setStubScript("gpt-4o", { chunks: ["hello ", "world"], errorAfter: 1 });
    setStubScript("claude-opus-4-7", { chunks: ["a"] });
    const roundId = createRound(db, debate.id, 1);
    const events: EngineEvent[] = [];
    await runRound({
      db, debate, roundId, roundNumber: 1,
      signals: { paused: false, skipCurrent: false, pendingInterjection: null },
      emit: (e) => events.push(e),
    });
    const types = events.map((e) => e.type);
    expect(types).toEqual(["turn_start", "chunk", "turn_error", "turn_start", "chunk", "turn_end", "round_end"]);
  });

  it("honors skipCurrent flag (stops streaming current debater)", async () => {
    const { db, debate } = buildConfig();
    setStubScript("gpt-4o", { chunks: ["a", "b", "c", "d"] });
    setStubScript("claude-opus-4-7", { chunks: ["x"] });
    const roundId = createRound(db, debate.id, 1);
    const events: EngineEvent[] = [];
    const signals: ControlSignals = { paused: false, skipCurrent: false, pendingInterjection: null };

    // Flip skipCurrent after the first chunk.
    const emit = (e: EngineEvent) => {
      events.push(e);
      if (e.type === "chunk" && (e as any).debaterId !== undefined && events.filter((x) => x.type === "chunk").length === 1) {
        signals.skipCurrent = true;
      }
    };
    await runRound({ db, debate, roundId, roundNumber: 1, signals, emit });
    const types = events.map((e) => e.type);
    expect(types[0]).toBe("turn_start");
    expect(types[types.length - 1]).toBe("round_end");
    // The first speaker shouldn't have emitted all 4 chunks.
    const firstSpeakerChunks = events.filter(
      (e) => e.type === "chunk" && (e as any).debaterId === debate.debaters[0].id
    );
    expect(firstSpeakerChunks.length).toBeLessThan(4);
  });
});
