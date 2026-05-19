import type { DebateConfig, PersonaId, ProviderId } from "../types";

export interface CreateDebateBody {
  topic: string;
  judgeModel: string;
  roundCount: number;
  maxTokens: number;
  teamsEnabled: boolean;
  teams: { name: string; color: string }[];
  debaters: {
    provider: ProviderId;
    model: string;
    displayName: string;
    stance: string;
    teamIndex: number | null;
    speakOrder: number;
    voiceUri: string;
    persona?: PersonaId;
  }[];
}

export async function createDebateApi(body: CreateDebateBody): Promise<{ id: string }> {
  const res = await fetch("/api/debates", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error(j.error ?? `HTTP ${res.status}`);
  }
  return res.json();
}

export async function getDebateApi(id: string): Promise<{ debate: DebateConfig; transcript: any }> {
  const res = await fetch(`/api/debates/${id}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function listDebatesApi(): Promise<{ debates: { id: string; topic: string; status: string; createdAt: number }[] }> {
  const res = await fetch("/api/debates");
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function postControl(id: string, body: any): Promise<void> {
  const res = await fetch(`/api/debates/${id}/control`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}

export async function setVerdictOverrideApi(id: string, override: string, note?: string): Promise<void> {
  const res = await fetch(`/api/debates/${id}/verdict`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ override, note }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}
