import type { DebateConfig } from "../types";
import type { EngineEvent } from "./events";

export interface ControlSignals {
  paused: boolean;
  skipCurrent: boolean;
  endDebate: boolean;
  pendingInterjection: string | null;
}

export interface EngineState {
  debate: DebateConfig;
  signals: ControlSignals;
  observers: Set<(event: EngineEvent) => void>;
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

export function attachObserver(debateId: string, observer: (event: EngineEvent) => void) {
  engines.get(debateId)?.observers.add(observer);
}

export function detachObserver(debateId: string, observer: (event: EngineEvent) => void) {
  engines.get(debateId)?.observers.delete(observer);
}

export function broadcast(debateId: string, event: EngineEvent) {
  const e = engines.get(debateId);
  if (!e) return;
  e.observers.forEach((obs) => {
    try { obs(event); } catch { /* observer closed; ignore */ }
  });
}
