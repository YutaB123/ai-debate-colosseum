import type { ProviderId, StreamingProvider } from "../types";
import { createStubProvider } from "./stub";
import { createOpenAIProvider } from "./openai";

const KNOWN: ProviderId[] = ["openai", "anthropic", "deepseek", "gemini"];

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
    case "deepseek":
      return createOpenAIProvider({
        apiKey: requireEnv("DEEPSEEK_API_KEY"),
        baseURL: "https://api.deepseek.com/v1",
      });
    case "anthropic":
    case "gemini":
      throw new Error(`real provider for ${id} not yet implemented`);
  }
}

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`missing env var: ${name}`);
  return v;
}
