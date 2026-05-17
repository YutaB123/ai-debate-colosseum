/**
 * @jest-environment node
 */
import { GET } from "./route";
import { getDb } from "../../../../lib/db/connection";
import { createDebate } from "../../../../lib/db/repo";

beforeEach(() => { process.env.DEBATE_DB_PATH = ":memory:"; });

describe("GET /api/debates/[id]", () => {
  it("returns the debate config and an empty transcript when nothing has run", async () => {
    const id = createDebate(getDb(), {
      topic: "T", judgeModel: "openai:gpt-4o", roundCount: 1, maxTokens: 100, teamsEnabled: false, teams: [],
      debaters: [{ provider: "openai", model: "gpt-4o", displayName: "G", stance: "y", teamIndex: null, speakOrder: 0, voiceUri: "v" }],
    });
    const res = await GET(new Request("http://x"), { params: { id } });
    expect(res.status).toBe(200);
    const j = await res.json();
    expect(j.debate.topic).toBe("T");
    expect(j.transcript.rounds).toEqual([]);
  });

  it("404s on unknown id", async () => {
    const res = await GET(new Request("http://x"), { params: { id: "missing" } });
    expect(res.status).toBe(404);
  });
});
