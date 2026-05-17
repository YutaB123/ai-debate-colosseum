export type EngineEvent =
  | { type: "turn_start"; roundNumber: number; debaterId: string }
  | { type: "chunk"; debaterId: string; text: string }
  | { type: "turn_end"; debaterId: string; fullText: string; tokenCount: number }
  | { type: "turn_error"; debaterId: string; reason: string; partialText: string }
  | { type: "huddle_start"; roundNumber: number }
  | { type: "whisper"; teamId: string; debaterId: string; text: string }
  | { type: "huddle_end"; roundNumber: number }
  | { type: "round_end"; roundNumber: number }
  | { type: "verdict"; winnerDebaterId: string | null; winnerTeamId: string | null; reasoning: string }
  | { type: "error"; message: string };
