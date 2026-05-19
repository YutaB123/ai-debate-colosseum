import { NextResponse } from "next/server";
import { getDb } from "../../../../../lib/db/connection";
import { getDebate } from "../../../../../lib/db/repo";
import { runScoring } from "../../../../../lib/engine/run-scoring";
import type { ProviderId } from "../../../../../lib/types";

export const runtime = "nodejs";

export async function POST(_req: Request, ctx: { params: { id: string } }): Promise<Response> {
  const db = getDb();
  const debate = getDebate(db, ctx.params.id);
  if (!debate) return NextResponse.json({ error: "not found" }, { status: 404 });

  const [provider, ...rest] = debate.judgeModel.split(":");
  const model = rest.join(":");
  if (!provider || !model) {
    return NextResponse.json({ error: "bad judgeModel" }, { status: 500 });
  }

  try {
    const result = await runScoring({
      db, debate,
      judgeProvider: provider as ProviderId,
      judgeModel: model,
    });
    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? String(e) }, { status: 500 });
  }
}
