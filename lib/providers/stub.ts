import type { ProviderId, StreamChunk, StreamCompletionRequest, StreamingProvider } from "../types";

export interface StubScript {
  chunks: string[];
  errorAfter?: number; // emit an error after N chunks
}

let scripts: Record<string, StubScript> = {};

export function setStubScript(model: string, script: StubScript) {
  scripts[model] = script;
}

export function clearStubScripts() {
  scripts = {};
}

export function createStubProvider(id: ProviderId): StreamingProvider {
  return {
    id,
    async *streamCompletion(req: StreamCompletionRequest): AsyncIterable<StreamChunk> {
      const script = scripts[req.model] ?? { chunks: [`(stub response for ${id}/${req.model})`] };
      for (let i = 0; i < script.chunks.length; i++) {
        if (script.errorAfter !== undefined && i >= script.errorAfter) {
          yield { type: "error", message: "stub error" };
          return;
        }
        yield { type: "text", text: script.chunks[i] };
      }
    },
  };
}
