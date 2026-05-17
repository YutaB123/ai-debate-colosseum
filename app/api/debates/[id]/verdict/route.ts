import { NextResponse } from "next/server";
import { getDb } from "../../../../../lib/db/connection";
import { setVerdictOverride } from "../../../../../lib/db/round-repo";

export const runtime = "nodejs";

export async function PATCH(req: Request, ctx: { params: { id: string } }): Promise<Response> {
  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "invalid JSON" }, { status: 400 }); }
  if (typeof body.override !== "string") return NextResponse.json({ error: "override required" }, { status: 400 });
  setVerdictOverride(getDb(), ctx.params.id, body.override, typeof body.note === "string" ? body.note : null);
  return NextResponse.json({ ok: true });
}
