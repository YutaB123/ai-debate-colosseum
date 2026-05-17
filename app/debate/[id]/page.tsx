import { notFound } from "next/navigation";
import { getDb } from "../../../lib/db/connection";
import { getDebate } from "../../../lib/db/repo";
import { getFullTranscript } from "../../../lib/db/round-repo";
import { Stage } from "./stage";

export const runtime = "nodejs";

export default async function DebatePage({ params, searchParams }: { params: { id: string }; searchParams: { replay?: string } }) {
  const db = getDb();
  const debate = getDebate(db, params.id);
  if (!debate) notFound();
  if (searchParams.replay === "1") {
    const transcript = getFullTranscript(db, params.id);
    return <Stage debate={debate} replay={transcript} />;
  }
  return <Stage debate={debate} />;
}
