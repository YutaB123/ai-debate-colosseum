import { openDb } from "./connection";
import { createDebate, getDebate } from "./repo";

describe("debate repo", () => {
  it("round-trips a debate with debaters and teams", () => {
    const db = openDb(":memory:");
    const id = createDebate(db, {
      topic: "Is fire wet?",
      judgeModel: "openai:gpt-4o",
      roundCount: 3,
      maxTokens: 150,
      teamsEnabled: true,
      teams: [
        { name: "Blue", color: "#4285f4" },
        { name: "Red",  color: "#d97757" },
      ],
      debaters: [
        { provider: "anthropic", model: "claude-opus-4-7", displayName: "Claude",
          stance: "Fire is wet", teamIndex: 0, speakOrder: 0, voiceUri: "v1" },
        { provider: "openai", model: "gpt-4o", displayName: "GPT-4o",
          stance: "Fire is not wet", teamIndex: 1, speakOrder: 1, voiceUri: "v2" },
      ],
    });
    const d = getDebate(db, id);
    expect(d).toBeTruthy();
    expect(d!.topic).toBe("Is fire wet?");
    expect(d!.teams.length).toBe(2);
    expect(d!.debaters.length).toBe(2);
    expect(d!.debaters[0].teamId).toBe(d!.teams[0].id);
    expect(d!.debaters[0].speakOrder).toBe(0);
  });

  it("returns null for unknown debate id", () => {
    const db = openDb(":memory:");
    expect(getDebate(db, "nope")).toBeNull();
  });
});
