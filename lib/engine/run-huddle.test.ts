import { runHuddle } from "./run-huddle";
import type { EngineEvent } from "./events";
import { openDb } from "../db/connection";
import { createDebate, getDebate } from "../db/repo";
import { createRound, getFullTranscript } from "../db/round-repo";
import { setStubScript, clearStubScripts } from "../providers/stub";

function buildConfig() {
  process.env.DEBATE_USE_STUB_PROVIDERS = "true";
  const db = openDb(":memory:");
  const id = createDebate(db, {
    topic: "T", judgeModel: "openai:gpt-4o", roundCount: 2, maxTokens: 100, teamsEnabled: true,
    teams: [
      { name: "A", color: "#fff" },
      { name: "B", color: "#000" },
    ],
    debaters: [
      { provider: "openai", model: "gpt-4o", displayName: "G", stance: "yes", teamIndex: 0, speakOrder: 0, voiceUri: "v" },
      { provider: "anthropic", model: "claude-opus-4-7", displayName: "C", stance: "yes", teamIndex: 0, speakOrder: 1, voiceUri: "v" },
      { provider: "gemini", model: "gemini-2.5-flash", displayName: "F", stance: "no", teamIndex: 1, speakOrder: 2, voiceUri: "v" },
      { provider: "anthropic", model: "claude-haiku-4-5-20251001", displayName: "M", stance: "no", teamIndex: 1, speakOrder: 3, voiceUri: "v" },
    ],
  });
  return { db, debate: getDebate(db, id)! };
}

describe("runHuddle", () => {
  beforeEach(() => clearStubScripts());

  it("emits one whisper per debater and writes to DB", async () => {
    const { db, debate } = buildConfig();
    setStubScript("gpt-4o",            { chunks: ["push X harder"] });
    setStubScript("claude-opus-4-7",   { chunks: ["I'll handle Y"] });
    setStubScript("gemini-2.5-flash",  { chunks: ["counter with Z"] });
    setStubScript("claude-haiku-4-5-20251001", { chunks: ["I'll close on W"] });

    const roundId = createRound(db, debate.id, 1);
    const events: EngineEvent[] = [];
    await runHuddle({ db, debate, roundId, roundNumber: 1, emit: (e) => events.push(e) });

    const types = events.map((e) => e.type);
    expect(types[0]).toBe("huddle_start");
    expect(types[types.length - 1]).toBe("huddle_end");
    expect(types.filter((t) => t === "whisper").length).toBe(4);

    const t = getFullTranscript(db, debate.id);
    expect(t.rounds[0].whispers.length).toBe(4);
  });

  it("is a no-op when teams are disabled", async () => {
    const { db } = buildConfig();
    // Build a teams-disabled debate.
    const id = createDebate(db, {
      topic: "T", judgeModel: "openai:gpt-4o", roundCount: 1, maxTokens: 100, teamsEnabled: false,
      teams: [],
      debaters: [
        { provider: "openai", model: "gpt-4o", displayName: "G", stance: "yes", teamIndex: null, speakOrder: 0, voiceUri: "v" },
      ],
    });
    const debate = getDebate(db, id)!;
    const roundId = createRound(db, debate.id, 1);
    const events: EngineEvent[] = [];
    await runHuddle({ db, debate, roundId, roundNumber: 1, emit: (e) => events.push(e) });
    expect(events).toEqual([]);
  });
});
