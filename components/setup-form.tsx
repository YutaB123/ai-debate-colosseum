"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { VoicePicker } from "./voice-picker";
import { ModelPicker } from "./model-picker";

const TOPIC_SUGGESTIONS = [
  "Should pineapple belong on pizza?",
  "Is a hot dog a sandwich?",
  "Are cats better pets than dogs?",
  "Should the workweek be four days?",
  "Is social media doing more harm than good?",
  "Are paper books better than e-books?",
  "Should self-driving cars be allowed on public roads?",
  "Is the book always better than the movie?",
  "Should AI-generated art count as real art?",
  "Is coffee better than tea?",
  "Should kids have smartphones before they're 14?",
  "Is daylight saving time worth keeping?",
  "Should voting be mandatory?",
  "Are open-plan offices a mistake?",
  "Should billionaires exist?",
  "Is texting ruining the English language?",
  "Should universities be free to attend?",
  "Are remote workers more productive than office workers?",
  "Should we try to colonize Mars in this century?",
  "Are zoos ethical?",
  "Should we ban single-use plastics outright?",
  "Is space exploration worth the cost?",
  "Should children be allowed to vote?",
  "Is veganism the future of food?",
  "Is cereal a soup?",
];

function pickRandomTopic(current: string): string {
  if (TOPIC_SUGGESTIONS.length <= 1) return TOPIC_SUGGESTIONS[0];
  const choices = TOPIC_SUGGESTIONS.filter((t) => t !== current);
  return choices[Math.floor(Math.random() * choices.length)];
}
import { createDebateApi } from "../lib/client/api";
import type { ProviderId } from "../lib/types";

interface DebaterRow {
  provider: ProviderId;
  model: string;
  displayName: string;
  stance: string;
  aiChoosesStance: boolean;
  teamIndex: number | null;
  voiceUri: string;
}

const blankDebater = (i: number): DebaterRow => ({
  provider: "openai", model: "gpt-4o", displayName: "Debater " + (i + 1),
  stance: "", aiChoosesStance: false, teamIndex: null, voiceUri: "",
});

