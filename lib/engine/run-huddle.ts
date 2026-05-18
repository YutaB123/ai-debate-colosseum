import type { DB } from "../db/connection";
import type { DebateConfig } from "../types";
import type { EngineEvent } from "./events";
import type { ControlSignals } from "./state";
import { getProvider } from "../providers/registry";
import { buildHuddleContext } from "./context";
import { getFullTranscript, recordWhisper, setRoundStatus } from "../db/round-repo";

export interface RunHuddleArgs {
  db: DB;
  debate: DebateConfig;
  roundId: string;
  roundNumber: number;
  signals?: ControlSignals;
  emit: (e: EngineEvent) => void;
}

export async function runHuddle(args: RunHuddleArgs): Promise<void> {
  const { db, debate, roundId, roundNumber, signals, emit } = args;
  if (signals?.endDebate) return;
  if (!debate.teamsEnabled) return;

  setRoundStatus(db, roundId, "huddle");
  emit({ type: "huddle_start", roundNumber });

  const transcript = getFullTranscript(db, debate.id).rounds;

  await Promise.all(
    debate.debaters
      .filter((d) => !d.disabled && d.teamId)
      .map(async (debater) => {
        const provider = getProvider(debater.provider);
        const messages = buildHuddleContext({ debate, speaker: debater, roundNumber, transcript });
        let text = "";
        for await (const chunk of provider.streamCompletion({
          model: debater.model,
          messages,
          maxTokens: Math.floor(debate.maxTokens / 2),
        })) {
          if (chunk.type === "text") text += chunk.text;
          if (chunk.type === "error") break;
        }
        if (text) {
          recordWhisper(db, roundId, debater.id, debater.teamId!, text);
          emit({ type: "whisper", teamId: debater.teamId!, debaterId: debater.id, text });
        }
      })
  );

  emit({ type: "huddle_end", roundNumber });
}
