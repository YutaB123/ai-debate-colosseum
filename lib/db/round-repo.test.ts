import { openDb } from "./connection";
import { createDebate } from "./repo";
import {
  createRound, finalizeSpeech, beginSpeech,
  recordWhisper, recordVote, recordInterjection, recordVerdict,
  getFullTranscript,
} from "./round-repo";

function setup() {
  const db = openDb(":memory:");
  const dId = createDebate(db, {
    topic: "T", judgeModel: "openai:gpt-4o", roundCount: 2, maxTokens: 150, teamsEnabled: true,
    teams: [{ name: "A", color: "#fff" }, { name: "B", color: "#000" }],
    debaters: [
      { provider: "openai", model: "gpt-4o", displayName: "G", stance: "yes", teamIndex: 0, speakOrder: 0, voiceUri: "v" },
      { provider: "anthropic", model: "claude-opus-4-7", displayName: "C", stance: "no", teamIndex: 1, speakOrder: 1, voiceUri: "v" },
    ],
  });
  return { db, dId };
}

describe("round repo", () => {
  it("records a full round and reads back a transcript", () => {
    const { db, dId } = setup();
    const r1 = createRound(db, dId, 1);
    const debaterIds = db.prepare("SELECT id FROM debaters WHERE debate_id=? ORDER BY speak_order").all(dId).map((r: any) => r.id);

    const s1 = beginSpeech(db, r1, debaterIds[0]);
    finalizeSpeech(db, s1, "first speech", 10);
    const s2 = beginSpeech(db, r1, debaterIds[1]);
    finalizeSpeech(db, s2, "rebuttal", 8);

    const teamIds = db.prepare("SELECT id FROM teams WHERE debate_id=?").all(dId).map((r: any) => r.id);
    recordWhisper(db, r1, debaterIds[0], teamIds[0], "I'll go strong next round");
    recordVote(db, r1, debaterIds[0]);
    recordInterjection(db, r1, "Mod: stay on topic");

    const t = getFullTranscript(db, dId);
    expect(t.rounds.length).toBe(1);
    expect(t.rounds[0].speeches.map((s) => s.text)).toEqual(["first speech", "rebuttal"]);
    expect(t.rounds[0].whispers.length).toBe(1);
    expect(t.rounds[0].votes.length).toBe(1);
    expect(t.rounds[0].interjections.length).toBe(1);
  });

  it("stores a verdict", () => {
    const { db, dId } = setup();
    const debaterIds = db.prepare("SELECT id FROM debaters WHERE debate_id=? ORDER BY speak_order").all(dId).map((r: any) => r.id);
    recordVerdict(db, dId, { winnerDebaterId: debaterIds[0], winnerTeamId: null, reasoning: "stronger arg" });
    const v = db.prepare("SELECT * FROM verdicts WHERE debate_id=?").get(dId) as any;
    expect(v.winner_debater).toBe(debaterIds[0]);
    expect(v.reasoning).toBe("stronger arg");
  });
});
