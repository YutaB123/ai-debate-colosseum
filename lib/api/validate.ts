import type { ProviderId } from "../types";

export interface DebateRequestBody {
  topic: string;
  judgeModel: string; // "provider:model"
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
  }[];
}

export function validateDebateRequest(body: any): { ok: true; body: DebateRequestBody } | { ok: false; error: string } {
  const errors: string[] = [];
  if (typeof body?.topic !== "string" || body.topic.length === 0) errors.push("topic required");
  if (typeof body?.judgeModel !== "string" || !body.judgeModel.includes(":")) errors.push("judgeModel must be 'provider:model'");
  if (!Number.isInteger(body?.roundCount) || body.roundCount < 1 || body.roundCount > 20) errors.push("roundCount must be 1..20");
  if (!Number.isInteger(body?.maxTokens) || body.maxTokens < 50 || body.maxTokens > 500) errors.push("maxTokens must be 50..500");
  if (typeof body?.teamsEnabled !== "boolean") errors.push("teamsEnabled must be boolean");
  if (!Array.isArray(body?.debaters) || body.debaters.length < 2 || body.debaters.length > 6) errors.push("debaters must be 2..6");
  if (errors.length > 0) return { ok: false, error: errors.join("; ") };

  // Preflight: every used provider must have an API key.
  const used = new Set<string>(body.debaters.map((d: any) => d.provider));
  used.add(body.judgeModel.split(":")[0]);
  const missing: string[] = [];
  for (const p of used) {
    const envName = providerEnvVar(p as ProviderId);
    if (!process.env[envName]) missing.push(`${p} (${envName})`);
  }
  if (missing.length > 0) return { ok: false, error: `missing API keys: ${missing.join(", ")}` };

  return { ok: true, body: body as DebateRequestBody };
}

export function providerEnvVar(p: ProviderId): string {
  switch (p) {
    case "openai": return "OPENAI_API_KEY";
    case "anthropic": return "ANTHROPIC_API_KEY";
    case "deepseek": return "DEEPSEEK_API_KEY";
    case "gemini": return "GOOGLE_API_KEY";
  }
}
