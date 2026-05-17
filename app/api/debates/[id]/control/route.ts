import { NextResponse } from "next/server";
import { getEngine } from "../../../../../lib/engine/state";
import { getDb } from "../../../../../lib/db/connection";
import { recordVote } from "../../../../../lib/db/round-repo";

export const runtime = "nodejs";

export async function POST(req: Request, ctx: { params: { id: string } }): Promise<Response> {
  const engine = getEngine(ctx.params.id);
  if (!engine) return NextResponse.json({ error: "no running engine" }, { status: 404 });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  switch (body.action) {
    case "pause":   engine.signals.paused = true;  return NextResponse.json({ ok: true });
    case "resume":  engine.signals.paused = false; return NextResponse.json({ ok: true });
    case "skip":    engine.signals.skipCurrent = true; return NextResponse.json({ ok: true });
    case "interject":
      if (typeof body.text !== "string" || body.text.length === 0)
        return NextResponse.json({ error: "text required" }, { status: 400 });
      engine.signals.pendingInterjection = body.text;
      return NextResponse.json({ ok: true });
    case "vote":
      if (typeof body.roundId !== "string" || typeof body.debaterId !== "string")
        return NextResponse.json({ error: "roundId and debaterId required" }, { status: 400 });
      recordVote(getDb(), body.roundId, body.debaterId);
      return NextResponse.json({ ok: true });
    default:
      return NextResponse.json({ error: "unknown action" }, { status: 400 });
  }
}
