import type { DebateConfig } from "../types";

export interface ControlSignals {
  paused: boolean;
  skipCurrent: boolean;
  pendingInterjection: string | null;
}

export interface EngineState {
  debate: DebateConfig;
  signals: ControlSignals;
  emit: (event: import("./events").EngineEvent) => void;
}

const engines = new Map<string, EngineState>();

export function registerEngine(state: EngineState) {
  engines.set(state.debate.id, state);
}

export function getEngine(debateId: string): EngineState | undefined {
  return engines.get(debateId);
}

export function unregisterEngine(debateId: string) {
  engines.delete(debateId);
}
