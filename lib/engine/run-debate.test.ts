import { runDebate } from "./run-debate";
import type { EngineEvent } from "./events";
import { openDb } from "../db/connection";
import { createDebate, getDebate } from "../db/repo";
import { setStubScript, clearStubScripts } from "../providers/stub";

function setup(teamsEnabled: boolean, rounds: number) {
  process.env.DEBATE_USE_STUB_PROVIDERS = "true";
  const db = openDb(":memory:");
  const id = createDebate(db, {
    topic: "T", judgeModel: "openai:gpt-4o", roundCount: rounds, maxTokens: 50,
    teamsEnabled,
    teams: teamsEnabled ? [{ name: "A", color: "#fff" }, { name: "B", color: "#000" }] : [],
    debaters: [
      { provider: "openai", model: "gpt-4o", displayName: "G", stance: "yes",
        teamIndex: teamsEnabled ? 0 : null, speakOrder: 0, voiceUri: "v" },
      { provider: "anthropic", model: "claude-opus-4-7", displayName: "C", stance: "no",
        teamIndex: teamsEnabled ? 1 : null, speakOrder: 1, voiceUri: "v" },
    ],
  });
  return { db, debate: getDebate(db, id)! };
}

describe("runDebate", () => {
  beforeEach(() => clearStubScripts());

  it("runs N rounds without huddles when teams disabled, then judges", async () => {
    const { db, debate } = setup(false, 2);
    setStubScript("gpt-4o", { chunks: ["a"] });
    setStubScript("claude-opus-4-7", { chunks: ["b"] });
    const events: EngineEvent[] = [];
    await runDebate({
      db, debate,
      signals: { paused: false, skipCurrent: false, pendingInterjection: null },
      emit: (e) => events.push(e),
    });
    const roundEnds = events.filter((e) => e.type === "round_end").length;
    expect(roundEnds).toBe(2);
    expect(events.some((e) => e.type === "huddle_start")).toBe(false);
    // After round 2, the judge runs.
    expect(events[events.length - 1].type).toBe("verdict");
  });

  it("interleaves huddles between rounds when teams enabled", async () => {
    const { db, debate } = setup(true, 3);
    setStubScript("gpt-4o", { chunks: ["a"] });
    setStubScript("claude-opus-4-7", { chunks: ["b"] });
    const events: EngineEvent[] = [];
    await runDebate({
      db, debate,
      signals: { paused: false, skipCurrent: false, pendingInterjection: null },
      emit: (e) => events.push(e),
    });
    const huddleStarts = events.filter((e) => e.type === "huddle_start").length;
    expect(huddleStarts).toBe(2); // huddles between R1→R2 and R2→R3, not after R3
  });
});
