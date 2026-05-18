import type { ProviderId, StreamingProvider } from "../types";
import { createStubProvider } from "./stub";
import { createOpenAIProvider } from "./openai";
import { createAnthropicProvider } from "./anthropic";
import { createGeminiProvider } from "./gemini";

const KNOWN: ProviderId[] = ["openai", "anthropic", "gemini"];

export function getProvider(id: ProviderId): StreamingProvider {
  if (!KNOWN.includes(id)) {
    throw new Error(`unknown provider: ${id}`);
  }
  if (process.env.DEBATE_USE_STUB_PROVIDERS === "true") {
    return createStubProvider(id);
  }
  switch (id) {
    case "openai":
      return createOpenAIProvider({ apiKey: requireEnv("OPENAI_API_KEY") });
    case "anthropic":
      return createAnthropicProvider({ apiKey: requireEnv("ANTHROPIC_API_KEY") });
    case "gemini":
      return createGeminiProvider({ apiKey: requireEnv("GOOGLE_API_KEY") });
  }
}

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`missing env var: ${name}`);
  return v;
}
