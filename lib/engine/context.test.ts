import { buildSpeechContext, buildHuddleContext, buildJudgeContext } from "./context";
import type { DebateConfig, Debater } from "../types";

function mkDebate(): DebateConfig {
  return {
    id: "d", topic: "Is fire wet?", judgeModel: "openai:gpt-4o",
    roundCount: 3, maxTokens: 150, teamsEnabled: true,
    teams: [
      { id: "t1", debateId: "d", name: "Blue", color: "#00f" },
      { id: "t2", debateId: "d", name: "Red",  color: "#f00" },
    ],
    debaters: [
      { id: "claude", debateId: "d", provider: "anthropic", model: "claude-opus-4-7",
        displayName: "Claude", stance: "wet", teamId: "t1", speakOrder: 0, voiceUri: "v", disabled: false },
      { id: "ds",     debateId: "d", provider: "deepseek",  model: "deepseek-chat",
        displayName: "DeepSeek", stance: "wet", teamId: "t1", speakOrder: 1, voiceUri: "v", disabled: false },
      { id: "gpt",    debateId: "d", provider: "openai",    model: "gpt-4o",
        displayName: "GPT", stance: "dry", teamId: "t2", speakOrder: 2, voiceUri: "v", disabled: false },
      { id: "gem",    debateId: "d", provider: "gemini",    model: "gemini-1.5-pro",
        displayName: "Gemini", stance: "dry", teamId: "t2", speakOrder: 3, voiceUri: "v", disabled: false },
    ],
  };
}

const transcript = [
  { roundNumber: 1, speeches: [
    { debaterId: "claude", text: "Wet because plasma.", tokenCount: 5, error: null },
    { debaterId: "ds",     text: "Wet because steam.",  tokenCount: 5, error: null },
    { debaterId: "gpt",    text: "Dry by definition.",  tokenCount: 5, error: null },
    { debaterId: "gem",    text: "Dry: lacks water.",   tokenCount: 5, error: null },
  ], whispers: [
    { debaterId: "claude", teamId: "t1", text: "BLUE_SECRET" },
    { debaterId: "gpt",    teamId: "t2", text: "RED_SECRET" },
  ], votes: [], interjections: [] },
];

describe("context builder", () => {
  it("includes own team's whispers but never the opposing team's", () => {
    const d = mkDebate();
    const claudeCtx = buildSpeechContext({ debate: d, speaker: d.debaters[0], roundNumber: 2, transcript });
    const ctxText = claudeCtx.map((m) => m.content).join("\n");
    expect(ctxText).toContain("BLUE_SECRET");
    expect(ctxText).not.toContain("RED_SECRET");

    const gptCtx = buildSpeechContext({ debate: d, speaker: d.debaters[2], roundNumber: 2, transcript });
    const gptText = gptCtx.map((m) => m.content).join("\n");
    expect(gptText).toContain("RED_SECRET");
    expect(gptText).not.toContain("BLUE_SECRET");
  });

  it("includes the public transcript for every speaker", () => {
    const d = mkDebate();
    for (const speaker of d.debaters) {
      const ctx = buildSpeechContext({ debate: d, speaker, roundNumber: 2, transcript });
      const txt = ctx.map((m) => m.content).join("\n");
      expect(txt).toContain("Wet because plasma.");
      expect(txt).toContain("Dry by definition.");
    }
  });

  it("includes interjections in the context", () => {
    const d = mkDebate();
    const tr2 = [...transcript, { roundNumber: 2, speeches: [], whispers: [],
      votes: [], interjections: [{ text: "Mod says: focus" }] }];
    const ctx = buildSpeechContext({ debate: d, speaker: d.debaters[0], roundNumber: 2, transcript: tr2 });
    expect(ctx.some((m) => m.content.includes("Mod says: focus"))).toBe(true);
  });

  it("builds a huddle context only with own-team whispers", () => {
    const d = mkDebate();
    const ctx = buildHuddleContext({ debate: d, speaker: d.debaters[0], roundNumber: 2, transcript });
    const txt = ctx.map((m) => m.content).join("\n");
    expect(txt).toContain("BLUE_SECRET");
    expect(txt).not.toContain("RED_SECRET");
  });

  it("judge context contains public speeches but never whispers", () => {
    const d = mkDebate();
    const ctx = buildJudgeContext({ debate: d, transcript });
    const txt = ctx.map((m) => m.content).join("\n");
    expect(txt).toContain("Wet because plasma.");
    expect(txt).not.toContain("BLUE_SECRET");
    expect(txt).not.toContain("RED_SECRET");
  });
});
