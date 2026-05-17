import Link from "next/link";
import { getDb } from "../../lib/db/connection";
import { listDebates } from "../../lib/db/repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function HistoryPage() {
  const rows = listDebates(getDb());
  return (
    <main className="min-h-screen p-8 max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Past Debates</h1>
      {rows.length === 0 && <p className="text-gray-500">No debates yet. <Link href="/setup" className="text-blue-600 underline">Start one</Link>.</p>}
      <ul className="divide-y">
        {rows.map((r) => (
          <li key={r.id} className="py-3 flex items-center justify-between">
            <div>
              <div className="font-semibold">{r.topic}</div>
              <div className="text-xs text-gray-500">
                {new Date(r.createdAt).toLocaleString()} · status: {r.status}
              </div>
            </div>
            <Link className="px-3 py-1 border rounded text-sm" href={`/debate/${r.id}?replay=1`}>Open</Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