export function SetupForm() {
  const router = useRouter();
  const [topic, setTopic] = useState("");
  const [rounds, setRounds] = useState(10);
  const [maxTokens, setMaxTokens] = useState(60);
  const [teamsEnabled, setTeamsEnabled] = useState(false);
  const [judgeModel, setJudgeModel] = useState("openai:gpt-4o");
  const [debaters, setDebaters] = useState<DebaterRow[]>([blankDebater(0), blankDebater(1), blankDebater(2), blankDebater(3)]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const teams = teamsEnabled
    ? [{ name: "Team Blue", color: "#4285f4" }, { name: "Team Red", color: "#d97757" }]
    : [];

  const updateDebater = (i: number, patch: Partial<DebaterRow>) => {
    setDebaters((arr) => arr.map((d, idx) => (idx === i ? { ...d, ...patch } : d)));
  };

  const addDebater = () => setDebaters((arr) => arr.length < 6 ? [...arr, blankDebater(arr.length)] : arr);
  const removeDebater = (i: number) => setDebaters((arr) => arr.length > 2 ? arr.filter((_, idx) => idx !== i) : arr);

  const canSubmit = topic.length > 0
    && debaters.every((d) => (d.aiChoosesStance || d.stance.length > 0) && d.voiceUri.length > 0)
    && !debaters.some((d) => `${d.provider}:${d.model}` === judgeModel);

  const submit = async () => {
    setSubmitting(true); setError(null);
    try {
      const body = {
        topic, judgeModel, roundCount: rounds, maxTokens, teamsEnabled, teams,
        debaters: debaters.map((d, i) => ({
          provider: d.provider, model: d.model, displayName: d.displayName,
          stance: d.aiChoosesStance ? "" : d.stance,
          teamIndex: teamsEnabled ? (d.teamIndex ?? 0) : null,
          speakOrder: i, voiceUri: d.voiceUri,
        })),
      };
      const { id } = await createDebateApi(body);
      router.push(`/debate/${id}`);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <label className="block">
        <span className="font-semibold">Topic</span>
        <div className="mt-1 flex gap-2">
          <input className="flex-1 border rounded px-3 py-2"
                 placeholder="Should AI systems disclose when they are uncertain?"
                 value={topic} onChange={(e) => setTopic(e.target.value)} />
          <button type="button"
                  title="Pick a random debate topic"
                  className="px-3 py-2 border rounded text-sm bg-white hover:bg-gray-50 whitespace-nowrap"
                  onClick={() => setTopic(pickRandomTopic(topic))}>
            🎲 Random topic
          </button>
        </div>
      </label>

      <div className="grid grid-cols-2 gap-4">
        <label className="block">
          <span className="font-semibold">Exchanges per debater</span>
          <input type="number" min={1} max={20} className="mt-1 w-full border rounded px-3 py-2"
                 value={rounds} onChange={(e) => setRounds(Number(e.target.value))} />
          <span className="text-xs text-gray-500">How many times each debater speaks. 10 ≈ a real back-and-forth.</span>
        </label>
        <label className="block">
          <span className="font-semibold">Tokens per turn (≈ 1-3 sentences)</span>
          <input type="range" min={30} max={300} step={10}
                 value={maxTokens} onChange={(e) => setMaxTokens(Number(e.target.value))}
                 className="mt-3 w-full" />
          <span className="text-sm text-gray-600">{maxTokens} tokens</span>
        </label>
      </div>

      <label className="flex items-center gap-2">
        <input type="checkbox" checked={teamsEnabled} onChange={(e) => setTeamsEnabled(e.target.checked)} />
        <span className="font-semibold">Enable teams (2 teams, hidden inter-round huddles)</span>
      </label>

      <div>
        <h2 className="font-semibold mb-2">Debaters ({debaters.length})</h2>
        <div className="space-y-3">
          {debaters.map((d, i) => (
            <div key={i} className="border rounded p-3 space-y-2">
              <div className="flex flex-wrap gap-2 items-center">
                <ModelPicker
                  value={`${d.provider}:${d.model}`}
                  excludeKeys={[judgeModel]}
                  onChange={(v) => {
                    const [p, m] = v.split(":");
                    updateDebater(i, { provider: p as ProviderId, model: m });
                  }}
                />
                <input className="border rounded px-2 py-1 text-sm w-32"
                       placeholder="Display name"
                       value={d.displayName}
                       onChange={(e) => updateDebater(i, { displayName: e.target.value })} />
                <VoicePicker value={d.voiceUri} onChange={(v) => updateDebater(i, { voiceUri: v })} />
                {teamsEnabled && (
                  <select className="border rounded px-2 py-1 text-sm"
                          value={d.teamIndex ?? 0}
                          onChange={(e) => updateDebater(i, { teamIndex: Number(e.target.value) })}>
                    <option value={0}>Team Blue</option>
                    <option value={1}>Team Red</option>
                  </select>
                )}
                <button type="button" className="text-red-600 text-sm ml-auto"
                        onClick={() => removeDebater(i)} disabled={debaters.length <= 2}>Remove</button>
              </div>
              <div className="flex gap-2 items-center">
                <input className="flex-1 border rounded px-2 py-1 text-sm disabled:bg-gray-100 disabled:text-gray-400"
                       placeholder={d.aiChoosesStance ? "AI will pick its own side" : "Stance (what this AI must defend)"}
                       disabled={d.aiChoosesStance}
                       value={d.aiChoosesStance ? "" : d.stance}
                       onChange={(e) => updateDebater(i, { stance: e.target.value })} />
                <label className="flex items-center gap-1 text-xs whitespace-nowrap">
                  <input type="checkbox" checked={d.aiChoosesStance}
                         onChange={(e) => updateDebater(i, { aiChoosesStance: e.target.checked })} />
                  Let AI pick side
                </label>
              </div>
            </div>
          ))}
          <button type="button" className="text-blue-600 text-sm"
                  onClick={addDebater} disabled={debaters.length >= 6}>+ Add debater</button>
        </div>
      </div>

      <div className="block">
        <div className="font-semibold mb-1">Judge (cannot be a debater)</div>
        <ModelPicker
          value={judgeModel}
          excludeKeys={debaters.map((d) => `${d.provider}:${d.model}`)}
          onChange={(v) => setJudgeModel(v)}
        />
      </div>

      {error && <div className="text-red-600 text-sm">{error}</div>}
      <button type="button" disabled={!canSubmit || submitting}
              onClick={submit}
              className="px-6 py-2 rounded bg-blue-600 text-white disabled:opacity-50">
        {submitting ? "Starting…" : "Start debate"}
      </button>
    </div>
  );
}
