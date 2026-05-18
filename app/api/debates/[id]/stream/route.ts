import { getDb } from "../../../../../lib/db/connection";
import { getDebate } from "../../../../../lib/db/repo";
import { getFullTranscript } from "../../../../../lib/db/round-repo";
import { runDebate } from "../../../../../lib/engine/run-debate";
import {
  registerEngine,
  unregisterEngine,
  getEngine,
  attachObserver,
  detachObserver,
  broadcast,
} from "../../../../../lib/engine/state";
import { createSseStream } from "../../../../../lib/api/sse";
import type { EngineEvent } from "../../../../../lib/engine/events";
import type { DB } from "../../../../../lib/db/connection";

export async function GET(req: Request, ctx: { params: { id: string } }): Promise<Response> {
  const id = ctx.params.id;
  const db = getDb();
  const debate = getDebate(db, id);
  if (!debate) return new Response("not found", { status: 404 });
  const statusRow = db.prepare(`SELECT status FROM debates WHERE id = ?`).get(id) as { status: string } | undefined;
  const status = statusRow?.status ?? "setup";

  // If a debate is already running, attach this connection as an observer.
  if (getEngine(id)) {
    return createSseStream((push, close) => {
      replayTranscript(db, id, push);
      attachObserver(id, push);
      req.signal.addEventListener("abort", () => {
        detachObserver(id, push);
        try { close(); } catch { /* already closed */ }
      });
    });
  }

  // Anything past "setup" has rounds in the DB. Restarting would hit UNIQUE
  // on rounds(debate_id, round_number). Replay from DB and stop.
  if (status !== "setup") {
    return createSseStream((push, close) => {
      replayTranscript(db, id, push);
      close();
    });
  }

  // Otherwise start a fresh run, registering this connection as the first observer.
  return createSseStream(async (push, close) => {
    const signals = { paused: false, skipCurrent: false, endDebate: false, pendingInterjection: null as string | null };
    registerEngine({ debate, signals, observers: new Set([push]) });
    req.signal.addEventListener("abort", () => detachObserver(id, push));
    try {
      await runDebate({ db, debate, signals, emit: (e) => broadcast(id, e) });
    } finally {
      unregisterEngine(id);
      try { close(); } catch { /* already closed */ }
    }
  });
}

function replayTranscript(db: DB, debateId: string, push: (e: EngineEvent) => void) {
  const t = getFullTranscript(db, debateId);
  for (const r of t.rounds) {
    let roundFullyClosed = true;
    for (const s of r.speeches) {
      // Skip in-progress speeches — let the live broadcaster deliver them.
      if (s.endedAt === null) {
        roundFullyClosed = false;
        continue;
      }
      push({ type: "turn_start", roundNumber: r.roundNumber, debaterId: s.debaterId });
      if (s.text) push({ type: "chunk", debaterId: s.debaterId, text: s.text });
      if (s.error) {
        push({ type: "turn_error", debaterId: s.debaterId, reason: s.error, partialText: s.text });
      } else {
        push({ type: "turn_end", debaterId: s.debaterId, fullText: s.text, tokenCount: s.tokenCount });
      }
    }
    if (roundFullyClosed) push({ type: "round_end", roundNumber: r.roundNumber });
  }
  if (t.verdict) {
    push({
      type: "verdict",
      winnerDebaterId: t.verdict.winnerDebaterId,
      winnerTeamId: t.verdict.winnerTeamId,
      reasoning: t.verdict.reasoning,
    });
  }
}

// Force Node runtime (not Edge) so we can use better-sqlite3 + Node APIs.
export const runtime = "nodejs";
