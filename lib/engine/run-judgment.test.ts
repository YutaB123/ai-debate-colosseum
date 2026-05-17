import { runJudgment } from "./run-judgment";
import type { EngineEvent } from "./events";
import { openDb } from "../db/connection";
import { createDebate, getDebate } from "../db/repo";
import { createRound, beginSpeech, finalizeSpeech, getFullTranscript } from "../db/round-repo";
import { setStubScript, clearStubScripts } from "../providers/stub";

function setupWithSpeeches() {
  process.env.DEBATE_USE_STUB_PROVIDERS = "true";
  const db = openDb(":memory:");
  const id = createDebate(db, {
    topic: "T", judgeModel: "openai:gpt-4o", roundCount: 1, maxTokens: 100, teamsEnabled: false,
    teams: [],
    debaters: [
      { provider: "openai", model: "gpt-4o", displayName: "G", stance: "yes", teamIndex: null, speakOrder: 0, voiceUri: "v" },
      { provider: "anthropic", model: "claude-opus-4-7", displayName: "C", stance: "no", teamIndex: null, speakOrder: 1, voiceUri: "v" },
    ],
  });
  const debate = getDebate(db, id)!;
  const r = createRound(db, id, 1);
  for (const d of debate.debaters) {
    const sid = beginSpeech(db, r, d.id);
    finalizeSpeech(db, sid, `${d.displayName} said something`, 5);
  }
  return { db, debate };
}

describe("runJudgment", () => {
  beforeEach(() => clearStubScripts());

  it("parses a winner from JSON output and emits verdict", async () => {
    const { db, debate } = setupWithSpeeches();
    setStubScript("gpt-4o", { chunks: [JSON.stringify({ winnerDebater: "G", winnerTeam: null, reasoning: "Clearer points." })] });
    const events: EngineEvent[] = [];
    await runJudgment({ db, debate, judgeProvider: "openai", judgeModel: "gpt-4o", emit: (e) => events.push(e) });
    const v = events.find((e) => e.type === "verdict") as any;
    expect(v).toBeTruthy();
    expect(v.winnerDebaterId).toBe(debate.debaters[0].id);
    expect(v.reasoning).toContain("Clearer points");
  });

  it("gracefully handles non-JSON output", async () => {
    const { db, debate } = setupWithSpeeches();
    setStubScript("gpt-4o", { chunks: ["I'm not JSON sorry"] });
    const events: EngineEvent[] = [];
    await runJudgment({ db, debate, judgeProvider: "openai", judgeModel: "gpt-4o", emit: (e) => events.push(e) });
    const v = events.find((e) => e.type === "verdict") as any;
    expect(v.winnerDebaterId).toBeNull();
    expect(v.reasoning).toContain("(unparseable");
  });
});
