import type { DB } from "../db/connection";
import type { DebateConfig } from "../types";
import type { EngineEvent } from "./events";
import type { ControlSignals } from "./state";
import { getProvider } from "../providers/registry";
import { buildSpeechContext } from "./context";
import { beginSpeech, finalizeSpeech, getFullTranscript, recordInterjection, setRoundStatus } from "../db/round-repo";

export interface RunRoundArgs {
  db: DB;
  debate: DebateConfig;
  roundId: string;
  roundNumber: number;
  signals: ControlSignals;
  emit: (e: EngineEvent) => void;
}

export async function runRound(args: RunRoundArgs): Promise<void> {
  const { db, debate, roundId, roundNumber, signals, emit } = args;
  setRoundStatus(db, roundId, "speaking");

  for (const debater of debate.debaters) {
    if (signals.endDebate) break;
    if (debater.disabled) continue;

    if (signals.pendingInterjection) {
      const text = signals.pendingInterjection;
      recordInterjection(db, roundId, text);
      signals.pendingInterjection = null;
      emit({ type: "interjection_received", roundNumber, text });
    }

    while (signals.paused && !signals.endDebate) {
      await new Promise((r) => setTimeout(r, 100));
    }
    if (signals.endDebate) break;

    signals.skipCurrent = false;
    emit({ type: "turn_start", roundNumber, debaterId: debater.id });

    const speechId = beginSpeech(db, roundId, debater.id);
    const transcript = getFullTranscript(db, debate.id).rounds;
    const messages = buildSpeechContext({ debate, speaker: debater, roundNumber, transcript });
    const provider = getProvider(debater.provider);

    let full = "";
    let tokenCount = 0;
    let error: string | null = null;

    try {
      for await (const chunk of provider.streamCompletion({
        model: debater.model,
        messages,
        maxTokens: debate.maxTokens,
      })) {
        if (signals.skipCurrent || signals.endDebate) break;
        while (signals.paused && !signals.endDebate && !signals.skipCurrent) {
          await new Promise((r) => setTimeout(r, 100));
        }
        if (signals.skipCurrent || signals.endDebate) break;
        if (chunk.type === "error") {
          error = chunk.message;
          break;
        }
        full += chunk.text;
        tokenCount += approxTokens(chunk.text);
        emit({ type: "chunk", debaterId: debater.id, text: chunk.text });
      }
    } catch (e: any) {
      error = e?.message ?? String(e);
    }

    finalizeSpeech(db, speechId, full, tokenCount, error ?? undefined);

    if (error) {
      emit({ type: "turn_error", debaterId: debater.id, reason: error, partialText: full });
    } else {
      emit({ type: "turn_end", debaterId: debater.id, fullText: full, tokenCount });
    }
  }

  emit({ type: "round_end", roundNumber });
  setRoundStatus(db, roundId, "completed");
}

function approxTokens(text: string): number {
  // Rough heuristic: ~4 chars per token.
  return Math.max(1, Math.round(text.length / 4));
}
