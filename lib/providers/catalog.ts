import type { ProviderId } from "../types";

export interface ModelDescriptor {
  provider: ProviderId;
  model: string;       // SDK model id
  label: string;       // shown in UI
  brandColor: string;  // hex, used for podium accents
}

export const CATALOG: ModelDescriptor[] = [
  // OpenAI
  { provider: "openai",    model: "gpt-4o",                  label: "GPT-4o",                brandColor: "#10a37f" },
  { provider: "openai",    model: "gpt-4o-mini",             label: "GPT-4o mini",           brandColor: "#10a37f" },
  // Anthropic
  { provider: "anthropic", model: "claude-opus-4-7",         label: "Claude Opus 4.7",       brandColor: "#d97757" },
  { provider: "anthropic", model: "claude-sonnet-4-6",       label: "Claude Sonnet 4.6",     brandColor: "#d97757" },
  { provider: "anthropic", model: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5",    brandColor: "#d97757" },
  // DeepSeek
  { provider: "deepseek",  model: "deepseek-chat",           label: "DeepSeek V3",           brandColor: "#4d6bfe" },
  { provider: "deepseek",  model: "deepseek-reasoner",       label: "DeepSeek Reasoner",     brandColor: "#4d6bfe" },
  // Gemini
  { provider: "gemini",    model: "gemini-1.5-pro",          label: "Gemini 1.5 Pro",        brandColor: "#4285f4" },
  { provider: "gemini",    model: "gemini-2.0-flash",        label: "Gemini 2.0 Flash",      brandColor: "#4285f4" },
];

export function findModel(provider: ProviderId, model: string): ModelDescriptor | undefined {
  return CATALOG.find((m) => m.provider === provider && m.model === model);
}
