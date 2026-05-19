export type ProviderId = "openai" | "anthropic" | "gemini" | "grok";

export interface ProviderMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface StreamCompletionRequest {
  model: string;
  messages: ProviderMessage[];
  maxTokens: number;
}

export type StreamChunk =
  | { type: "text"; text: string }
  | { type: "error"; message: string };

export interface StreamingProvider {
  id: ProviderId;
  streamCompletion(req: StreamCompletionRequest): AsyncIterable<StreamChunk>;
}

export type DebateStatus = "setup" | "running" | "paused" | "completed" | "failed";
export type RoundStatus = "pending" | "speaking" | "huddle" | "completed";

export interface Debater {
  id: string;
  debateId: string;
  provider: ProviderId;
  model: string;
  displayName: string;
  stance: string;
  teamId: string | null;
  speakOrder: number;
  voiceUri: string;
  disabled: boolean;
}

export interface Team {
  id: string;
  debateId: string;
  name: string;
  color: string;
}

export interface DebateConfig {
  id: string;
  topic: string;
  judgeModel: string;
  roundCount: number;
  maxTokens: number;
  teamsEnabled: boolean;
  debaters: Debater[];
  teams: Team[];
}
