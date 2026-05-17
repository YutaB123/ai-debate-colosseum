import { SetupForm } from "../../components/setup-form";

export default function SetupPage() {
  return (
    <main className="min-h-screen p-8 max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Configure Debate</h1>
      <SetupForm />
    </main>
  );
}
