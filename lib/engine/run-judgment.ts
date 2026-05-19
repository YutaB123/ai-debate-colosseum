import type { DB } from "../db/connection";
import type { DebateConfig, ProviderId } from "../types";
import type { EngineEvent } from "./events";
import { getProvider } from "../providers/registry";
import { buildJudgeContext } from "./context";
import { getFullTranscript, recordVerdict } from "../db/round-repo";

export interface RunJudgmentArgs {
  db: DB;
  debate: DebateConfig;
  judgeProvider: ProviderId;
  judgeModel: string;
  emit: (e: EngineEvent) => void;
  /** When the user force-ends a debate we want a quick verdict, not a long essay. */
  quickMode?: boolean;
}

export async function runJudgment(args: RunJudgmentArgs): Promise<void> {
  const { db, debate, judgeProvider, judgeModel, emit, quickMode } = args;
  const transcript = getFullTranscript(db, debate.id).rounds;
  const messages = buildJudgeContext({ debate, transcript, quickMode });
  const provider = getProvider(judgeProvider);

  const maxTokens = quickMode ? 120 : 400;
  let raw = "";
  for await (const chunk of provider.streamCompletion({ model: judgeModel, messages, maxTokens })) {
    if (chunk.type === "text") raw += chunk.text;
    if (chunk.type === "error") {
      const v = { winnerDebaterId: null, winnerTeamId: null, reasoning: `(Judge unavailable: ${chunk.message})` };
      recordVerdict(db, debate.id, v);
      emit({ type: "verdict", ...v });
      return;
    }
  }

  const parsed = parseVerdict(raw);
  const winnerDebaterId = parsed.winnerDebater
    ? debate.debaters.find((d) => d.displayName === parsed.winnerDebater)?.id ?? null
    : null;
  const winnerTeamId = parsed.winnerTeam
    ? debate.teams.find((t) => t.name === parsed.winnerTeam)?.id ?? null
    : null;

  const verdict = { winnerDebaterId, winnerTeamId, reasoning: parsed.reasoning };
  recordVerdict(db, debate.id, verdict);
  emit({ type: "verdict", ...verdict });
}

function parseVerdict(raw: string): { winnerDebater: string | null; winnerTeam: string | null; reasoning: string } {
  // Try to extract a JSON object from the raw text.
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return { winnerDebater: null, winnerTeam: null, reasoning: `(unparseable judge output) ${raw.slice(0, 200)}` };
  try {
    const obj = JSON.parse(match[0]);
    return {
      winnerDebater: typeof obj.winnerDebater === "string" ? obj.winnerDebater : null,
      winnerTeam:    typeof obj.winnerTeam === "string"    ? obj.winnerTeam    : null,
      reasoning:     typeof obj.reasoning === "string"     ? obj.reasoning     : "(no reasoning)",
    };
  } catch {
    return { winnerDebater: null, winnerTeam: null, reasoning: `(unparseable judge JSON) ${raw.slice(0, 200)}` };
  }
}
