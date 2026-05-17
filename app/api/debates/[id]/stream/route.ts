import { getDb } from "../../../../../lib/db/connection";
import { getDebate } from "../../../../../lib/db/repo";
import { runDebate } from "../../../../../lib/engine/run-debate";
import { registerEngine, unregisterEngine } from "../../../../../lib/engine/state";
import { createSseStream } from "../../../../../lib/api/sse";

export async function GET(_req: Request, ctx: { params: { id: string } }): Promise<Response> {
  const id = ctx.params.id;
  const db = getDb();
  const debate = getDebate(db, id);
  if (!debate) return new Response("not found", { status: 404 });

  return createSseStream(async (push, close) => {
    const signals = { paused: false, skipCurrent: false, pendingInterjection: null as string | null };
    registerEngine({ debate, signals, emit: (e) => push(e) });
    try {
      await runDebate({ db, debate, signals, emit: (e) => push(e) });
    } finally {
      unregisterEngine(id);
      close();
    }
  });
}

// Force Node runtime (not Edge) so we can use better-sqlite3 + Node APIs.
export const runtime = "nodejs";
