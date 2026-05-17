import { notFound } from "next/navigation";
import { getDb } from "../../../lib/db/connection";
import { getDebate } from "../../../lib/db/repo";
import { Stage } from "./stage";

export const runtime = "nodejs";

export default async function DebatePage({ params }: { params: { id: string } }) {
  const debate = getDebate(getDb(), params.id);
  if (!debate) notFound();
  return <Stage debate={debate} />;
}
