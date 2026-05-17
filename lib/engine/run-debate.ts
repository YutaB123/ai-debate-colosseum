import type { DB } from "../db/connection";
import type { DebateConfig, ProviderId } from "../types";
import type { EngineEvent } from "./events";
import type { ControlSignals } from "./state";
import { runRound } from "./run-round";
import { runHuddle } from "./run-huddle";
import { runJudgment } from "./run-judgment";
import { createRound } from "../db/round-repo";
import { setDebateStatus } from "../db/repo";

export interface RunDebateArgs {
  db: DB;
  debate: DebateConfig;
  signals: ControlSignals;
  emit: (e: EngineEvent) => void;
}

export async function runDebate(args: RunDebateArgs): Promise<void> {
  const { db, debate, signals, emit } = args;
  setDebateStatus(db, debate.id, "running");

  try {
    for (let n = 1; n <= debate.roundCount; n++) {
      const roundId = createRound(db, debate.id, n);
      await runRound({ db, debate, roundId, roundNumber: n, signals, emit });

      // Run huddle after every round except the last.
      if (n < debate.roundCount) {
        await runHuddle({ db, debate, roundId, roundNumber: n, emit });
      }
    }

    const [jProvider, jModel] = parseJudgeModel(debate.judgeModel);
    await runJudgment({ db, debate, judgeProvider: jProvider, judgeModel: jModel, emit });
    setDebateStatus(db, debate.id, "completed");
  } catch (e: any) {
    emit({ type: "error", message: e?.message ?? String(e) });
    setDebateStatus(db, debate.id, "failed");
  }
}

function parseJudgeModel(s: string): [ProviderId, string] {
  const [p, ...rest] = s.split(":");
  if (!p || rest.length === 0) throw new Error(`bad judgeModel format: ${s}`);
  return [p as ProviderId, rest.join(":")];
}
