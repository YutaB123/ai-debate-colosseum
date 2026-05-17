import { NextResponse } from "next/server";
import { getDb } from "../../../lib/db/connection";
import { createDebate, listDebates } from "../../../lib/db/repo";
import { validateDebateRequest } from "../../../lib/api/validate";

export const runtime = "nodejs";

export async function POST(req: Request): Promise<Response> {
  let json: any;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  const v = validateDebateRequest(json);
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });

  const id = createDebate(getDb(), v.body);
  return NextResponse.json({ id }, { status: 201 });
}

export async function GET(): Promise<Response> {
  return NextResponse.json({ debates: listDebates(getDb()) });
}
