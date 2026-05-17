/**
 * @jest-environment node
 */
import { GET } from "./route";
import { getDb } from "../../../../../lib/db/connection";
import { createDebate } from "../../../../../lib/db/repo";
import { setStubScript, clearStubScripts } from "../../../../../lib/providers/stub";

async function readAllSseEvents(res: Response): Promise<any[]> {
  const reader = (res.body as ReadableStream).getReader();
  const dec = new TextDecoder();
  let buf = "";
  const events: any[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value);
    let idx;
    while ((idx = buf.indexOf("\n\n")) !== -1) {
      const chunk = buf.slice(0, idx);
      buf = buf.slice(idx + 2);
      const line = chunk.split("\n").find((l) => l.startsWith("data: "));
      if (line) events.push(JSON.parse(line.slice(6)));
    }
  }
  return events;
}

describe("GET /api/debates/[id]/stream", () => {
  beforeEach(() => {
    process.env.DEBATE_USE_STUB_PROVIDERS = "true";
    process.env.DEBATE_DB_PATH = ":memory:";
    clearStubScripts();
  });

  it("streams a full debate's events ending with verdict", async () => {
    setStubScript("gpt-4o", { chunks: ["a"] });
    setStubScript("claude-opus-4-7", { chunks: ["b"] });
    const id = createDebate(getDb(), {
      topic: "T", judgeModel: "openai:gpt-4o", roundCount: 1, maxTokens: 50,
      teamsEnabled: false, teams: [],
      debaters: [
        { provider: "openai", model: "gpt-4o", displayName: "G", stance: "y", teamIndex: null, speakOrder: 0, voiceUri: "v" },
        { provider: "anthropic", model: "claude-opus-4-7", displayName: "C", stance: "n", teamIndex: null, speakOrder: 1, voiceUri: "v" },
      ],
    });

    const res = await GET(new Request(`http://x/api/debates/${id}/stream`), { params: { id } });
    const events = await readAllSseEvents(res);
    expect(events[0].type).toBe("turn_start");
    expect(events[events.length - 1].type).toBe("verdict");
  });
});
