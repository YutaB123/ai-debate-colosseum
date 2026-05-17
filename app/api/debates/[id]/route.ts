import { NextResponse } from "next/server";
import { getDb } from "../../../../lib/db/connection";
import { getDebate } from "../../../../lib/db/repo";
import { getFullTranscript } from "../../../../lib/db/round-repo";

export const runtime = "nodejs";

export async function GET(_req: Request, ctx: { params: { id: string } }): Promise<Response> {
  const db = getDb();
  const debate = getDebate(db, ctx.params.id);
  if (!debate) return NextResponse.json({ error: "not found" }, { status: 404 });
  const transcript = getFullTranscript(db, ctx.params.id);
  return NextResponse.json({ debate, transcript });
}
