import type { DB } from "../db/connection";
import type { DebateConfig, ProviderId } from "../types";
import { getProvider } from "../providers/registry";
import { getFullTranscript, type TranscriptRound } from "../db/round-repo";

export interface ScoringResult {
  scores: Record<string, number>;
}

export async function runScoring(args: {
  db: DB;
  debate: DebateConfig;
  judgeProvider: ProviderId;
  judgeModel: string;
}): Promise<ScoringResult> {
  const { db, debate, judgeProvider, judgeModel } = args;
  const transcript = getFullTranscript(db, debate.id).rounds;

  const debaterNames = debate.debaters.map((d) => d.displayName);

  const systemPrompt = [
    `You are scoring a live debate. After the latest speech, who is winning RIGHT NOW?`,
    `Topic: "${debate.topic}".`,
    `Debaters: ${debaterNames.join(", ")}.`,
    ``,
    `Give each debater a score from 0 to 100. The scores must sum to exactly 100.`,
    `Be decisive — don't park everyone at 50. If someone just landed a killer line, tilt the score hard. If someone whiffed, dock them.`,
    ``,
    `Output ONLY this JSON, nothing else:`,
    `{"scores": {${debaterNames.map((n) => `"${n}": <number>`).join(", ")}}}`,
  ].join("\n");

  const messages = [
    { role: "system" as const, content: systemPrompt },
    { role: "user" as const, content: `TRANSCRIPT SO FAR:\n${renderShort(debate, transcript)}` },
  ];

  const provider = getProvider(judgeProvider);
  let raw = "";
  for await (const chunk of provider.streamCompletion({ model: judgeModel, messages, maxTokens: 100 })) {
    if (chunk.type === "text") raw += chunk.text;
    if (chunk.type === "error") return defaultScores(debaterNames);
  }

  return parseScores(raw, debaterNames);
}

function renderShort(d: DebateConfig, rounds: TranscriptRound[]): string {
  if (rounds.length === 0) return "(no speeches yet)";
  const out: string[] = [];
  for (const r of rounds) {
    for (const s of r.speeches) {
      const sp = d.debaters.find((x) => x.id === s.debaterId);
      out.push(`${sp?.displayName ?? "?"}: ${s.text}`);
    }
  }
  return out.join("\n");
}

function defaultScores(names: string[]): ScoringResult {
  const even = Math.floor(100 / names.length);
  const scores: Record<string, number> = {};
  for (const n of names) scores[n] = even;
  return { scores };
}

function parseScores(raw: string, names: string[]): ScoringResult {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return defaultScores(names);
  try {
    const obj = JSON.parse(match[0]);
    const scores: Record<string, number> = {};
    let total = 0;
    for (const n of names) {
      const v = Number(obj.scores?.[n]);
      scores[n] = Number.isFinite(v) ? Math.max(0, Math.min(100, v)) : 0;
      total += scores[n];
    }
    // Normalize to sum 100 in case the model didn't.
    if (total > 0 && Math.abs(total - 100) > 1) {
      for (const n of names) scores[n] = Math.round((scores[n] / total) * 100);
    }
    return { scores };
  } catch {
    return defaultScores(names);
  }
}
