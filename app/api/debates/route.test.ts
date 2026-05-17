/**
 * @jest-environment node
 */
import { POST } from "./route";

describe("POST /api/debates", () => {
  beforeEach(() => {
    process.env.OPENAI_API_KEY = "k";
    process.env.ANTHROPIC_API_KEY = "k";
    process.env.DEBATE_DB_PATH = ":memory:";
  });

  it("400s on missing topic", async () => {
    const res = await POST(new Request("http://x", { method: "POST", body: JSON.stringify({}) }));
    expect(res.status).toBe(400);
  });

  it("201s with an id on a valid request", async () => {
    const body = {
      topic: "T", judgeModel: "openai:gpt-4o",
      roundCount: 2, maxTokens: 100, teamsEnabled: false, teams: [],
      debaters: [
        { provider: "openai", model: "gpt-4o", displayName: "G", stance: "y", teamIndex: null, speakOrder: 0, voiceUri: "v" },
        { provider: "anthropic", model: "claude-opus-4-7", displayName: "C", stance: "n", teamIndex: null, speakOrder: 1, voiceUri: "v" },
      ],
    };
    const res = await POST(new Request("http://x", { method: "POST", body: JSON.stringify(body) }));
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(typeof data.id).toBe("string");
  });
});
