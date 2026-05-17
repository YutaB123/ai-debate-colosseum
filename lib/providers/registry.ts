import type { ProviderId, StreamingProvider } from "../types";
import { createStubProvider } from "./stub";

const KNOWN: ProviderId[] = ["openai", "anthropic", "deepseek", "gemini"];

export function getProvider(id: ProviderId): StreamingProvider {
  if (!KNOWN.includes(id)) {
    throw new Error(`unknown provider: ${id}`);
  }
  if (process.env.DEBATE_USE_STUB_PROVIDERS === "true") {
    return createStubProvider(id);
  }
  // Real adapters wired up in Task 6+
  throw new Error(`real provider for ${id} not yet implemented`);
}
