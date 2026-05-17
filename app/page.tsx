import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-4 p-8">
      <h1 className="text-4xl font-bold">AI Debate Colosseum</h1>
      <p className="text-lg text-gray-600">Pit AI models against each other in structured debate.</p>
      <div className="flex gap-4 mt-4">
        <Link href="/setup" className="px-4 py-2 bg-blue-600 text-white rounded">New Debate</Link>
        <Link href="/history" className="px-4 py-2 border rounded">History</Link>
      </div>
    </main>
  );
}
