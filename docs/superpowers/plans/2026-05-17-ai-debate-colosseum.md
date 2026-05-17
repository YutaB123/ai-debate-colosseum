# AI Debate Colosseum Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a locally-run Next.js web app where 2–6 AI models from different providers debate each other in real-time on a TV-news-studio stage with per-AI browser TTS, optional teams with hidden inter-round huddles, an AI judge with user override, and SQLite persistence.

**Architecture:** Single Next.js 14 (App Router) project. Three layers: provider adapters (`lib/providers/`) that normalize calls to OpenAI/Anthropic/DeepSeek/Gemini behind a common streaming interface; a debate engine (`lib/engine/`) that orchestrates rounds, huddles, and judgment as an async state machine; and thin HTTP/SSE routes (`app/api/`) that wire the engine to a React frontend (`app/setup`, `app/debate/[id]`, `app/history`). State persists in `better-sqlite3`. Browser-side `SpeechSynthesis` speaks streamed text with one voice per AI.

**Tech Stack:** Next.js 14 (App Router) · TypeScript · Tailwind CSS · React · `better-sqlite3` · `openai` SDK · `@anthropic-ai/sdk` · `@google/generative-ai` · SSE via `Response` + `ReadableStream` · Jest + ts-jest · React Testing Library · Playwright.

**Spec:** `docs/superpowers/specs/2026-05-17-ai-debate-design.md`

---

## Milestone 1 — Project scaffolding

### Task 1: Initialize Next.js project

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.mjs`, `tailwind.config.ts`, `postcss.config.mjs`, `app/layout.tsx`, `app/page.tsx`, `app/globals.css`, `.env.local.example`

- [ ] **Step 1: Run Next.js scaffolder**

The repository root already exists at `C:\claude\debate` with `.gitignore` and `docs/`. Initialize Next.js *in place* (do not create a subfolder):

```bash
npx --yes create-next-app@14 . \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --src-dir=false \
  --import-alias "@/*" \
  --use-npm
```

When prompted to overwrite `.gitignore`, choose **No** (we already have one). When prompted about Turbopack, choose **No** (default).

- [ ] **Step 2: Verify dev server starts**

```bash
npm run dev
```

Expected: server starts on `http://localhost:3000`, opening it shows the default Next.js landing page. Kill it with Ctrl+C.

- [ ] **Step 3: Replace the landing page with a stub**

Replace `app/page.tsx` with:

```tsx
import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-4 p-8">
      <h1 className="text-4xl font-bold">AI Debate Colosseum</h1>
      <p className="text-lg text-gray-600">Pit AI models against each other in structured debate.</p>
      <div className="flex gap-4 mt-4">
        <Link href="/setup" className="px-4 py-2 bg-blue-600 text-white rounded">New Debate</Link>
        <Link href="/history" className="px-4 py-2 border rounded">History</Link>
      </div>
    </main>
  );
}
```

- [ ] **Step 4: Add `.env.local.example`**

```
# Copy this file to .env.local and fill in keys. Never commit .env.local.
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
DEEPSEEK_API_KEY=
GOOGLE_API_KEY=
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Scaffold Next.js 14 + TypeScript + Tailwind project"
```

---

### Task 2: Install runtime + dev dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install runtime deps**

```bash
npm install better-sqlite3 openai @anthropic-ai/sdk @google/generative-ai uuid clsx
```

- [ ] **Step 2: Install dev deps**

```bash
npm install -D @types/better-sqlite3 @types/uuid jest ts-jest @types/jest @testing-library/react @testing-library/dom @testing-library/jest-dom jest-environment-jsdom @playwright/test
```

- [ ] **Step 3: Verify install**

```bash
npm ls better-sqlite3 openai @anthropic-ai/sdk @google/generative-ai
```

Expected: each package resolves to a concrete version with no errors.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "Install runtime and dev dependencies"
```

---

### Task 3: Configure Jest

**Files:**
- Create: `jest.config.ts`, `jest.setup.ts`, `__tests__/sanity.test.ts`

- [ ] **Step 1: Write the failing test**

Create `__tests__/sanity.test.ts`:

```ts
describe("sanity", () => {
  it("runs", () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 2: Create `jest.config.ts`**

```ts
import type { Config } from "jest";

const config: Config = {
  projects: [
    {
      displayName: "node",
      preset: "ts-jest",
      testEnvironment: "node",
      testMatch: [
        "<rootDir>/lib/**/*.test.ts",
        "<rootDir>/app/**/*.test.ts",
        "<rootDir>/__tests__/**/*.test.ts",
      ],
      testPathIgnorePatterns: ["/node_modules/", "/.next/", "/lib/client/"],
      moduleNameMapper: { "^@/(.*)$": "<rootDir>/$1" },
    },
    {
      displayName: "jsdom",
      preset: "ts-jest",
      testEnvironment: "jsdom",
      testMatch: [
        "<rootDir>/components/**/*.test.tsx",
        "<rootDir>/app/**/*.test.tsx",
        "<rootDir>/lib/client/**/*.test.ts",
      ],
      setupFilesAfterEach: ["<rootDir>/jest.setup.ts"],
      moduleNameMapper: { "^@/(.*)$": "<rootDir>/$1" },
    },
  ],
};

export default config;
```

Then create `jest.setup.ts`:

```ts
import "@testing-library/jest-dom";
```

> If `setupFilesAfterEach` is rejected as an unknown option by your Jest version, swap it for `setupFiles` — the import has the same effect (matchers are registered before each test file runs).

- [ ] **Step 3: Add the `test` script to package.json**

Open `package.json` and ensure the `scripts` block contains:

```json
"test": "jest",
"test:watch": "jest --watch"
```

- [ ] **Step 4: Run the sanity test**

```bash
npm test -- sanity
```

Expected: `1 passed, 0 failed`.

- [ ] **Step 5: Commit**

```bash
git add jest.config.ts jest.setup.ts __tests__/sanity.test.ts package.json
git commit -m "Configure Jest with node + jsdom projects"
```

---

### Task 4: Create source directory skeleton

**Files:**
- Create: `lib/providers/.gitkeep`, `lib/engine/.gitkeep`, `lib/db/.gitkeep`, `lib/types.ts`, `components/.gitkeep`, `data/.gitkeep`

- [ ] **Step 1: Create the directories**

```bash
mkdir -p lib/providers lib/engine lib/db components data
touch lib/providers/.gitkeep lib/engine/.gitkeep lib/db/.gitkeep components/.gitkeep data/.gitkeep
```

- [ ] **Step 2: Create `lib/types.ts`**

```ts
export type ProviderId = "openai" | "anthropic" | "deepseek" | "gemini";

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
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "Create source directory skeleton and core types"
```

---

## Milestone 2 — Provider adapters

### Task 5: Define stub provider and registry

**Files:**
- Create: `lib/providers/stub.ts`, `lib/providers/registry.ts`, `lib/providers/registry.test.ts`

The stub provider yields scripted chunks — engine tests use this to avoid real network calls.

- [ ] **Step 1: Write the failing test**

Create `lib/providers/registry.test.ts`:

```ts
import { getProvider } from "./registry";

describe("provider registry", () => {
  it("returns the stub provider when configured", () => {
    process.env.DEBATE_USE_STUB_PROVIDERS = "true";
    const p = getProvider("openai");
    expect(p.id).toBe("openai");
    delete process.env.DEBATE_USE_STUB_PROVIDERS;
  });

  it("throws for unknown providers", () => {
    expect(() => getProvider("nope" as any)).toThrow(/unknown provider/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- registry
```

Expected: FAIL with "Cannot find module './registry'".

- [ ] **Step 3: Create the stub provider**

`lib/providers/stub.ts`:

```ts
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
```

- [ ] **Step 4: Create the registry**

`lib/providers/registry.ts`:

```ts
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
```

- [ ] **Step 5: Run test to verify it passes**

```bash
npm test -- registry
```

Expected: `2 passed`.

- [ ] **Step 6: Commit**

```bash
git add lib/providers/stub.ts lib/providers/registry.ts lib/providers/registry.test.ts
git commit -m "Add stub provider and provider registry"
```

---

### Task 6: OpenAI provider adapter

**Files:**
- Create: `lib/providers/openai.ts`, `lib/providers/openai.test.ts`
- Modify: `lib/providers/registry.ts`

- [ ] **Step 1: Write the failing test**

`lib/providers/openai.test.ts`:

```ts
import { createOpenAIProvider } from "./openai";

// Mock the OpenAI SDK
jest.mock("openai", () => {
  return {
    default: class FakeOpenAI {
      chat = {
        completions: {
          create: jest.fn(async function* () {
            yield { choices: [{ delta: { content: "Hello " } }] };
            yield { choices: [{ delta: { content: "world" } }] };
          }),
        },
      };
      constructor(_opts: any) {}
    },
  };
});

describe("openai provider", () => {
  it("yields text chunks in order", async () => {
    const p = createOpenAIProvider({ apiKey: "test" });
    const out: string[] = [];
    for await (const ch of p.streamCompletion({
      model: "gpt-4o",
      messages: [{ role: "user", content: "hi" }],
      maxTokens: 50,
    })) {
      if (ch.type === "text") out.push(ch.text);
    }
    expect(out.join("")).toBe("Hello world");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- openai
```

Expected: FAIL with "Cannot find module './openai'".

- [ ] **Step 3: Write the implementation**

`lib/providers/openai.ts`:

```ts
import OpenAI from "openai";
import type { StreamChunk, StreamCompletionRequest, StreamingProvider } from "../types";

export function createOpenAIProvider(opts: { apiKey: string; baseURL?: string }): StreamingProvider {
  const client = new OpenAI({ apiKey: opts.apiKey, baseURL: opts.baseURL });

  return {
    id: "openai",
    async *streamCompletion(req: StreamCompletionRequest): AsyncIterable<StreamChunk> {
      try {
        const stream = await client.chat.completions.create({
          model: req.model,
          messages: req.messages.map((m) => ({ role: m.role, content: m.content })),
          max_tokens: req.maxTokens,
          stream: true,
        });
        for await (const event of stream as any) {
          const delta = event.choices?.[0]?.delta?.content;
          if (typeof delta === "string" && delta.length > 0) {
            yield { type: "text", text: delta };
          }
        }
      } catch (e: any) {
        yield { type: "error", message: e?.message ?? String(e) };
      }
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- openai
```

Expected: `1 passed`.

- [ ] **Step 5: Wire into the registry**

Replace `lib/providers/registry.ts`:

```ts
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
```

Note: DeepSeek uses an OpenAI-compatible API — same client, different base URL.

- [ ] **Step 6: Run registry tests**

```bash
npm test -- registry openai
```

Expected: all green.

- [ ] **Step 7: Commit**

```bash
git add lib/providers/openai.ts lib/providers/openai.test.ts lib/providers/registry.ts
git commit -m "Add OpenAI provider adapter (also drives DeepSeek)"
```

---

### Task 7: Anthropic provider adapter

**Files:**
- Create: `lib/providers/anthropic.ts`, `lib/providers/anthropic.test.ts`
- Modify: `lib/providers/registry.ts`

- [ ] **Step 1: Write the failing test**

`lib/providers/anthropic.test.ts`:

```ts
import { createAnthropicProvider } from "./anthropic";

jest.mock("@anthropic-ai/sdk", () => {
  return {
    default: class FakeAnthropic {
      messages = {
        stream: jest.fn(() => {
          async function* gen() {
            yield { type: "content_block_delta", delta: { type: "text_delta", text: "Hello " } };
            yield { type: "content_block_delta", delta: { type: "text_delta", text: "world" } };
          }
          return gen();
        }),
      };
      constructor(_opts: any) {}
    },
  };
});

describe("anthropic provider", () => {
  it("yields text chunks in order and splits system messages out", async () => {
    const p = createAnthropicProvider({ apiKey: "test" });
    const out: string[] = [];
    for await (const ch of p.streamCompletion({
      model: "claude-opus-4-7",
      messages: [
        { role: "system", content: "be concise" },
        { role: "user", content: "hi" },
      ],
      maxTokens: 50,
    })) {
      if (ch.type === "text") out.push(ch.text);
    }
    expect(out.join("")).toBe("Hello world");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- anthropic
```

Expected: FAIL with "Cannot find module './anthropic'".

- [ ] **Step 3: Write the implementation**

`lib/providers/anthropic.ts`:

```ts
import Anthropic from "@anthropic-ai/sdk";
import type { StreamChunk, StreamCompletionRequest, StreamingProvider } from "../types";

export function createAnthropicProvider(opts: { apiKey: string }): StreamingProvider {
  const client = new Anthropic({ apiKey: opts.apiKey });

  return {
    id: "anthropic",
    async *streamCompletion(req: StreamCompletionRequest): AsyncIterable<StreamChunk> {
      try {
        const systemMessages = req.messages.filter((m) => m.role === "system").map((m) => m.content);
        const nonSystem = req.messages
          .filter((m) => m.role !== "system")
          .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

        const stream = client.messages.stream({
          model: req.model,
          max_tokens: req.maxTokens,
          system: systemMessages.join("\n\n") || undefined,
          messages: nonSystem,
        });

        for await (const event of stream as any) {
          if (
            event.type === "content_block_delta" &&
            event.delta?.type === "text_delta" &&
            typeof event.delta.text === "string"
          ) {
            yield { type: "text", text: event.delta.text };
          }
        }
      } catch (e: any) {
        yield { type: "error", message: e?.message ?? String(e) };
      }
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- anthropic
```

Expected: `1 passed`.

- [ ] **Step 5: Wire into the registry**

In `lib/providers/registry.ts`, replace the `case "anthropic":` line in the switch with:

```ts
    case "anthropic":
      return createAnthropicProvider({ apiKey: requireEnv("ANTHROPIC_API_KEY") });
```

And add `import { createAnthropicProvider } from "./anthropic";` at the top.

- [ ] **Step 6: Run tests**

```bash
npm test -- providers
```

Expected: all green.

- [ ] **Step 7: Commit**

```bash
git add lib/providers/anthropic.ts lib/providers/anthropic.test.ts lib/providers/registry.ts
git commit -m "Add Anthropic provider adapter"
```

---

### Task 8: Gemini provider adapter

**Files:**
- Create: `lib/providers/gemini.ts`, `lib/providers/gemini.test.ts`
- Modify: `lib/providers/registry.ts`

- [ ] **Step 1: Write the failing test**

`lib/providers/gemini.test.ts`:

```ts
import { createGeminiProvider } from "./gemini";

jest.mock("@google/generative-ai", () => {
  return {
    GoogleGenerativeAI: class {
      constructor(_key: string) {}
      getGenerativeModel() {
        return {
          generateContentStream: async () => ({
            stream: (async function* () {
              yield { text: () => "Hello " };
              yield { text: () => "world" };
            })(),
          }),
        };
      }
    },
  };
});

describe("gemini provider", () => {
  it("yields text chunks in order", async () => {
    const p = createGeminiProvider({ apiKey: "test" });
    const out: string[] = [];
    for await (const ch of p.streamCompletion({
      model: "gemini-1.5-pro",
      messages: [{ role: "user", content: "hi" }],
      maxTokens: 50,
    })) {
      if (ch.type === "text") out.push(ch.text);
    }
    expect(out.join("")).toBe("Hello world");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- gemini
```

Expected: FAIL with "Cannot find module './gemini'".

- [ ] **Step 3: Write the implementation**

`lib/providers/gemini.ts`:

```ts
import { GoogleGenerativeAI } from "@google/generative-ai";
import type { StreamChunk, StreamCompletionRequest, StreamingProvider } from "../types";

export function createGeminiProvider(opts: { apiKey: string }): StreamingProvider {
  const client = new GoogleGenerativeAI(opts.apiKey);

  return {
    id: "gemini",
    async *streamCompletion(req: StreamCompletionRequest): AsyncIterable<StreamChunk> {
      try {
        const systemPart = req.messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
        const history = req.messages
          .filter((m) => m.role !== "system")
          .map((m) => ({
            role: m.role === "assistant" ? "model" : "user",
            parts: [{ text: m.content }],
          }));

        const model = client.getGenerativeModel({
          model: req.model,
          systemInstruction: systemPart || undefined,
          generationConfig: { maxOutputTokens: req.maxTokens },
        });

        const result = await model.generateContentStream({ contents: history });
        for await (const chunk of result.stream) {
          const text = chunk.text();
          if (text && text.length > 0) {
            yield { type: "text", text };
          }
        }
      } catch (e: any) {
        yield { type: "error", message: e?.message ?? String(e) };
      }
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- gemini
```

Expected: `1 passed`.

- [ ] **Step 5: Wire into the registry**

In `lib/providers/registry.ts`, replace the `case "gemini":` line in the switch with:

```ts
    case "gemini":
      return createGeminiProvider({ apiKey: requireEnv("GOOGLE_API_KEY") });
```

And add `import { createGeminiProvider } from "./gemini";` at the top. Remove the remaining `"real provider for ${id} not yet implemented"` throw — the switch now covers all four providers.

- [ ] **Step 6: Run all provider tests**

```bash
npm test -- providers
```

Expected: 4 test files, all green.

- [ ] **Step 7: Commit**

```bash
git add lib/providers/gemini.ts lib/providers/gemini.test.ts lib/providers/registry.ts
git commit -m "Add Gemini provider adapter and complete registry"
```

---

### Task 9: Available-models catalog

**Files:**
- Create: `lib/providers/catalog.ts`

A small lookup table the UI uses to populate provider→model dropdowns. Not all models a provider offers — just the ones we support and have voices/UI for.

- [ ] **Step 1: Create the catalog**

`lib/providers/catalog.ts`:

```ts
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
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/providers/catalog.ts
git commit -m "Add catalog of supported provider+model combos"
```

---

## Milestone 3 — Database layer

### Task 10: SQLite schema + connection

**Files:**
- Create: `lib/db/schema.sql`, `lib/db/connection.ts`, `lib/db/connection.test.ts`

- [ ] **Step 1: Write the failing test**

`lib/db/connection.test.ts`:

```ts
import { openDb } from "./connection";

describe("db connection", () => {
  it("creates all tables in a fresh in-memory db", () => {
    const db = openDb(":memory:");
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
      .all()
      .map((r: any) => r.name);
    expect(tables).toEqual(
      expect.arrayContaining([
        "debates", "debaters", "teams", "rounds",
        "speeches", "whispers", "interjections", "votes", "verdicts",
      ])
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- connection
```

Expected: FAIL with "Cannot find module './connection'".

- [ ] **Step 3: Create the schema**

`lib/db/schema.sql`:

```sql
CREATE TABLE IF NOT EXISTS debates (
  id              TEXT PRIMARY KEY,
  topic           TEXT NOT NULL,
  judge_model     TEXT NOT NULL,
  round_count     INTEGER NOT NULL,
  max_tokens      INTEGER NOT NULL,
  teams_enabled   INTEGER NOT NULL,
  status          TEXT NOT NULL,
  created_at      INTEGER NOT NULL,
  completed_at    INTEGER
);

CREATE TABLE IF NOT EXISTS teams (
  id         TEXT PRIMARY KEY,
  debate_id  TEXT NOT NULL REFERENCES debates(id),
  name       TEXT NOT NULL,
  color      TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS debaters (
  id           TEXT PRIMARY KEY,
  debate_id    TEXT NOT NULL REFERENCES debates(id),
  provider     TEXT NOT NULL,
  model        TEXT NOT NULL,
  display_name TEXT NOT NULL,
  stance       TEXT NOT NULL,
  team_id      TEXT REFERENCES teams(id),
  speak_order  INTEGER NOT NULL,
  voice_uri    TEXT NOT NULL,
  disabled     INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS rounds (
  id           TEXT PRIMARY KEY,
  debate_id    TEXT NOT NULL REFERENCES debates(id),
  round_number INTEGER NOT NULL,
  status       TEXT NOT NULL,
  UNIQUE(debate_id, round_number)
);

CREATE TABLE IF NOT EXISTS speeches (
  id          TEXT PRIMARY KEY,
  round_id    TEXT NOT NULL REFERENCES rounds(id),
  debater_id  TEXT NOT NULL REFERENCES debaters(id),
  text        TEXT NOT NULL,
  token_count INTEGER NOT NULL,
  started_at  INTEGER NOT NULL,
  ended_at    INTEGER,
  error       TEXT
);

CREATE TABLE IF NOT EXISTS whispers (
  id         TEXT PRIMARY KEY,
  round_id   TEXT NOT NULL REFERENCES rounds(id),
  debater_id TEXT NOT NULL REFERENCES debaters(id),
  team_id    TEXT NOT NULL REFERENCES teams(id),
  text       TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS interjections (
  id         TEXT PRIMARY KEY,
  round_id   TEXT NOT NULL REFERENCES rounds(id),
  text       TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS votes (
  id         TEXT PRIMARY KEY,
  round_id   TEXT NOT NULL REFERENCES rounds(id),
  debater_id TEXT NOT NULL REFERENCES debaters(id),
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS verdicts (
  id              TEXT PRIMARY KEY,
  debate_id       TEXT NOT NULL REFERENCES debates(id),
  winner_debater  TEXT REFERENCES debaters(id),
  winner_team     TEXT REFERENCES teams(id),
  reasoning       TEXT NOT NULL,
  user_override   TEXT,
  override_note   TEXT,
  created_at      INTEGER NOT NULL
);
```

- [ ] **Step 4: Write the connection module**

`lib/db/connection.ts`:

```ts
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

const SCHEMA_PATH = path.join(__dirname, "schema.sql");

export type DB = ReturnType<typeof Database>;

export function openDb(file: string = "./data/debate.db"): DB {
  if (file !== ":memory:") {
    const dir = path.dirname(file);
    fs.mkdirSync(dir, { recursive: true });
  }
  const db = new Database(file);
  db.pragma("foreign_keys = ON");
  const schema = fs.readFileSync(SCHEMA_PATH, "utf8");
  db.exec(schema);
  return db;
}

let singleton: DB | null = null;

export function getDb(): DB {
  if (!singleton) {
    singleton = openDb(process.env.DEBATE_DB_PATH ?? "./data/debate.db");
  }
  return singleton;
}
```

- [ ] **Step 5: Run test to verify it passes**

`connection.ts` reads `schema.sql` via `path.join(__dirname, "schema.sql")` and `fs.readFileSync`, so it resolves relative to the compiled module location regardless of the current working directory — no Jest transformer or `process.chdir` needed.

```bash
npm test -- connection
```

Expected: `1 passed`.

- [ ] **Step 6: Commit**

```bash
git add lib/db/schema.sql lib/db/connection.ts lib/db/connection.test.ts
git commit -m "Add SQLite schema and connection module"
```

---

### Task 11: Debate repository (create + read)

**Files:**
- Create: `lib/db/repo.ts`, `lib/db/repo.test.ts`

- [ ] **Step 1: Write the failing test**

`lib/db/repo.test.ts`:

```ts
import { openDb } from "./connection";
import { createDebate, getDebate } from "./repo";

describe("debate repo", () => {
  it("round-trips a debate with debaters and teams", () => {
    const db = openDb(":memory:");
    const id = createDebate(db, {
      topic: "Is fire wet?",
      judgeModel: "openai:gpt-4o",
      roundCount: 3,
      maxTokens: 150,
      teamsEnabled: true,
      teams: [
        { name: "Blue", color: "#4285f4" },
        { name: "Red",  color: "#d97757" },
      ],
      debaters: [
        { provider: "anthropic", model: "claude-opus-4-7", displayName: "Claude",
          stance: "Fire is wet", teamIndex: 0, speakOrder: 0, voiceUri: "v1" },
        { provider: "openai", model: "gpt-4o", displayName: "GPT-4o",
          stance: "Fire is not wet", teamIndex: 1, speakOrder: 1, voiceUri: "v2" },
      ],
    });
    const d = getDebate(db, id);
    expect(d).toBeTruthy();
    expect(d!.topic).toBe("Is fire wet?");
    expect(d!.teams.length).toBe(2);
    expect(d!.debaters.length).toBe(2);
    expect(d!.debaters[0].teamId).toBe(d!.teams[0].id);
    expect(d!.debaters[0].speakOrder).toBe(0);
  });

  it("returns null for unknown debate id", () => {
    const db = openDb(":memory:");
    expect(getDebate(db, "nope")).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- repo
```

Expected: FAIL with "Cannot find module './repo'".

- [ ] **Step 3: Write the repo module**

`lib/db/repo.ts`:

```ts
import type { DB } from "./connection";
import { randomUUID } from "node:crypto";
import type { DebateConfig, DebateStatus, ProviderId } from "../types";

export interface CreateDebateInput {
  topic: string;
  judgeModel: string;
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

export function createDebate(db: DB, input: CreateDebateInput): string {
  const id = randomUUID();
  const now = Date.now();

  const insertDebate = db.prepare(
    `INSERT INTO debates (id, topic, judge_model, round_count, max_tokens, teams_enabled, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const insertTeam = db.prepare(
    `INSERT INTO teams (id, debate_id, name, color) VALUES (?, ?, ?, ?)`
  );
  const insertDebater = db.prepare(
    `INSERT INTO debaters (id, debate_id, provider, model, display_name, stance,
                           team_id, speak_order, voice_uri, disabled)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`
  );

  const tx = db.transaction(() => {
    insertDebate.run(id, input.topic, input.judgeModel, input.roundCount, input.maxTokens,
                     input.teamsEnabled ? 1 : 0, "setup", now);
    const teamIds = input.teams.map((t) => {
      const tid = randomUUID();
      insertTeam.run(tid, id, t.name, t.color);
      return tid;
    });
    for (const d of input.debaters) {
      insertDebater.run(
        randomUUID(), id, d.provider, d.model, d.displayName, d.stance,
        d.teamIndex !== null ? teamIds[d.teamIndex] : null,
        d.speakOrder, d.voiceUri,
      );
    }
  });
  tx();
  return id;
}

export function getDebate(db: DB, id: string): DebateConfig | null {
  const row = db.prepare(`SELECT * FROM debates WHERE id = ?`).get(id) as any;
  if (!row) return null;
  const teams = db.prepare(`SELECT * FROM teams WHERE debate_id = ?`).all(id) as any[];
  const debaters = db.prepare(`SELECT * FROM debaters WHERE debate_id = ? ORDER BY speak_order`).all(id) as any[];
  return {
    id: row.id,
    topic: row.topic,
    judgeModel: row.judge_model,
    roundCount: row.round_count,
    maxTokens: row.max_tokens,
    teamsEnabled: !!row.teams_enabled,
    teams: teams.map((t) => ({ id: t.id, debateId: t.debate_id, name: t.name, color: t.color })),
    debaters: debaters.map((d) => ({
      id: d.id, debateId: d.debate_id, provider: d.provider as ProviderId,
      model: d.model, displayName: d.display_name, stance: d.stance,
      teamId: d.team_id, speakOrder: d.speak_order, voiceUri: d.voice_uri,
      disabled: !!d.disabled,
    })),
  };
}

export function setDebateStatus(db: DB, id: string, status: DebateStatus) {
  db.prepare(`UPDATE debates SET status = ?, completed_at = ? WHERE id = ?`)
    .run(status, status === "completed" ? Date.now() : null, id);
}

export function listDebates(db: DB): { id: string; topic: string; status: string; createdAt: number }[] {
  return db.prepare(`SELECT id, topic, status, created_at as createdAt FROM debates ORDER BY created_at DESC`).all() as any[];
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- repo
```

Expected: `2 passed`.

- [ ] **Step 5: Commit**

```bash
git add lib/db/repo.ts lib/db/repo.test.ts
git commit -m "Add debate repository: createDebate, getDebate, status, list"
```

---

### Task 12: Round / speech / whisper / vote / verdict repos

**Files:**
- Create: `lib/db/round-repo.ts`, `lib/db/round-repo.test.ts`

- [ ] **Step 1: Write the failing test**

`lib/db/round-repo.test.ts`:

```ts
import { openDb } from "./connection";
import { createDebate } from "./repo";
import {
  createRound, finalizeSpeech, beginSpeech,
  recordWhisper, recordVote, recordInterjection, recordVerdict,
  getFullTranscript,
} from "./round-repo";

function setup() {
  const db = openDb(":memory:");
  const dId = createDebate(db, {
    topic: "T", judgeModel: "openai:gpt-4o", roundCount: 2, maxTokens: 150, teamsEnabled: true,
    teams: [{ name: "A", color: "#fff" }, { name: "B", color: "#000" }],
    debaters: [
      { provider: "openai", model: "gpt-4o", displayName: "G", stance: "yes", teamIndex: 0, speakOrder: 0, voiceUri: "v" },
      { provider: "anthropic", model: "claude-opus-4-7", displayName: "C", stance: "no", teamIndex: 1, speakOrder: 1, voiceUri: "v" },
    ],
  });
  return { db, dId };
}

describe("round repo", () => {
  it("records a full round and reads back a transcript", () => {
    const { db, dId } = setup();
    const r1 = createRound(db, dId, 1);
    const debaterIds = db.prepare("SELECT id FROM debaters WHERE debate_id=? ORDER BY speak_order").all(dId).map((r: any) => r.id);

    const s1 = beginSpeech(db, r1, debaterIds[0]);
    finalizeSpeech(db, s1, "first speech", 10);
    const s2 = beginSpeech(db, r1, debaterIds[1]);
    finalizeSpeech(db, s2, "rebuttal", 8);

    const teamIds = db.prepare("SELECT id FROM teams WHERE debate_id=?").all(dId).map((r: any) => r.id);
    recordWhisper(db, r1, debaterIds[0], teamIds[0], "I'll go strong next round");
    recordVote(db, r1, debaterIds[0]);
    recordInterjection(db, r1, "Mod: stay on topic");

    const t = getFullTranscript(db, dId);
    expect(t.rounds.length).toBe(1);
    expect(t.rounds[0].speeches.map((s) => s.text)).toEqual(["first speech", "rebuttal"]);
    expect(t.rounds[0].whispers.length).toBe(1);
    expect(t.rounds[0].votes.length).toBe(1);
    expect(t.rounds[0].interjections.length).toBe(1);
  });

  it("stores a verdict", () => {
    const { db, dId } = setup();
    const debaterIds = db.prepare("SELECT id FROM debaters WHERE debate_id=? ORDER BY speak_order").all(dId).map((r: any) => r.id);
    recordVerdict(db, dId, { winnerDebaterId: debaterIds[0], winnerTeamId: null, reasoning: "stronger arg" });
    const v = db.prepare("SELECT * FROM verdicts WHERE debate_id=?").get(dId) as any;
    expect(v.winner_debater).toBe(debaterIds[0]);
    expect(v.reasoning).toBe("stronger arg");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- round-repo
```

Expected: FAIL.

- [ ] **Step 3: Implement the round repo**

`lib/db/round-repo.ts`:

```ts
import { randomUUID } from "node:crypto";
import type { DB } from "./connection";

export interface TranscriptRound {
  roundNumber: number;
  speeches: { debaterId: string; text: string; tokenCount: number; error: string | null }[];
  whispers: { debaterId: string; teamId: string; text: string }[];
  votes: { debaterId: string }[];
  interjections: { text: string }[];
}

export interface FullTranscript {
  rounds: TranscriptRound[];
  verdict: { winnerDebaterId: string | null; winnerTeamId: string | null; reasoning: string; userOverride: string | null } | null;
}

export function createRound(db: DB, debateId: string, roundNumber: number): string {
  const id = randomUUID();
  db.prepare(
    `INSERT INTO rounds (id, debate_id, round_number, status) VALUES (?, ?, ?, 'pending')`
  ).run(id, debateId, roundNumber);
  return id;
}

export function setRoundStatus(db: DB, roundId: string, status: "pending" | "speaking" | "huddle" | "completed") {
  db.prepare(`UPDATE rounds SET status = ? WHERE id = ?`).run(status, roundId);
}

export function beginSpeech(db: DB, roundId: string, debaterId: string): string {
  const id = randomUUID();
  db.prepare(
    `INSERT INTO speeches (id, round_id, debater_id, text, token_count, started_at, ended_at, error)
     VALUES (?, ?, ?, '', 0, ?, NULL, NULL)`
  ).run(id, roundId, debaterId, Date.now());
  return id;
}

export function finalizeSpeech(db: DB, speechId: string, text: string, tokenCount: number, error?: string) {
  db.prepare(
    `UPDATE speeches SET text = ?, token_count = ?, ended_at = ?, error = ? WHERE id = ?`
  ).run(text, tokenCount, Date.now(), error ?? null, speechId);
}

export function recordWhisper(db: DB, roundId: string, debaterId: string, teamId: string, text: string) {
  db.prepare(
    `INSERT INTO whispers (id, round_id, debater_id, team_id, text, created_at) VALUES (?, ?, ?, ?, ?, ?)`
  ).run(randomUUID(), roundId, debaterId, teamId, text, Date.now());
}

export function recordInterjection(db: DB, roundId: string, text: string) {
  db.prepare(
    `INSERT INTO interjections (id, round_id, text, created_at) VALUES (?, ?, ?, ?)`
  ).run(randomUUID(), roundId, text, Date.now());
}

export function recordVote(db: DB, roundId: string, debaterId: string) {
  // Replace any prior vote in this round.
  db.prepare(`DELETE FROM votes WHERE round_id = ?`).run(roundId);
  db.prepare(
    `INSERT INTO votes (id, round_id, debater_id, created_at) VALUES (?, ?, ?, ?)`
  ).run(randomUUID(), roundId, debaterId, Date.now());
}

export function recordVerdict(
  db: DB,
  debateId: string,
  v: { winnerDebaterId: string | null; winnerTeamId: string | null; reasoning: string }
) {
  db.prepare(
    `INSERT INTO verdicts (id, debate_id, winner_debater, winner_team, reasoning, user_override, override_note, created_at)
     VALUES (?, ?, ?, ?, ?, NULL, NULL, ?)`
  ).run(randomUUID(), debateId, v.winnerDebaterId, v.winnerTeamId, v.reasoning, Date.now());
}

export function setVerdictOverride(db: DB, debateId: string, override: string, note: string | null) {
  db.prepare(`UPDATE verdicts SET user_override = ?, override_note = ? WHERE debate_id = ?`).run(override, note, debateId);
}

export function getFullTranscript(db: DB, debateId: string): FullTranscript {
  const rounds = db.prepare(`SELECT id, round_number FROM rounds WHERE debate_id = ? ORDER BY round_number`).all(debateId) as any[];
  const out: TranscriptRound[] = rounds.map((r) => {
    const speeches = db.prepare(
      `SELECT debater_id as debaterId, text, token_count as tokenCount, error
       FROM speeches WHERE round_id = ? ORDER BY started_at`
    ).all(r.id) as any[];
    const whispers = db.prepare(
      `SELECT debater_id as debaterId, team_id as teamId, text FROM whispers WHERE round_id = ? ORDER BY created_at`
    ).all(r.id) as any[];
    const votes = db.prepare(`SELECT debater_id as debaterId FROM votes WHERE round_id = ?`).all(r.id) as any[];
    const interjections = db.prepare(`SELECT text FROM interjections WHERE round_id = ? ORDER BY created_at`).all(r.id) as any[];
    return { roundNumber: r.round_number, speeches, whispers, votes, interjections };
  });
  const v = db.prepare(`SELECT * FROM verdicts WHERE debate_id = ?`).get(debateId) as any;
  const verdict = v ? {
    winnerDebaterId: v.winner_debater,
    winnerTeamId: v.winner_team,
    reasoning: v.reasoning,
    userOverride: v.user_override,
  } : null;
  return { rounds: out, verdict };
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- round-repo
```

Expected: `2 passed`.

- [ ] **Step 5: Commit**

```bash
git add lib/db/round-repo.ts lib/db/round-repo.test.ts
git commit -m "Add round / speech / whisper / vote / verdict repo"
```

---

## Milestone 4 — Debate engine

### Task 13: Context builder

**Files:**
- Create: `lib/engine/context.ts`, `lib/engine/context.test.ts`

This is the single most security-sensitive function in the codebase: **whispers must never leak across teams**. The test is the contract.

- [ ] **Step 1: Write the failing test**

`lib/engine/context.test.ts`:

```ts
import { buildSpeechContext, buildHuddleContext, buildJudgeContext } from "./context";
import type { DebateConfig, Debater } from "../types";

function mkDebate(): DebateConfig {
  return {
    id: "d", topic: "Is fire wet?", judgeModel: "openai:gpt-4o",
    roundCount: 3, maxTokens: 150, teamsEnabled: true,
    teams: [
      { id: "t1", debateId: "d", name: "Blue", color: "#00f" },
      { id: "t2", debateId: "d", name: "Red",  color: "#f00" },
    ],
    debaters: [
      { id: "claude", debateId: "d", provider: "anthropic", model: "claude-opus-4-7",
        displayName: "Claude", stance: "wet", teamId: "t1", speakOrder: 0, voiceUri: "v", disabled: false },
      { id: "ds",     debateId: "d", provider: "deepseek",  model: "deepseek-chat",
        displayName: "DeepSeek", stance: "wet", teamId: "t1", speakOrder: 1, voiceUri: "v", disabled: false },
      { id: "gpt",    debateId: "d", provider: "openai",    model: "gpt-4o",
        displayName: "GPT", stance: "dry", teamId: "t2", speakOrder: 2, voiceUri: "v", disabled: false },
      { id: "gem",    debateId: "d", provider: "gemini",    model: "gemini-1.5-pro",
        displayName: "Gemini", stance: "dry", teamId: "t2", speakOrder: 3, voiceUri: "v", disabled: false },
    ],
  };
}

const transcript = [
  { roundNumber: 1, speeches: [
    { debaterId: "claude", text: "Wet because plasma.", tokenCount: 5, error: null },
    { debaterId: "ds",     text: "Wet because steam.",  tokenCount: 5, error: null },
    { debaterId: "gpt",    text: "Dry by definition.",  tokenCount: 5, error: null },
    { debaterId: "gem",    text: "Dry: lacks water.",   tokenCount: 5, error: null },
  ], whispers: [
    { debaterId: "claude", teamId: "t1", text: "BLUE_SECRET" },
    { debaterId: "gpt",    teamId: "t2", text: "RED_SECRET" },
  ], votes: [], interjections: [] },
];

describe("context builder", () => {
  it("includes own team's whispers but never the opposing team's", () => {
    const d = mkDebate();
    const claudeCtx = buildSpeechContext({ debate: d, speaker: d.debaters[0], roundNumber: 2, transcript });
    const ctxText = claudeCtx.map((m) => m.content).join("\n");
    expect(ctxText).toContain("BLUE_SECRET");
    expect(ctxText).not.toContain("RED_SECRET");

    const gptCtx = buildSpeechContext({ debate: d, speaker: d.debaters[2], roundNumber: 2, transcript });
    const gptText = gptCtx.map((m) => m.content).join("\n");
    expect(gptText).toContain("RED_SECRET");
    expect(gptText).not.toContain("BLUE_SECRET");
  });

  it("includes the public transcript for every speaker", () => {
    const d = mkDebate();
    for (const speaker of d.debaters) {
      const ctx = buildSpeechContext({ debate: d, speaker, roundNumber: 2, transcript });
      const txt = ctx.map((m) => m.content).join("\n");
      expect(txt).toContain("Wet because plasma.");
      expect(txt).toContain("Dry by definition.");
    }
  });

  it("includes interjections in the context", () => {
    const d = mkDebate();
    const tr2 = [...transcript, { roundNumber: 2, speeches: [], whispers: [],
      votes: [], interjections: [{ text: "Mod says: focus" }] }];
    const ctx = buildSpeechContext({ debate: d, speaker: d.debaters[0], roundNumber: 2, transcript: tr2 });
    expect(ctx.some((m) => m.content.includes("Mod says: focus"))).toBe(true);
  });

  it("builds a huddle context only with own-team whispers", () => {
    const d = mkDebate();
    const ctx = buildHuddleContext({ debate: d, speaker: d.debaters[0], roundNumber: 2, transcript });
    const txt = ctx.map((m) => m.content).join("\n");
    expect(txt).toContain("BLUE_SECRET");
    expect(txt).not.toContain("RED_SECRET");
  });

  it("judge context contains public speeches but never whispers", () => {
    const d = mkDebate();
    const ctx = buildJudgeContext({ debate: d, transcript });
    const txt = ctx.map((m) => m.content).join("\n");
    expect(txt).toContain("Wet because plasma.");
    expect(txt).not.toContain("BLUE_SECRET");
    expect(txt).not.toContain("RED_SECRET");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- context
```

Expected: FAIL with "Cannot find module './context'".

- [ ] **Step 3: Implement the context builder**

`lib/engine/context.ts`:

```ts
import type { DebateConfig, Debater, ProviderMessage } from "../types";
import type { TranscriptRound } from "../db/round-repo";

export interface BuildArgs {
  debate: DebateConfig;
  speaker: Debater;
  roundNumber: number;
  transcript: TranscriptRound[];
}

function lookupDebater(d: DebateConfig, id: string): Debater {
  const x = d.debaters.find((x) => x.id === id);
  if (!x) throw new Error(`debater not found: ${id}`);
  return x;
}

function teamName(d: DebateConfig, teamId: string | null): string {
  if (!teamId) return "";
  return d.teams.find((t) => t.id === teamId)?.name ?? "";
}

function renderTranscript(d: DebateConfig, transcript: TranscriptRound[]): string {
  if (transcript.length === 0) return "(no speeches yet)";
  const lines: string[] = [];
  for (const r of transcript) {
    for (const s of r.speeches) {
      const sp = lookupDebater(d, s.debaterId);
      const team = d.teamsEnabled ? ` (${teamName(d, sp.teamId)})` : "";
      const errSuffix = s.error ? ` [interrupted: ${s.error}]` : "";
      lines.push(`Round ${r.roundNumber}, ${sp.displayName}${team} — "${sp.stance}":\n  ${s.text}${errSuffix}`);
    }
  }
  return lines.join("\n\n");
}

function renderOwnTeamWhispers(d: DebateConfig, speaker: Debater, transcript: TranscriptRound[]): string {
  if (!d.teamsEnabled || !speaker.teamId) return "";
  const lines: string[] = [];
  for (const r of transcript) {
    for (const w of r.whispers) {
      if (w.teamId === speaker.teamId && w.debaterId !== speaker.id) {
        const writer = lookupDebater(d, w.debaterId);
        lines.push(`Round ${r.roundNumber} huddle — ${writer.displayName}: "${w.text}"`);
      }
    }
  }
  return lines.join("\n");
}

function renderInterjections(transcript: TranscriptRound[], roundNumber: number): string {
  const round = transcript.find((r) => r.roundNumber === roundNumber);
  if (!round) return "";
  return round.interjections.map((i) => i.text).join("\n");
}

function teammates(d: DebateConfig, speaker: Debater): string {
  if (!d.teamsEnabled || !speaker.teamId) return "";
  return d.debaters
    .filter((x) => x.teamId === speaker.teamId && x.id !== speaker.id)
    .map((x) => x.displayName)
    .join(", ");
}

export function buildSpeechContext(args: BuildArgs): ProviderMessage[] {
  const { debate, speaker, roundNumber, transcript } = args;
  const teamLine = debate.teamsEnabled && speaker.teamId
    ? `You are on team "${teamName(debate, speaker.teamId)}" with: ${teammates(debate, speaker) || "(no other teammates)"}.`
    : "";

  const systemPrompt = [
    `You are ${speaker.displayName}, debating in a structured debate.`,
    `Topic: "${debate.topic}".`,
    `Your assigned position: "${speaker.stance}". You must defend this position.`,
    teamLine,
    `This is round ${roundNumber} of ${debate.roundCount}.`,
    `Speak for at most ${debate.maxTokens} tokens. Be direct and substantive — no preamble, no signoff.`,
  ].filter(Boolean).join("\n");

  const messages: ProviderMessage[] = [{ role: "system", content: systemPrompt }];
  const sections: string[] = [];

  sections.push(`PUBLIC TRANSCRIPT (chronological):\n${renderTranscript(debate, transcript)}`);

  const ownTeam = renderOwnTeamWhispers(debate, speaker, transcript);
  if (ownTeam) sections.push(`TEAM NOTES (private, from your teammates):\n${ownTeam}`);

  const interj = renderInterjections(transcript, roundNumber);
  if (interj) sections.push(`MODERATOR INTERJECTION:\n${interj}`);

  sections.push("Your turn. Speak now.");
  messages.push({ role: "user", content: sections.join("\n\n") });
  return messages;
}

export function buildHuddleContext(args: BuildArgs): ProviderMessage[] {
  const { debate, speaker, roundNumber, transcript } = args;
  const teamLabel = teamName(debate, speaker.teamId);
  const systemPrompt = [
    `You are ${speaker.displayName} on team "${teamLabel}".`,
    `You are in a PRIVATE huddle. Anything you write here is visible only to your teammates: ${teammates(debate, speaker) || "(none)"}.`,
    `The opposing team and the judge will NEVER see this message.`,
    `Topic: "${debate.topic}". Your team position: "${speaker.stance}".`,
    `It is between round ${roundNumber} and ${roundNumber + 1} of ${debate.roundCount}.`,
    `Write ONE short tactical note to your teammates: what to emphasize, what argument to make next, what to avoid. Be specific. Maximum ${Math.floor(debate.maxTokens / 2)} tokens.`,
  ].join("\n");

  const sections: string[] = [];
  sections.push(`PUBLIC TRANSCRIPT (chronological):\n${renderTranscript(debate, transcript)}`);
  const ownTeam = renderOwnTeamWhispers(debate, speaker, transcript);
  if (ownTeam) sections.push(`PREVIOUS TEAM NOTES:\n${ownTeam}`);
  sections.push("Write your one-message huddle note now.");

  return [
    { role: "system", content: systemPrompt },
    { role: "user", content: sections.join("\n\n") },
  ];
}

export function buildJudgeContext(args: { debate: DebateConfig; transcript: TranscriptRound[] }): ProviderMessage[] {
  const { debate, transcript } = args;
  const debaterLines = debate.debaters.map((d) =>
    `- ${d.displayName} (${d.provider}/${d.model}${debate.teamsEnabled ? `, team ${teamName(debate, d.teamId)}` : ""}): "${d.stance}"`
  ).join("\n");

  const systemPrompt = [
    `You are an impartial judge for a structured debate.`,
    `Topic: "${debate.topic}".`,
    `Debaters and stances:\n${debaterLines}`,
    `Read the transcript carefully and pick the single strongest debater (or strongest team if teams were used).`,
    `Output JSON: {"winnerDebater": "<displayName or null>", "winnerTeam": "<team name or null>", "reasoning": "<2-4 sentences>"}.`,
    `Output ONLY the JSON, no markdown.`,
  ].join("\n");

  return [
    { role: "system", content: systemPrompt },
    { role: "user", content: `PUBLIC TRANSCRIPT:\n${renderTranscript(debate, transcript)}` },
  ];
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- context
```

Expected: `5 passed`.

- [ ] **Step 5: Commit**

```bash
git add lib/engine/context.ts lib/engine/context.test.ts
git commit -m "Add engine context builder with team-whisper isolation invariant"
```

---

### Task 14: Engine events + EngineState

**Files:**
- Create: `lib/engine/events.ts`, `lib/engine/state.ts`

- [ ] **Step 1: Define the event union**

`lib/engine/events.ts`:

```ts
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
```

- [ ] **Step 2: Define the in-memory engine-state map**

`lib/engine/state.ts`:

```ts
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
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add lib/engine/events.ts lib/engine/state.ts
git commit -m "Add engine event union and in-memory state registry"
```

---

### Task 15: Engine runRound (speaking phase)

**Files:**
- Create: `lib/engine/run-round.ts`, `lib/engine/run-round.test.ts`

- [ ] **Step 1: Write the failing test**

`lib/engine/run-round.test.ts`:

```ts
import { runRound } from "./run-round";
import type { EngineEvent } from "./events";
import type { ControlSignals } from "./state";
import type { DebateConfig } from "../types";
import { openDb } from "../db/connection";
import { createDebate, getDebate } from "../db/repo";
import { createRound, getFullTranscript } from "../db/round-repo";
import { setStubScript, clearStubScripts } from "../providers/stub";

function buildConfig() {
  process.env.DEBATE_USE_STUB_PROVIDERS = "true";
  const db = openDb(":memory:");
  const id = createDebate(db, {
    topic: "T", judgeModel: "openai:gpt-4o", roundCount: 2, maxTokens: 50, teamsEnabled: false,
    teams: [],
    debaters: [
      { provider: "openai", model: "gpt-4o", displayName: "G", stance: "yes", teamIndex: null, speakOrder: 0, voiceUri: "v" },
      { provider: "anthropic", model: "claude-opus-4-7", displayName: "C", stance: "no", teamIndex: null, speakOrder: 1, voiceUri: "v" },
    ],
  });
  const debate = getDebate(db, id)!;
  return { db, debate };
}

describe("runRound", () => {
  beforeEach(() => clearStubScripts());

  it("emits turn_start → chunks → turn_end for each debater in order", async () => {
    const { db, debate } = buildConfig();
    setStubScript("gpt-4o", { chunks: ["hello ", "world"] });
    setStubScript("claude-opus-4-7", { chunks: ["a ", "b"] });

    const roundId = createRound(db, debate.id, 1);
    const events: EngineEvent[] = [];
    const signals: ControlSignals = { paused: false, skipCurrent: false, pendingInterjection: null };
    await runRound({ db, debate, roundId, roundNumber: 1, signals, emit: (e) => events.push(e) });

    const order = events.map((e) => e.type);
    expect(order).toEqual([
      "turn_start", "chunk", "chunk", "turn_end",
      "turn_start", "chunk", "chunk", "turn_end",
      "round_end",
    ]);
    expect((events[1] as any).text).toBe("hello ");
    expect((events[3] as any).fullText).toBe("hello world");
  });

  it("emits turn_error and proceeds when a provider fails mid-stream", async () => {
    const { db, debate } = buildConfig();
    setStubScript("gpt-4o", { chunks: ["hello ", "world"], errorAfter: 1 });
    setStubScript("claude-opus-4-7", { chunks: ["a"] });
    const roundId = createRound(db, debate.id, 1);
    const events: EngineEvent[] = [];
    await runRound({
      db, debate, roundId, roundNumber: 1,
      signals: { paused: false, skipCurrent: false, pendingInterjection: null },
      emit: (e) => events.push(e),
    });
    const types = events.map((e) => e.type);
    expect(types).toEqual(["turn_start", "chunk", "turn_error", "turn_start", "chunk", "turn_end", "round_end"]);
  });

  it("honors skipCurrent flag (stops streaming current debater)", async () => {
    const { db, debate } = buildConfig();
    setStubScript("gpt-4o", { chunks: ["a", "b", "c", "d"] });
    setStubScript("claude-opus-4-7", { chunks: ["x"] });
    const roundId = createRound(db, debate.id, 1);
    const events: EngineEvent[] = [];
    const signals: ControlSignals = { paused: false, skipCurrent: false, pendingInterjection: null };

    // Flip skipCurrent after the first chunk.
    const emit = (e: EngineEvent) => {
      events.push(e);
      if (e.type === "chunk" && (e as any).debaterId !== undefined && events.filter((x) => x.type === "chunk").length === 1) {
        signals.skipCurrent = true;
      }
    };
    await runRound({ db, debate, roundId, roundNumber: 1, signals, emit });
    const types = events.map((e) => e.type);
    expect(types[0]).toBe("turn_start");
    expect(types[types.length - 1]).toBe("round_end");
    // The first speaker shouldn't have emitted all 4 chunks.
    const firstSpeakerChunks = events.filter(
      (e) => e.type === "chunk" && (e as any).debaterId === debate.debaters[0].id
    );
    expect(firstSpeakerChunks.length).toBeLessThan(4);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- run-round
```

Expected: FAIL with "Cannot find module './run-round'".

- [ ] **Step 3: Implement runRound**

`lib/engine/run-round.ts`:

```ts
import type { DB } from "../db/connection";
import type { DebateConfig } from "../types";
import type { EngineEvent } from "./events";
import type { ControlSignals } from "./state";
import { getProvider } from "../providers/registry";
import { buildSpeechContext } from "./context";
import { beginSpeech, finalizeSpeech, getFullTranscript, recordInterjection, setRoundStatus } from "../db/round-repo";

export interface RunRoundArgs {
  db: DB;
  debate: DebateConfig;
  roundId: string;
  roundNumber: number;
  signals: ControlSignals;
  emit: (e: EngineEvent) => void;
}

export async function runRound(args: RunRoundArgs): Promise<void> {
  const { db, debate, roundId, roundNumber, signals, emit } = args;
  setRoundStatus(db, roundId, "speaking");

  for (const debater of debate.debaters) {
    if (debater.disabled) continue;

    // Honor pending interjection by recording it before this debater speaks.
    if (signals.pendingInterjection) {
      recordInterjection(db, roundId, signals.pendingInterjection);
      signals.pendingInterjection = null;
    }

    // Wait while paused.
    while (signals.paused) {
      await new Promise((r) => setTimeout(r, 100));
    }

    signals.skipCurrent = false;
    emit({ type: "turn_start", roundNumber, debaterId: debater.id });

    const speechId = beginSpeech(db, roundId, debater.id);
    const transcript = getFullTranscript(db, debate.id).rounds;
    const messages = buildSpeechContext({ debate, speaker: debater, roundNumber, transcript });
    const provider = getProvider(debater.provider);

    let full = "";
    let tokenCount = 0;
    let error: string | null = null;

    try {
      for await (const chunk of provider.streamCompletion({
        model: debater.model,
        messages,
        maxTokens: debate.maxTokens,
      })) {
        if (signals.skipCurrent) break;
        if (chunk.type === "error") {
          error = chunk.message;
          break;
        }
        full += chunk.text;
        tokenCount += approxTokens(chunk.text);
        emit({ type: "chunk", debaterId: debater.id, text: chunk.text });
      }
    } catch (e: any) {
      error = e?.message ?? String(e);
    }

    finalizeSpeech(db, speechId, full, tokenCount, error ?? undefined);

    if (error) {
      emit({ type: "turn_error", debaterId: debater.id, reason: error, partialText: full });
    } else {
      emit({ type: "turn_end", debaterId: debater.id, fullText: full, tokenCount });
    }
  }

  emit({ type: "round_end", roundNumber });
  setRoundStatus(db, roundId, "completed");
}

function approxTokens(text: string): number {
  // Rough heuristic: ~4 chars per token.
  return Math.max(1, Math.round(text.length / 4));
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- run-round
```

Expected: `3 passed`.

- [ ] **Step 5: Commit**

```bash
git add lib/engine/run-round.ts lib/engine/run-round.test.ts
git commit -m "Add runRound: per-debater streaming with skip/error handling"
```

---

### Task 16: Engine runHuddle (between rounds)

**Files:**
- Create: `lib/engine/run-huddle.ts`, `lib/engine/run-huddle.test.ts`

- [ ] **Step 1: Write the failing test**

`lib/engine/run-huddle.test.ts`:

```ts
import { runHuddle } from "./run-huddle";
import type { EngineEvent } from "./events";
import { openDb } from "../db/connection";
import { createDebate, getDebate } from "../db/repo";
import { createRound, getFullTranscript } from "../db/round-repo";
import { setStubScript, clearStubScripts } from "../providers/stub";

function buildConfig() {
  process.env.DEBATE_USE_STUB_PROVIDERS = "true";
  const db = openDb(":memory:");
  const id = createDebate(db, {
    topic: "T", judgeModel: "openai:gpt-4o", roundCount: 2, maxTokens: 100, teamsEnabled: true,
    teams: [
      { name: "A", color: "#fff" },
      { name: "B", color: "#000" },
    ],
    debaters: [
      { provider: "openai", model: "gpt-4o", displayName: "G", stance: "yes", teamIndex: 0, speakOrder: 0, voiceUri: "v" },
      { provider: "anthropic", model: "claude-opus-4-7", displayName: "C", stance: "yes", teamIndex: 0, speakOrder: 1, voiceUri: "v" },
      { provider: "deepseek", model: "deepseek-chat", displayName: "D", stance: "no", teamIndex: 1, speakOrder: 2, voiceUri: "v" },
      { provider: "gemini", model: "gemini-1.5-pro", displayName: "M", stance: "no", teamIndex: 1, speakOrder: 3, voiceUri: "v" },
    ],
  });
  return { db, debate: getDebate(db, id)! };
}

describe("runHuddle", () => {
  beforeEach(() => clearStubScripts());

  it("emits one whisper per debater and writes to DB", async () => {
    const { db, debate } = buildConfig();
    setStubScript("gpt-4o",            { chunks: ["push X harder"] });
    setStubScript("claude-opus-4-7",   { chunks: ["I'll handle Y"] });
    setStubScript("deepseek-chat",     { chunks: ["counter with Z"] });
    setStubScript("gemini-1.5-pro",    { chunks: ["I'll close on W"] });

    const roundId = createRound(db, debate.id, 1);
    const events: EngineEvent[] = [];
    await runHuddle({ db, debate, roundId, roundNumber: 1, emit: (e) => events.push(e) });

    const types = events.map((e) => e.type);
    expect(types[0]).toBe("huddle_start");
    expect(types[types.length - 1]).toBe("huddle_end");
    expect(types.filter((t) => t === "whisper").length).toBe(4);

    const t = getFullTranscript(db, debate.id);
    expect(t.rounds[0].whispers.length).toBe(4);
  });

  it("is a no-op when teams are disabled", async () => {
    const { db } = buildConfig();
    // Build a teams-disabled debate.
    const id = createDebate(db, {
      topic: "T", judgeModel: "openai:gpt-4o", roundCount: 1, maxTokens: 100, teamsEnabled: false,
      teams: [],
      debaters: [
        { provider: "openai", model: "gpt-4o", displayName: "G", stance: "yes", teamIndex: null, speakOrder: 0, voiceUri: "v" },
      ],
    });
    const debate = getDebate(db, id)!;
    const roundId = createRound(db, debate.id, 1);
    const events: EngineEvent[] = [];
    await runHuddle({ db, debate, roundId, roundNumber: 1, emit: (e) => events.push(e) });
    expect(events).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- run-huddle
```

Expected: FAIL.

- [ ] **Step 3: Implement runHuddle**

`lib/engine/run-huddle.ts`:

```ts
import type { DB } from "../db/connection";
import type { DebateConfig } from "../types";
import type { EngineEvent } from "./events";
import { getProvider } from "../providers/registry";
import { buildHuddleContext } from "./context";
import { getFullTranscript, recordWhisper, setRoundStatus } from "../db/round-repo";

export interface RunHuddleArgs {
  db: DB;
  debate: DebateConfig;
  roundId: string;
  roundNumber: number;
  emit: (e: EngineEvent) => void;
}

export async function runHuddle(args: RunHuddleArgs): Promise<void> {
  const { db, debate, roundId, roundNumber, emit } = args;
  if (!debate.teamsEnabled) return;

  setRoundStatus(db, roundId, "huddle");
  emit({ type: "huddle_start", roundNumber });

  const transcript = getFullTranscript(db, debate.id).rounds;

  await Promise.all(
    debate.debaters
      .filter((d) => !d.disabled && d.teamId)
      .map(async (debater) => {
        const provider = getProvider(debater.provider);
        const messages = buildHuddleContext({ debate, speaker: debater, roundNumber, transcript });
        let text = "";
        for await (const chunk of provider.streamCompletion({
          model: debater.model,
          messages,
          maxTokens: Math.floor(debate.maxTokens / 2),
        })) {
          if (chunk.type === "text") text += chunk.text;
          if (chunk.type === "error") break;
        }
        if (text) {
          recordWhisper(db, roundId, debater.id, debater.teamId!, text);
          emit({ type: "whisper", teamId: debater.teamId!, debaterId: debater.id, text });
        }
      })
  );

  emit({ type: "huddle_end", roundNumber });
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- run-huddle
```

Expected: `2 passed`.

- [ ] **Step 5: Commit**

```bash
git add lib/engine/run-huddle.ts lib/engine/run-huddle.test.ts
git commit -m "Add runHuddle: parallel team-private whispers between rounds"
```

---

### Task 17: Engine runJudgment

**Files:**
- Create: `lib/engine/run-judgment.ts`, `lib/engine/run-judgment.test.ts`

- [ ] **Step 1: Write the failing test**

`lib/engine/run-judgment.test.ts`:

```ts
import { runJudgment } from "./run-judgment";
import type { EngineEvent } from "./events";
import { openDb } from "../db/connection";
import { createDebate, getDebate } from "../db/repo";
import { createRound, beginSpeech, finalizeSpeech, getFullTranscript } from "../db/round-repo";
import { setStubScript, clearStubScripts } from "../providers/stub";

function setupWithSpeeches() {
  process.env.DEBATE_USE_STUB_PROVIDERS = "true";
  const db = openDb(":memory:");
  const id = createDebate(db, {
    topic: "T", judgeModel: "openai:gpt-4o", roundCount: 1, maxTokens: 100, teamsEnabled: false,
    teams: [],
    debaters: [
      { provider: "openai", model: "gpt-4o", displayName: "G", stance: "yes", teamIndex: null, speakOrder: 0, voiceUri: "v" },
      { provider: "anthropic", model: "claude-opus-4-7", displayName: "C", stance: "no", teamIndex: null, speakOrder: 1, voiceUri: "v" },
    ],
  });
  const debate = getDebate(db, id)!;
  const r = createRound(db, id, 1);
  for (const d of debate.debaters) {
    const sid = beginSpeech(db, r, d.id);
    finalizeSpeech(db, sid, `${d.displayName} said something`, 5);
  }
  return { db, debate };
}

describe("runJudgment", () => {
  beforeEach(() => clearStubScripts());

  it("parses a winner from JSON output and emits verdict", async () => {
    const { db, debate } = setupWithSpeeches();
    setStubScript("gpt-4o", { chunks: [JSON.stringify({ winnerDebater: "G", winnerTeam: null, reasoning: "Clearer points." })] });
    const events: EngineEvent[] = [];
    await runJudgment({ db, debate, judgeProvider: "openai", judgeModel: "gpt-4o", emit: (e) => events.push(e) });
    const v = events.find((e) => e.type === "verdict") as any;
    expect(v).toBeTruthy();
    expect(v.winnerDebaterId).toBe(debate.debaters[0].id);
    expect(v.reasoning).toContain("Clearer points");
  });

  it("gracefully handles non-JSON output", async () => {
    const { db, debate } = setupWithSpeeches();
    setStubScript("gpt-4o", { chunks: ["I'm not JSON sorry"] });
    const events: EngineEvent[] = [];
    await runJudgment({ db, debate, judgeProvider: "openai", judgeModel: "gpt-4o", emit: (e) => events.push(e) });
    const v = events.find((e) => e.type === "verdict") as any;
    expect(v.winnerDebaterId).toBeNull();
    expect(v.reasoning).toContain("(unparseable");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- run-judgment
```

Expected: FAIL.

- [ ] **Step 3: Implement runJudgment**

`lib/engine/run-judgment.ts`:

```ts
import type { DB } from "../db/connection";
import type { DebateConfig, ProviderId } from "../types";
import type { EngineEvent } from "./events";
import { getProvider } from "../providers/registry";
import { buildJudgeContext } from "./context";
import { getFullTranscript, recordVerdict } from "../db/round-repo";

export interface RunJudgmentArgs {
  db: DB;
  debate: DebateConfig;
  judgeProvider: ProviderId;
  judgeModel: string;
  emit: (e: EngineEvent) => void;
}

export async function runJudgment(args: RunJudgmentArgs): Promise<void> {
  const { db, debate, judgeProvider, judgeModel, emit } = args;
  const transcript = getFullTranscript(db, debate.id).rounds;
  const messages = buildJudgeContext({ debate, transcript });
  const provider = getProvider(judgeProvider);

  let raw = "";
  for await (const chunk of provider.streamCompletion({ model: judgeModel, messages, maxTokens: 400 })) {
    if (chunk.type === "text") raw += chunk.text;
    if (chunk.type === "error") {
      const v = { winnerDebaterId: null, winnerTeamId: null, reasoning: `(Judge unavailable: ${chunk.message})` };
      recordVerdict(db, debate.id, v);
      emit({ type: "verdict", ...v });
      return;
    }
  }

  const parsed = parseVerdict(raw);
  const winnerDebaterId = parsed.winnerDebater
    ? debate.debaters.find((d) => d.displayName === parsed.winnerDebater)?.id ?? null
    : null;
  const winnerTeamId = parsed.winnerTeam
    ? debate.teams.find((t) => t.name === parsed.winnerTeam)?.id ?? null
    : null;

  const verdict = { winnerDebaterId, winnerTeamId, reasoning: parsed.reasoning };
  recordVerdict(db, debate.id, verdict);
  emit({ type: "verdict", ...verdict });
}

function parseVerdict(raw: string): { winnerDebater: string | null; winnerTeam: string | null; reasoning: string } {
  // Try to extract a JSON object from the raw text.
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return { winnerDebater: null, winnerTeam: null, reasoning: `(unparseable judge output) ${raw.slice(0, 200)}` };
  try {
    const obj = JSON.parse(match[0]);
    return {
      winnerDebater: typeof obj.winnerDebater === "string" ? obj.winnerDebater : null,
      winnerTeam:    typeof obj.winnerTeam === "string"    ? obj.winnerTeam    : null,
      reasoning:     typeof obj.reasoning === "string"     ? obj.reasoning     : "(no reasoning)",
    };
  } catch {
    return { winnerDebater: null, winnerTeam: null, reasoning: `(unparseable judge JSON) ${raw.slice(0, 200)}` };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- run-judgment
```

Expected: `2 passed`.

- [ ] **Step 5: Commit**

```bash
git add lib/engine/run-judgment.ts lib/engine/run-judgment.test.ts
git commit -m "Add runJudgment: AI judge verdict with JSON parsing fallback"
```

---

### Task 18: Engine entry point — runDebate

**Files:**
- Create: `lib/engine/run-debate.ts`, `lib/engine/run-debate.test.ts`

This is the top-level orchestrator. Glues runRound + runHuddle + runJudgment.

- [ ] **Step 1: Write the failing test**

`lib/engine/run-debate.test.ts`:

```ts
import { runDebate } from "./run-debate";
import type { EngineEvent } from "./events";
import { openDb } from "../db/connection";
import { createDebate, getDebate } from "../db/repo";
import { setStubScript, clearStubScripts } from "../providers/stub";

function setup(teamsEnabled: boolean, rounds: number) {
  process.env.DEBATE_USE_STUB_PROVIDERS = "true";
  const db = openDb(":memory:");
  const id = createDebate(db, {
    topic: "T", judgeModel: "openai:gpt-4o", roundCount: rounds, maxTokens: 50,
    teamsEnabled,
    teams: teamsEnabled ? [{ name: "A", color: "#fff" }, { name: "B", color: "#000" }] : [],
    debaters: [
      { provider: "openai", model: "gpt-4o", displayName: "G", stance: "yes",
        teamIndex: teamsEnabled ? 0 : null, speakOrder: 0, voiceUri: "v" },
      { provider: "anthropic", model: "claude-opus-4-7", displayName: "C", stance: "no",
        teamIndex: teamsEnabled ? 1 : null, speakOrder: 1, voiceUri: "v" },
    ],
  });
  return { db, debate: getDebate(db, id)! };
}

describe("runDebate", () => {
  beforeEach(() => clearStubScripts());

  it("runs N rounds without huddles when teams disabled, then judges", async () => {
    const { db, debate } = setup(false, 2);
    setStubScript("gpt-4o", { chunks: ["a"] });
    setStubScript("claude-opus-4-7", { chunks: ["b"] });
    const events: EngineEvent[] = [];
    await runDebate({
      db, debate,
      signals: { paused: false, skipCurrent: false, pendingInterjection: null },
      emit: (e) => events.push(e),
    });
    const roundEnds = events.filter((e) => e.type === "round_end").length;
    expect(roundEnds).toBe(2);
    expect(events.some((e) => e.type === "huddle_start")).toBe(false);
    // After round 2, the judge runs.
    expect(events[events.length - 1].type).toBe("verdict");
  });

  it("interleaves huddles between rounds when teams enabled", async () => {
    const { db, debate } = setup(true, 3);
    setStubScript("gpt-4o", { chunks: ["a"] });
    setStubScript("claude-opus-4-7", { chunks: ["b"] });
    const events: EngineEvent[] = [];
    await runDebate({
      db, debate,
      signals: { paused: false, skipCurrent: false, pendingInterjection: null },
      emit: (e) => events.push(e),
    });
    const huddleStarts = events.filter((e) => e.type === "huddle_start").length;
    expect(huddleStarts).toBe(2); // huddles between R1→R2 and R2→R3, not after R3
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- run-debate
```

Expected: FAIL.

- [ ] **Step 3: Implement runDebate**

`lib/engine/run-debate.ts`:

```ts
import type { DB } from "../db/connection";
import type { DebateConfig, ProviderId } from "../types";
import type { EngineEvent } from "./events";
import type { ControlSignals } from "./state";
import { runRound } from "./run-round";
import { runHuddle } from "./run-huddle";
import { runJudgment } from "./run-judgment";
import { createRound } from "../db/round-repo";
import { setDebateStatus } from "./../db/repo";

export interface RunDebateArgs {
  db: DB;
  debate: DebateConfig;
  signals: ControlSignals;
  emit: (e: EngineEvent) => void;
}

export async function runDebate(args: RunDebateArgs): Promise<void> {
  const { db, debate, signals, emit } = args;
  setDebateStatus(db, debate.id, "running");

  try {
    for (let n = 1; n <= debate.roundCount; n++) {
      const roundId = createRound(db, debate.id, n);
      await runRound({ db, debate, roundId, roundNumber: n, signals, emit });

      // Run huddle after every round except the last.
      if (n < debate.roundCount) {
        await runHuddle({ db, debate, roundId, roundNumber: n, emit });
      }
    }

    const [jProvider, jModel] = parseJudgeModel(debate.judgeModel);
    await runJudgment({ db, debate, judgeProvider: jProvider, judgeModel: jModel, emit });
    setDebateStatus(db, debate.id, "completed");
  } catch (e: any) {
    emit({ type: "error", message: e?.message ?? String(e) });
    setDebateStatus(db, debate.id, "failed");
  }
}

function parseJudgeModel(s: string): [ProviderId, string] {
  const [p, ...rest] = s.split(":");
  if (!p || rest.length === 0) throw new Error(`bad judgeModel format: ${s}`);
  return [p as ProviderId, rest.join(":")];
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- run-debate
```

Expected: `2 passed`.

- [ ] **Step 5: Commit**

```bash
git add lib/engine/run-debate.ts lib/engine/run-debate.test.ts
git commit -m "Add runDebate orchestrator: rounds + huddles + judgment"
```

---

## Milestone 5 — HTTP / SSE routes

### Task 19: API route — POST /api/debates

**Files:**
- Create: `app/api/debates/route.ts`, `app/api/debates/route.test.ts`
- Create: `lib/api/validate.ts`

- [ ] **Step 1: Define request validation**

`lib/api/validate.ts`:

```ts
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
```

- [ ] **Step 2: Write the failing test**

`app/api/debates/route.test.ts`:

```ts
/**
 * @jest-environment node
 */
import { POST } from "./route";

describe("POST /api/debates", () => {
  beforeEach(() => {
    process.env.OPENAI_API_KEY = "k";
    process.env.ANTHROPIC_API_KEY = "k";
    process.env.DEBATE_DB_PATH = ":memory:";
  });

  it("400s on missing topic", async () => {
    const res = await POST(new Request("http://x", { method: "POST", body: JSON.stringify({}) }));
    expect(res.status).toBe(400);
  });

  it("201s with an id on a valid request", async () => {
    const body = {
      topic: "T", judgeModel: "openai:gpt-4o",
      roundCount: 2, maxTokens: 100, teamsEnabled: false, teams: [],
      debaters: [
        { provider: "openai", model: "gpt-4o", displayName: "G", stance: "y", teamIndex: null, speakOrder: 0, voiceUri: "v" },
        { provider: "anthropic", model: "claude-opus-4-7", displayName: "C", stance: "n", teamIndex: null, speakOrder: 1, voiceUri: "v" },
      ],
    };
    const res = await POST(new Request("http://x", { method: "POST", body: JSON.stringify(body) }));
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(typeof data.id).toBe("string");
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

```bash
npm test -- route.test
```

Expected: FAIL with "Cannot find module './route'".

- [ ] **Step 4: Implement the route**

`app/api/debates/route.ts`:

```ts
import { NextResponse } from "next/server";
import { getDb } from "../../../lib/db/connection";
import { createDebate } from "../../../lib/db/repo";
import { validateDebateRequest } from "../../../lib/api/validate";

export async function POST(req: Request): Promise<Response> {
  let json: any;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  const v = validateDebateRequest(json);
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });

  const id = createDebate(getDb(), v.body);
  return NextResponse.json({ id }, { status: 201 });
}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
npm test -- route.test
```

Expected: `2 passed`.

- [ ] **Step 6: Commit**

```bash
git add app/api/debates/route.ts app/api/debates/route.test.ts lib/api/validate.ts
git commit -m "Add POST /api/debates with validation and API-key preflight"
```

---

### Task 20: API route — GET /api/debates/[id]/stream (SSE)

**Files:**
- Create: `app/api/debates/[id]/stream/route.ts`, `app/api/debates/[id]/stream/route.test.ts`
- Create: `lib/api/sse.ts`

- [ ] **Step 1: Create the SSE helper**

`lib/api/sse.ts`:

```ts
export function sseFormat(event: object): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

export function createSseStream(start: (push: (event: object) => void, close: () => void) => Promise<void> | void): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const push = (e: object) => controller.enqueue(encoder.encode(sseFormat(e)));
      const close = () => controller.close();
      try {
        await start(push, close);
      } catch (e: any) {
        push({ type: "error", message: e?.message ?? String(e) });
        controller.close();
      }
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
```

- [ ] **Step 2: Write the failing test**

`app/api/debates/[id]/stream/route.test.ts`:

```ts
/**
 * @jest-environment node
 */
import { GET } from "./route";
import { getDb } from "../../../../../lib/db/connection";
import { createDebate } from "../../../../../lib/db/repo";
import { setStubScript, clearStubScripts } from "../../../../../lib/providers/stub";

async function readAllSseEvents(res: Response): Promise<any[]> {
  const reader = (res.body as ReadableStream).getReader();
  const dec = new TextDecoder();
  let buf = "";
  const events: any[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value);
    let idx;
    while ((idx = buf.indexOf("\n\n")) !== -1) {
      const chunk = buf.slice(0, idx);
      buf = buf.slice(idx + 2);
      const line = chunk.split("\n").find((l) => l.startsWith("data: "));
      if (line) events.push(JSON.parse(line.slice(6)));
    }
  }
  return events;
}

describe("GET /api/debates/[id]/stream", () => {
  beforeEach(() => {
    process.env.DEBATE_USE_STUB_PROVIDERS = "true";
    process.env.DEBATE_DB_PATH = ":memory:";
    clearStubScripts();
  });

  it("streams a full debate's events ending with verdict", async () => {
    setStubScript("gpt-4o", { chunks: ["a"] });
    setStubScript("claude-opus-4-7", { chunks: ["b"] });
    const id = createDebate(getDb(), {
      topic: "T", judgeModel: "openai:gpt-4o", roundCount: 1, maxTokens: 50,
      teamsEnabled: false, teams: [],
      debaters: [
        { provider: "openai", model: "gpt-4o", displayName: "G", stance: "y", teamIndex: null, speakOrder: 0, voiceUri: "v" },
        { provider: "anthropic", model: "claude-opus-4-7", displayName: "C", stance: "n", teamIndex: null, speakOrder: 1, voiceUri: "v" },
      ],
    });

    const res = await GET(new Request(`http://x/api/debates/${id}/stream`), { params: { id } });
    const events = await readAllSseEvents(res);
    expect(events[0].type).toBe("turn_start");
    expect(events[events.length - 1].type).toBe("verdict");
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

```bash
npm test -- "stream/route"
```

Expected: FAIL.

- [ ] **Step 4: Implement the route**

`app/api/debates/[id]/stream/route.ts`:

```ts
import { getDb } from "../../../../../lib/db/connection";
import { getDebate } from "../../../../../lib/db/repo";
import { runDebate } from "../../../../../lib/engine/run-debate";
import { registerEngine, unregisterEngine } from "../../../../../lib/engine/state";
import { createSseStream } from "../../../../../lib/api/sse";

export async function GET(_req: Request, ctx: { params: { id: string } }): Promise<Response> {
  const id = ctx.params.id;
  const db = getDb();
  const debate = getDebate(db, id);
  if (!debate) return new Response("not found", { status: 404 });

  return createSseStream(async (push, close) => {
    const signals = { paused: false, skipCurrent: false, pendingInterjection: null as string | null };
    registerEngine({ debate, signals, emit: (e) => push(e) });
    try {
      await runDebate({ db, debate, signals, emit: (e) => push(e) });
    } finally {
      unregisterEngine(id);
      close();
    }
  });
}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
npm test -- "stream/route"
```

Expected: `1 passed`.

- [ ] **Step 6: Commit**

```bash
git add app/api/debates/[id]/stream/route.ts app/api/debates/[id]/stream/route.test.ts lib/api/sse.ts
git commit -m "Add SSE stream route that drives the debate engine"
```

---

### Task 21: API route — POST /api/debates/[id]/control

**Files:**
- Create: `app/api/debates/[id]/control/route.ts`, `app/api/debates/[id]/control/route.test.ts`

- [ ] **Step 1: Write the failing test**

`app/api/debates/[id]/control/route.test.ts`:

```ts
/**
 * @jest-environment node
 */
import { POST } from "./route";
import { registerEngine, unregisterEngine } from "../../../../../lib/engine/state";

const debate: any = { id: "d1", debaters: [{ id: "x" }] };

beforeEach(() => unregisterEngine("d1"));

describe("POST /api/debates/[id]/control", () => {
  it("404s if no engine is running", async () => {
    const res = await POST(new Request("http://x", { method: "POST", body: JSON.stringify({ action: "pause" }) }), { params: { id: "d1" } });
    expect(res.status).toBe(404);
  });

  it("sets paused = true on pause", async () => {
    const signals: any = { paused: false, skipCurrent: false, pendingInterjection: null };
    registerEngine({ debate, signals, emit: () => {} });
    await POST(new Request("http://x", { method: "POST", body: JSON.stringify({ action: "pause" }) }), { params: { id: "d1" } });
    expect(signals.paused).toBe(true);
  });

  it("stores a pending interjection", async () => {
    const signals: any = { paused: false, skipCurrent: false, pendingInterjection: null };
    registerEngine({ debate, signals, emit: () => {} });
    await POST(new Request("http://x", { method: "POST", body: JSON.stringify({ action: "interject", text: "focus please" }) }), { params: { id: "d1" } });
    expect(signals.pendingInterjection).toBe("focus please");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- "control/route"
```

Expected: FAIL.

- [ ] **Step 3: Implement the route**

`app/api/debates/[id]/control/route.ts`:

```ts
import { NextResponse } from "next/server";
import { getEngine } from "../../../../../lib/engine/state";
import { getDb } from "../../../../../lib/db/connection";
import { recordVote, recordInterjection } from "../../../../../lib/db/round-repo";

export async function POST(req: Request, ctx: { params: { id: string } }): Promise<Response> {
  const engine = getEngine(ctx.params.id);
  if (!engine) return NextResponse.json({ error: "no running engine" }, { status: 404 });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  switch (body.action) {
    case "pause":   engine.signals.paused = true;  return NextResponse.json({ ok: true });
    case "resume":  engine.signals.paused = false; return NextResponse.json({ ok: true });
    case "skip":    engine.signals.skipCurrent = true; return NextResponse.json({ ok: true });
    case "interject":
      if (typeof body.text !== "string" || body.text.length === 0)
        return NextResponse.json({ error: "text required" }, { status: 400 });
      engine.signals.pendingInterjection = body.text;
      return NextResponse.json({ ok: true });
    case "vote":
      if (typeof body.roundId !== "string" || typeof body.debaterId !== "string")
        return NextResponse.json({ error: "roundId and debaterId required" }, { status: 400 });
      recordVote(getDb(), body.roundId, body.debaterId);
      return NextResponse.json({ ok: true });
    default:
      return NextResponse.json({ error: "unknown action" }, { status: 400 });
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- "control/route"
```

Expected: `3 passed`.

- [ ] **Step 5: Commit**

```bash
git add app/api/debates/[id]/control/route.ts app/api/debates/[id]/control/route.test.ts
git commit -m "Add control route for pause/resume/skip/interject/vote"
```

---

### Task 22: API route — GET /api/debates/[id], PATCH /api/debates/[id]/verdict, GET /api/debates

**Files:**
- Create: `app/api/debates/[id]/route.ts`, `app/api/debates/[id]/route.test.ts`
- Create: `app/api/debates/[id]/verdict/route.ts`
- Modify: `app/api/debates/route.ts` to add GET

- [ ] **Step 1: Write the failing test**

`app/api/debates/[id]/route.test.ts`:

```ts
/**
 * @jest-environment node
 */
import { GET } from "./route";
import { getDb } from "../../../../lib/db/connection";
import { createDebate } from "../../../../lib/db/repo";

beforeEach(() => { process.env.DEBATE_DB_PATH = ":memory:"; });

describe("GET /api/debates/[id]", () => {
  it("returns the debate config and an empty transcript when nothing has run", async () => {
    const id = createDebate(getDb(), {
      topic: "T", judgeModel: "openai:gpt-4o", roundCount: 1, maxTokens: 100, teamsEnabled: false, teams: [],
      debaters: [{ provider: "openai", model: "gpt-4o", displayName: "G", stance: "y", teamIndex: null, speakOrder: 0, voiceUri: "v" }],
    });
    const res = await GET(new Request("http://x"), { params: { id } });
    expect(res.status).toBe(200);
    const j = await res.json();
    expect(j.debate.topic).toBe("T");
    expect(j.transcript.rounds).toEqual([]);
  });

  it("404s on unknown id", async () => {
    const res = await GET(new Request("http://x"), { params: { id: "missing" } });
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- "debates/\[id\]/route"
```

Expected: FAIL.

- [ ] **Step 3: Implement GET /api/debates/[id]**

`app/api/debates/[id]/route.ts`:

```ts
import { NextResponse } from "next/server";
import { getDb } from "../../../../lib/db/connection";
import { getDebate } from "../../../../lib/db/repo";
import { getFullTranscript } from "../../../../lib/db/round-repo";

export async function GET(_req: Request, ctx: { params: { id: string } }): Promise<Response> {
  const db = getDb();
  const debate = getDebate(db, ctx.params.id);
  if (!debate) return NextResponse.json({ error: "not found" }, { status: 404 });
  const transcript = getFullTranscript(db, ctx.params.id);
  return NextResponse.json({ debate, transcript });
}
```

- [ ] **Step 4: Implement PATCH verdict**

`app/api/debates/[id]/verdict/route.ts`:

```ts
import { NextResponse } from "next/server";
import { getDb } from "../../../../../lib/db/connection";
import { setVerdictOverride } from "../../../../../lib/db/round-repo";

export async function PATCH(req: Request, ctx: { params: { id: string } }): Promise<Response> {
  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "invalid JSON" }, { status: 400 }); }
  if (typeof body.override !== "string") return NextResponse.json({ error: "override required" }, { status: 400 });
  setVerdictOverride(getDb(), ctx.params.id, body.override, typeof body.note === "string" ? body.note : null);
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 5: Add GET to /api/debates (list)**

Edit `app/api/debates/route.ts` and add at the bottom:

```ts
import { listDebates } from "../../../lib/db/repo";

export async function GET(): Promise<Response> {
  return NextResponse.json({ debates: listDebates(getDb()) });
}
```

(Also: add `import { getDb }` if not already imported.)

- [ ] **Step 6: Run all API tests**

```bash
npm test -- "api"
```

Expected: all green.

- [ ] **Step 7: Commit**

```bash
git add app/api/debates/[id]/route.ts app/api/debates/[id]/route.test.ts app/api/debates/[id]/verdict/route.ts app/api/debates/route.ts
git commit -m "Add GET single debate, PATCH verdict override, GET debate list"
```

---

## Milestone 6 — Setup UI

### Task 23: Shared client API helpers

**Files:**
- Create: `lib/client/api.ts`

- [ ] **Step 1: Create the client API module**

`lib/client/api.ts`:

```ts
import type { DebateConfig, ProviderId } from "../types";

export interface CreateDebateBody {
  topic: string;
  judgeModel: string;
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

export async function createDebateApi(body: CreateDebateBody): Promise<{ id: string }> {
  const res = await fetch("/api/debates", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error(j.error ?? `HTTP ${res.status}`);
  }
  return res.json();
}

export async function getDebateApi(id: string): Promise<{ debate: DebateConfig; transcript: any }> {
  const res = await fetch(`/api/debates/${id}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function listDebatesApi(): Promise<{ debates: { id: string; topic: string; status: string; createdAt: number }[] }> {
  const res = await fetch("/api/debates");
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function postControl(id: string, body: any): Promise<void> {
  const res = await fetch(`/api/debates/${id}/control`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}

export async function setVerdictOverrideApi(id: string, override: string, note?: string): Promise<void> {
  const res = await fetch(`/api/debates/${id}/verdict`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ override, note }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/client/api.ts
git commit -m "Add client API wrapper for fetch calls"
```

---

### Task 24: Voice picker hook

**Files:**
- Create: `lib/client/use-voices.ts`, `components/voice-picker.tsx`

- [ ] **Step 1: Create the hook**

`lib/client/use-voices.ts`:

```ts
"use client";
import { useEffect, useState } from "react";

export function useVoices(): SpeechSynthesisVoice[] {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const load = () => setVoices(window.speechSynthesis.getVoices());
    load();
    window.speechSynthesis.addEventListener("voiceschanged", load);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", load);
  }, []);
  return voices;
}
```

- [ ] **Step 2: Create the picker component**

`components/voice-picker.tsx`:

```tsx
"use client";
import { useVoices } from "../lib/client/use-voices";

export function VoicePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const voices = useVoices();
  if (voices.length === 0) {
    return <span className="text-xs text-gray-500">(no voices available)</span>;
  }
  return (
    <select
      className="border rounded px-2 py-1 text-sm"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">— pick a voice —</option>
      {voices.map((v) => (
        <option key={v.voiceURI} value={v.voiceURI}>{v.name} ({v.lang})</option>
      ))}
    </select>
  );
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add lib/client/use-voices.ts components/voice-picker.tsx
git commit -m "Add voice picker hook and component"
```

---

### Task 25: Setup form skeleton + topic/rounds/maxTokens fields

**Files:**
- Create: `app/setup/page.tsx`
- Create: `components/setup-form.tsx`

- [ ] **Step 1: Create the page wrapper**

`app/setup/page.tsx`:

```tsx
import { SetupForm } from "../../components/setup-form";

export default function SetupPage() {
  return (
    <main className="min-h-screen p-8 max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Configure Debate</h1>
      <SetupForm />
    </main>
  );
}
```

- [ ] **Step 2: Create the SetupForm component (minimal initial version)**

`components/setup-form.tsx`:

```tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { CATALOG } from "../lib/providers/catalog";
import { VoicePicker } from "./voice-picker";
import { createDebateApi } from "../lib/client/api";
import type { ProviderId } from "../lib/types";

interface DebaterRow {
  provider: ProviderId;
  model: string;
  displayName: string;
  stance: string;
  teamIndex: number | null;
  voiceUri: string;
}

const blankDebater = (i: number): DebaterRow => ({
  provider: "openai", model: "gpt-4o", displayName: "Debater " + (i + 1),
  stance: "", teamIndex: null, voiceUri: "",
});

export function SetupForm() {
  const router = useRouter();
  const [topic, setTopic] = useState("");
  const [rounds, setRounds] = useState(10);
  const [maxTokens, setMaxTokens] = useState(150);
  const [teamsEnabled, setTeamsEnabled] = useState(false);
  const [judgeModel, setJudgeModel] = useState("openai:gpt-4o");
  const [debaters, setDebaters] = useState<DebaterRow[]>([blankDebater(0), blankDebater(1), blankDebater(2), blankDebater(3)]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const teams = teamsEnabled
    ? [{ name: "Team Blue", color: "#4285f4" }, { name: "Team Red", color: "#d97757" }]
    : [];

  const updateDebater = (i: number, patch: Partial<DebaterRow>) => {
    setDebaters((arr) => arr.map((d, idx) => (idx === i ? { ...d, ...patch } : d)));
  };

  const addDebater = () => setDebaters((arr) => arr.length < 6 ? [...arr, blankDebater(arr.length)] : arr);
  const removeDebater = (i: number) => setDebaters((arr) => arr.length > 2 ? arr.filter((_, idx) => idx !== i) : arr);

  const canSubmit = topic.length > 0
    && debaters.every((d) => d.stance.length > 0 && d.voiceUri.length > 0)
    && !debaters.some((d) => `${d.provider}:${d.model}` === judgeModel);

  const submit = async () => {
    setSubmitting(true); setError(null);
    try {
      const body = {
        topic, judgeModel, roundCount: rounds, maxTokens, teamsEnabled, teams,
        debaters: debaters.map((d, i) => ({
          provider: d.provider, model: d.model, displayName: d.displayName,
          stance: d.stance, teamIndex: teamsEnabled ? (d.teamIndex ?? 0) : null,
          speakOrder: i, voiceUri: d.voiceUri,
        })),
      };
      const { id } = await createDebateApi(body);
      router.push(`/debate/${id}`);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <label className="block">
        <span className="font-semibold">Topic</span>
        <input className="mt-1 w-full border rounded px-3 py-2"
               placeholder="Should AI systems be required to disclose when they are uncertain?"
               value={topic} onChange={(e) => setTopic(e.target.value)} />
      </label>

      <div className="grid grid-cols-2 gap-4">
        <label className="block">
          <span className="font-semibold">Rounds</span>
          <input type="number" min={1} max={20} className="mt-1 w-full border rounded px-3 py-2"
                 value={rounds} onChange={(e) => setRounds(Number(e.target.value))} />
        </label>
        <label className="block">
          <span className="font-semibold">Max tokens per turn (~30s ≈ 150 tokens)</span>
          <input type="range" min={50} max={500} step={10}
                 value={maxTokens} onChange={(e) => setMaxTokens(Number(e.target.value))}
                 className="mt-3 w-full" />
          <span className="text-sm text-gray-600">{maxTokens} tokens</span>
        </label>
      </div>

      <label className="flex items-center gap-2">
        <input type="checkbox" checked={teamsEnabled} onChange={(e) => setTeamsEnabled(e.target.checked)} />
        <span className="font-semibold">Enable teams (2 teams, hidden inter-round huddles)</span>
      </label>

      <div>
        <h2 className="font-semibold mb-2">Debaters ({debaters.length})</h2>
        <div className="space-y-3">
          {debaters.map((d, i) => (
            <div key={i} className="border rounded p-3 space-y-2">
              <div className="flex flex-wrap gap-2 items-center">
                <select className="border rounded px-2 py-1 text-sm"
                        value={`${d.provider}:${d.model}`}
                        onChange={(e) => {
                          const [p, m] = e.target.value.split(":");
                          updateDebater(i, { provider: p as ProviderId, model: m });
                        }}>
                  {CATALOG.map((m) => (
                    <option key={`${m.provider}:${m.model}`} value={`${m.provider}:${m.model}`}>{m.label}</option>
                  ))}
                </select>
                <input className="border rounded px-2 py-1 text-sm w-32"
                       placeholder="Display name"
                       value={d.displayName}
                       onChange={(e) => updateDebater(i, { displayName: e.target.value })} />
                <VoicePicker value={d.voiceUri} onChange={(v) => updateDebater(i, { voiceUri: v })} />
                {teamsEnabled && (
                  <select className="border rounded px-2 py-1 text-sm"
                          value={d.teamIndex ?? 0}
                          onChange={(e) => updateDebater(i, { teamIndex: Number(e.target.value) })}>
                    <option value={0}>Team Blue</option>
                    <option value={1}>Team Red</option>
                  </select>
                )}
                <button type="button" className="text-red-600 text-sm ml-auto"
                        onClick={() => removeDebater(i)} disabled={debaters.length <= 2}>Remove</button>
              </div>
              <input className="w-full border rounded px-2 py-1 text-sm"
                     placeholder="Stance (what this AI must defend)"
                     value={d.stance} onChange={(e) => updateDebater(i, { stance: e.target.value })} />
            </div>
          ))}
          <button type="button" className="text-blue-600 text-sm"
                  onClick={addDebater} disabled={debaters.length >= 6}>+ Add debater</button>
        </div>
      </div>

      <label className="block">
        <span className="font-semibold">Judge (cannot be a debater)</span>
        <select className="mt-1 border rounded px-2 py-1 text-sm"
                value={judgeModel}
                onChange={(e) => setJudgeModel(e.target.value)}>
          {CATALOG.map((m) => (
            <option key={`${m.provider}:${m.model}`} value={`${m.provider}:${m.model}`}>{m.label}</option>
          ))}
        </select>
      </label>

      {error && <div className="text-red-600 text-sm">{error}</div>}
      <button type="button" disabled={!canSubmit || submitting}
              onClick={submit}
              className="px-6 py-2 rounded bg-blue-600 text-white disabled:opacity-50">
        {submitting ? "Starting…" : "Start debate"}
      </button>
    </div>
  );
}
```

- [ ] **Step 3: Manual smoke check**

Add a dummy entry to `.env.local` if it doesn't exist (any value):

```
OPENAI_API_KEY=sk-test
ANTHROPIC_API_KEY=sk-ant-test
DEEPSEEK_API_KEY=sk-test
GOOGLE_API_KEY=test
```

Then run:

```bash
npm run dev
```

Open `http://localhost:3000/setup`. Verify:
- Page renders with topic input, rounds slider, max tokens slider, teams toggle, 4 debater rows, judge dropdown.
- Voice dropdown is populated (browser-dependent; Chrome and Edge work).
- Clicking "Start debate" with everything filled in posts to `/api/debates` and navigates to `/debate/<id>` (will 404 until Task 30, that's expected).

Kill the dev server with Ctrl+C.

- [ ] **Step 4: Commit**

```bash
git add app/setup/page.tsx components/setup-form.tsx
git commit -m "Add setup page and debate configuration form"
```

---

## Milestone 7 — Stage UI

### Task 26: SSE client hook

**Files:**
- Create: `lib/client/use-sse.ts`

- [ ] **Step 1: Create the hook**

`lib/client/use-sse.ts`:

```ts
"use client";
import { useEffect, useRef, useState } from "react";

export function useSse<T = any>(url: string | null): { events: T[]; connected: boolean } {
  const [events, setEvents] = useState<T[]>([]);
  const [connected, setConnected] = useState(false);
  const ref = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!url) return;
    const es = new EventSource(url);
    ref.current = es;
    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false);
    es.onmessage = (e) => {
      try {
        const parsed = JSON.parse(e.data);
        setEvents((arr) => [...arr, parsed]);
      } catch {/* ignore malformed */}
    };
    return () => {
      es.close();
      ref.current = null;
      setConnected(false);
    };
  }, [url]);

  return { events, connected };
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add lib/client/use-sse.ts
git commit -m "Add SSE client hook"
```

---

### Task 27: TTS speak hook

**Files:**
- Create: `lib/client/use-speak.ts`, `lib/client/use-speak.test.ts`

The hook receives streamed text chunks; when a sentence boundary is detected, it queues the sentence into `speechSynthesis` with the assigned voice. This avoids gap-out mid-word.

- [ ] **Step 1: Write the failing test**

`lib/client/use-speak.test.ts`:

```ts
/**
 * @jest-environment jsdom
 */
import { extractSentences } from "./use-speak";

describe("extractSentences", () => {
  it("returns no sentences for an unfinished string", () => {
    const { sentences, rest } = extractSentences("Hello there");
    expect(sentences).toEqual([]);
    expect(rest).toBe("Hello there");
  });

  it("splits on . ! ? followed by space", () => {
    const { sentences, rest } = extractSentences("One. Two! Three? leftover");
    expect(sentences).toEqual(["One.", "Two!", "Three?"]);
    expect(rest).toBe("leftover");
  });

  it("keeps a trailing fragment as rest", () => {
    const { sentences, rest } = extractSentences("One. Two");
    expect(sentences).toEqual(["One."]);
    expect(rest).toBe("Two");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- use-speak
```

Expected: FAIL.

- [ ] **Step 3: Implement the hook**

`lib/client/use-speak.ts`:

```ts
"use client";
import { useEffect, useRef } from "react";

export interface SpeakArgs {
  voiceUri: string;
  text: string; // full streamed text so far
  active: boolean; // only speak when this debater is the active speaker
}

export function extractSentences(buffer: string): { sentences: string[]; rest: string } {
  const sentences: string[] = [];
  const re = /([.!?])\s+/g;
  let lastIdx = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(buffer)) !== null) {
    const end = m.index + m[1].length;
    sentences.push(buffer.slice(lastIdx, end));
    lastIdx = m.index + m[0].length;
  }
  return { sentences: sentences.map((s) => s.trim()), rest: buffer.slice(lastIdx) };
}

export function useSpeak(args: SpeakArgs) {
  const lastSpokenUpTo = useRef(0);

  useEffect(() => {
    if (!args.active) return;
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

    const buf = args.text.slice(lastSpokenUpTo.current);
    const { sentences, rest } = extractSentences(buf);
    if (sentences.length === 0) return;

    const voices = window.speechSynthesis.getVoices();
    const voice = voices.find((v) => v.voiceURI === args.voiceUri);

    for (const s of sentences) {
      const u = new SpeechSynthesisUtterance(s);
      if (voice) u.voice = voice;
      window.speechSynthesis.speak(u);
    }
    lastSpokenUpTo.current = args.text.length - rest.length;
  }, [args.text, args.active, args.voiceUri]);

  useEffect(() => {
    if (!args.active && typeof window !== "undefined" && "speechSynthesis" in window) {
      // When this debater becomes inactive, cancel any leftover queued speech and reset cursor.
      lastSpokenUpTo.current = 0;
    }
  }, [args.active]);
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- use-speak
```

Expected: `3 passed`.

- [ ] **Step 5: Commit**

```bash
git add lib/client/use-speak.ts lib/client/use-speak.test.ts
git commit -m "Add TTS sentence extractor and useSpeak hook"
```

---

### Task 28: Stage components — Podium and SpeechBubble

**Files:**
- Create: `components/podium.tsx`, `components/speech-bubble.tsx`

- [ ] **Step 1: Create the podium component**

`components/podium.tsx`:

```tsx
"use client";
import clsx from "clsx";
import type { Debater, Team } from "../lib/types";
import { findModel } from "../lib/providers/catalog";

export function Podium({
  debater, team, active, disabled,
}: { debater: Debater; team?: Team; active: boolean; disabled: boolean }) {
  const desc = findModel(debater.provider, debater.model);
  return (
    <div className={clsx(
      "border-2 rounded-lg p-3 text-center transition-all bg-white shadow",
      active && "scale-110 ring-4",
      disabled && "opacity-40 grayscale",
    )} style={{ borderColor: desc?.brandColor ?? "#888", boxShadow: active ? `0 0 24px ${desc?.brandColor}` : undefined }}>
      {team && (
        <div className="h-2 -mx-3 -mt-3 mb-2 rounded-t" style={{ background: team.color }} />
      )}
      <div className="font-bold">{debater.displayName} {active && "🔊"}</div>
      <div className="text-xs text-gray-500">{desc?.label}</div>
      <div className="text-sm font-semibold mt-1" style={{ color: desc?.brandColor }}>
        "{debater.stance}"
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create the speech bubble**

`components/speech-bubble.tsx`:

```tsx
"use client";
import { findModel } from "../lib/providers/catalog";
import type { Debater } from "../lib/types";

export function SpeechBubble({
  debater, text, tokenProgress, maxTokens,
}: { debater: Debater; text: string; tokenProgress: number; maxTokens: number }) {
  const desc = findModel(debater.provider, debater.model);
  const pct = Math.min(100, (tokenProgress / maxTokens) * 100);
  return (
    <div className="bg-white rounded-2xl shadow-lg p-6 border-l-8 max-w-3xl mx-auto" style={{ borderColor: desc?.brandColor }}>
      <div className="text-sm font-bold mb-2" style={{ color: desc?.brandColor }}>
        {debater.displayName} · "{debater.stance}"
      </div>
      <div className="text-lg leading-relaxed min-h-[80px]">{text || <span className="text-gray-400 italic">…thinking…</span>}</div>
      <div className="mt-3 h-1 bg-gray-200 rounded overflow-hidden">
        <div className="h-full transition-all" style={{ width: `${pct}%`, background: desc?.brandColor }} />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add components/podium.tsx components/speech-bubble.tsx
git commit -m "Add Podium and SpeechBubble stage components"
```

---

### Task 29: Stage page — wiring SSE, podiums, speech, TTS

**Files:**
- Create: `app/debate/[id]/page.tsx`, `app/debate/[id]/stage.tsx`

- [ ] **Step 1: Create the server page (loads debate config)**

`app/debate/[id]/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import { getDb } from "../../../lib/db/connection";
import { getDebate } from "../../../lib/db/repo";
import { Stage } from "./stage";

export default async function DebatePage({ params }: { params: { id: string } }) {
  const debate = getDebate(getDb(), params.id);
  if (!debate) notFound();
  return <Stage debate={debate} />;
}
```

- [ ] **Step 2: Create the client stage**

`app/debate/[id]/stage.tsx`:

```tsx
"use client";
import { useEffect, useMemo, useState } from "react";
import { useSse } from "../../../lib/client/use-sse";
import { useSpeak } from "../../../lib/client/use-speak";
import { Podium } from "../../../components/podium";
import { SpeechBubble } from "../../../components/speech-bubble";
import { postControl } from "../../../lib/client/api";
import type { DebateConfig } from "../../../lib/types";
import type { EngineEvent } from "../../../lib/engine/events";

export function Stage({ debate }: { debate: DebateConfig }) {
  const { events, connected } = useSse<EngineEvent>(`/api/debates/${debate.id}/stream`);

  const state = useMemo(() => deriveState(debate, events), [debate, events]);

  return (
    <main className="min-h-screen bg-gradient-to-b from-yellow-50 to-white p-6">
      <header className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold">{debate.topic}</h1>
        <div className="text-sm">
          Round {state.roundNumber}/{debate.roundCount} · {connected ? "● live" : "○ disconnected"}
        </div>
        <div className="flex gap-2">
          <button onClick={() => postControl(debate.id, { action: state.paused ? "resume" : "pause" })}
                  className="px-3 py-1 border rounded text-sm">{state.paused ? "▶ Resume" : "⏸ Pause"}</button>
          <button onClick={() => postControl(debate.id, { action: "skip" })}
                  className="px-3 py-1 border rounded text-sm">⏭ Skip</button>
        </div>
      </header>

      <div className="mb-8 min-h-[180px]">
        {state.activeDebater && (
          <SpeechBubble debater={state.activeDebater}
                        text={state.currentText}
                        tokenProgress={state.currentTokens}
                        maxTokens={debate.maxTokens} />
        )}
      </div>

      <div className={`grid gap-4`} style={{ gridTemplateColumns: `repeat(${debate.debaters.length}, minmax(0, 1fr))` }}>
        {debate.debaters.map((d) => {
          const team = debate.teams.find((t) => t.id === d.teamId);
          const active = state.activeDebater?.id === d.id;
          return <PodiumSlot key={d.id} debater={d} team={team} active={active}
                             debateText={state.textByDebater[d.id] ?? ""} />;
        })}
      </div>

      {state.verdict && (
        <div className="mt-8 p-4 border-2 border-amber-400 bg-amber-50 rounded">
          <div className="font-bold mb-1">Verdict</div>
          <div>Winner: {findWinnerLabel(debate, state.verdict)}</div>
          <p className="text-sm mt-2">{state.verdict.reasoning}</p>
        </div>
      )}

      {state.errors.length > 0 && (
        <div className="mt-4 text-sm text-red-600">
          {state.errors.map((e, i) => <div key={i}>⚠ {e}</div>)}
        </div>
      )}
    </main>
  );
}

function PodiumSlot({ debater, team, active, debateText }: any) {
  useSpeak({ voiceUri: debater.voiceUri, text: debateText, active });
  return <Podium debater={debater} team={team} active={active} disabled={debater.disabled} />;
}

interface DerivedState {
  roundNumber: number;
  activeDebater: any | null;
  currentText: string;
  currentTokens: number;
  textByDebater: Record<string, string>;
  paused: boolean;
  verdict: { winnerDebaterId: string | null; winnerTeamId: string | null; reasoning: string } | null;
  errors: string[];
}

function deriveState(debate: DebateConfig, events: EngineEvent[]): DerivedState {
  let roundNumber = 1;
  let activeId: string | null = null;
  let currentText = "";
  let currentTokens = 0;
  const textByDebater: Record<string, string> = {};
  let paused = false;
  let verdict: any = null;
  const errors: string[] = [];

  for (const e of events) {
    switch (e.type) {
      case "turn_start":
        roundNumber = e.roundNumber;
        activeId = e.debaterId;
        currentText = "";
        currentTokens = 0;
        textByDebater[e.debaterId] = "";
        break;
      case "chunk":
        if (activeId === e.debaterId) {
          currentText += e.text;
          currentTokens = Math.max(1, Math.round(currentText.length / 4));
          textByDebater[e.debaterId] = currentText;
        }
        break;
      case "turn_end":
        textByDebater[e.debaterId] = e.fullText;
        activeId = null;
        break;
      case "turn_error":
        textByDebater[e.debaterId] = e.partialText;
        errors.push(`${e.debaterId} failed: ${e.reason}`);
        activeId = null;
        break;
      case "verdict":
        verdict = { winnerDebaterId: e.winnerDebaterId, winnerTeamId: e.winnerTeamId, reasoning: e.reasoning };
        break;
      case "error":
        errors.push(e.message);
        break;
    }
  }
  const activeDebater = activeId ? debate.debaters.find((d) => d.id === activeId) ?? null : null;
  return { roundNumber, activeDebater, currentText, currentTokens, textByDebater, paused, verdict, errors };
}

function findWinnerLabel(debate: DebateConfig, v: { winnerDebaterId: string | null; winnerTeamId: string | null }): string {
  if (v.winnerDebaterId) return debate.debaters.find((d) => d.id === v.winnerDebaterId)?.displayName ?? "?";
  if (v.winnerTeamId) return debate.teams.find((t) => t.id === v.winnerTeamId)?.name ?? "?";
  return "no clear winner";
}
```

- [ ] **Step 3: Manual smoke test**

Start with stub providers so it doesn't burn API credits:

```bash
DEBATE_USE_STUB_PROVIDERS=true npm run dev
```

(On Windows PowerShell: `$env:DEBATE_USE_STUB_PROVIDERS = "true"; npm run dev`)

Open `http://localhost:3000/setup`. Configure a debate (any topic, 2 rounds, max 50 tokens). Click "Start debate". Verify:
- Browser navigates to `/debate/<id>`.
- Podiums render at the bottom for each debater.
- The active speaker's podium glows; the speech bubble streams text.
- A verdict shows at the end.

Kill the dev server.

- [ ] **Step 4: Commit**

```bash
git add app/debate/[id]/page.tsx app/debate/[id]/stage.tsx
git commit -m "Add live debate stage with SSE wiring, podiums, and TTS"
```

---

### Task 30: Vote bar + interject input

**Files:**
- Create: `components/vote-bar.tsx`, `components/interject-input.tsx`
- Modify: `app/debate/[id]/stage.tsx`

- [ ] **Step 1: Create the vote bar**

`components/vote-bar.tsx`:

```tsx
"use client";
import { useState } from "react";
import type { Debater } from "../lib/types";

export function VoteBar({ debaters, currentVote, onVote }:
  { debaters: Debater[]; currentVote: string | null; onVote: (id: string) => void }) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-sm font-semibold">Who won this round?</span>
      {debaters.map((d) => (
        <button key={d.id}
                onClick={() => onVote(d.id)}
                className={`px-3 py-1 rounded border text-sm ${currentVote === d.id ? "bg-amber-200 border-amber-500" : "bg-white"}`}>
          {d.displayName}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Create the interject input**

`components/interject-input.tsx`:

```tsx
"use client";
import { useState } from "react";

export function InterjectInput({ onSend }: { onSend: (text: string) => Promise<void> }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmation, setConfirmation] = useState<string | null>(null);

  const send = async () => {
    if (!text.trim()) return;
    setBusy(true);
    try {
      await onSend(text.trim());
      setConfirmation("Moderator note will be heard next turn.");
      setText("");
      setTimeout(() => setConfirmation(null), 2500);
    } finally { setBusy(false); }
  };

  return (
    <div className="flex gap-2 mt-2">
      <input className="border rounded px-2 py-1 text-sm flex-1"
             placeholder="Interject as moderator…"
             value={text} onChange={(e) => setText(e.target.value)}
             onKeyDown={(e) => e.key === "Enter" && send()} />
      <button className="px-3 py-1 rounded border text-sm bg-white" disabled={busy} onClick={send}>Send</button>
      {confirmation && <span className="text-xs text-green-700 self-center">{confirmation}</span>}
    </div>
  );
}
```

- [ ] **Step 3: Wire into the stage**

Edit `app/debate/[id]/stage.tsx`. Add imports:

```tsx
import { VoteBar } from "../../../components/vote-bar";
import { InterjectInput } from "../../../components/interject-input";
```

Add state for round id + current vote. Below the verdict block (or above it), insert:

```tsx
      <div className="mt-6 p-3 border rounded bg-white space-y-2 max-w-3xl mx-auto">
        <VoteBar
          debaters={debate.debaters}
          currentVote={null}
          onVote={(debaterId) => {
            // Stage already knows the most recent round number from events; in v1 we look it up via
            // the latest round_end (or current speaking round). For the vote endpoint we need roundId,
            // so query it lazily via /api/debates/[id].
            fetch(`/api/debates/${debate.id}`)
              .then((r) => r.json())
              .then((j) => {
                const rounds = j.transcript?.rounds ?? [];
                const latest = rounds[rounds.length - 1];
                if (!latest) return;
                postControl(debate.id, { action: "vote", roundId: latest.roundId ?? latest.id, debaterId });
              });
          }}
        />
        <InterjectInput onSend={(text) => postControl(debate.id, { action: "interject", text })} />
      </div>
```

Note: `getFullTranscript` doesn't yet return round `id` — only `roundNumber`. Add it: in `lib/db/round-repo.ts`, update the `TranscriptRound` interface:

```ts
export interface TranscriptRound {
  roundId: string;
  roundNumber: number;
  speeches: { debaterId: string; text: string; tokenCount: number; error: string | null }[];
  whispers: { debaterId: string; teamId: string; text: string }[];
  votes: { debaterId: string }[];
  interjections: { text: string }[];
}
```

And in the `getFullTranscript` mapping, include `roundId: r.id`. Update the existing test in `lib/db/round-repo.test.ts` accordingly (the assertions still pass; just verify after).

- [ ] **Step 4: Re-run tests**

```bash
npm test
```

Expected: all green. If `round-repo.test.ts` fails due to the schema change, the test only checks `speeches`/`whispers`/`votes`/`interjections` — no change needed.

- [ ] **Step 5: Manual smoke test**

```bash
$env:DEBATE_USE_STUB_PROVIDERS = "true"; npm run dev
```

Run a 2-round stub debate; verify the vote bar accepts a click (a row is written to the `votes` table — check `data/debate.db` with `sqlite3` or skip this verification), and the interject input shows a confirmation toast.

- [ ] **Step 6: Commit**

```bash
git add components/vote-bar.tsx components/interject-input.tsx app/debate/[id]/stage.tsx lib/db/round-repo.ts
git commit -m "Add vote bar and moderator interjection input"
```

---

### Task 31: Huddle panel — shows whispers between rounds

**Files:**
- Create: `components/huddle-panel.tsx`
- Modify: `app/debate/[id]/stage.tsx`

- [ ] **Step 1: Create the panel**

`components/huddle-panel.tsx`:

```tsx
"use client";
import type { DebateConfig } from "../lib/types";

export function HuddlePanel({
  debate, whispers,
}: { debate: DebateConfig; whispers: { teamId: string; debaterId: string; text: string }[] }) {
  if (whispers.length === 0) return null;
  const byTeam = new Map<string, typeof whispers>();
  for (const w of whispers) {
    const arr = byTeam.get(w.teamId) ?? [];
    arr.push(w); byTeam.set(w.teamId, arr);
  }
  return (
    <div className="my-6 grid grid-cols-2 gap-4 max-w-3xl mx-auto">
      {debate.teams.map((t) => {
        const team = byTeam.get(t.id) ?? [];
        return (
          <div key={t.id} className="rounded-lg p-3 border-2" style={{ borderColor: t.color }}>
            <div className="font-bold mb-2" style={{ color: t.color }}>{t.name} · huddle</div>
            <ul className="space-y-1 text-sm">
              {team.map((w, i) => {
                const speaker = debate.debaters.find((d) => d.id === w.debaterId);
                return <li key={i}><b>{speaker?.displayName}:</b> {w.text}</li>;
              })}
              {team.length === 0 && <li className="italic text-gray-400">(silent)</li>}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Wire whispers into the stage state**

Edit `app/debate/[id]/stage.tsx`. Extend `DerivedState`:

```tsx
interface DerivedState {
  // …existing fields…
  huddleActive: boolean;
  currentHuddleWhispers: { teamId: string; debaterId: string; text: string }[];
}
```

And in `deriveState`, add cases:

```tsx
      case "huddle_start":
        // Reset per-huddle whispers when a new huddle begins.
        // Implementation note: we shadow the previous huddle's whispers; the panel only shows the current one.
        // (For research-mode "show all", a future toggle could keep history.)
        // currentHuddleWhispers is reinitialized below before the loop returns.
        break;
      case "whisper":
        currentHuddleWhispers.push({ teamId: e.teamId, debaterId: e.debaterId, text: e.text });
        break;
      case "huddle_end":
        huddleActive = false;
        break;
```

Make sure `let currentHuddleWhispers: any[] = [];` and `let huddleActive = false;` are declared inside `deriveState`, set `huddleActive = true` on `huddle_start`, and reset `currentHuddleWhispers = []` on `huddle_start`.

Return the new fields and render the panel:

```tsx
      {state.huddleActive && (
        <HuddlePanel debate={debate} whispers={state.currentHuddleWhispers} />
      )}
```

Add the import: `import { HuddlePanel } from "../../../components/huddle-panel";`.

- [ ] **Step 3: Verify**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Manual smoke test**

```bash
$env:DEBATE_USE_STUB_PROVIDERS = "true"; npm run dev
```

Configure a 2-round debate with teams enabled. Between rounds, verify two team-colored panels appear with one whisper per debater.

- [ ] **Step 5: Commit**

```bash
git add components/huddle-panel.tsx app/debate/[id]/stage.tsx
git commit -m "Show team huddle whispers between rounds"
```

---

### Task 32: Verdict override UI

**Files:**
- Modify: `app/debate/[id]/stage.tsx`

- [ ] **Step 1: Add override controls under the verdict block**

Edit `app/debate/[id]/stage.tsx`. Inside the `state.verdict` JSX block, after the reasoning paragraph, add:

```tsx
          <div className="mt-3 pt-3 border-t border-amber-300 flex flex-wrap gap-2 items-center">
            <span className="text-sm font-semibold">Override winner:</span>
            {debate.debaters.map((d) => (
              <button key={d.id}
                      className="px-3 py-1 border rounded text-sm bg-white"
                      onClick={() =>
                        fetch(`/api/debates/${debate.id}/verdict`, {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ override: d.id }),
                        })
                      }>
                {d.displayName}
              </button>
            ))}
          </div>
```

- [ ] **Step 2: Manual smoke test**

```bash
$env:DEBATE_USE_STUB_PROVIDERS = "true"; npm run dev
```

Run a stub debate to completion. After the verdict appears, click an override button. Open `data/debate.db` (or query via SQLite CLI) and verify the `user_override` column is set.

Alternative quick verification: query `/api/debates/<id>` afterwards — `transcript.verdict.userOverride` should be the chosen debater id.

- [ ] **Step 3: Commit**

```bash
git add app/debate/[id]/stage.tsx
git commit -m "Add user override controls under the verdict"
```

---

## Milestone 8 — History page + replay

### Task 33: History page

**Files:**
- Create: `app/history/page.tsx`

- [ ] **Step 1: Create the page**

`app/history/page.tsx`:

```tsx
import Link from "next/link";
import { getDb } from "../../lib/db/connection";
import { listDebates } from "../../lib/db/repo";

export default async function HistoryPage() {
  const rows = listDebates(getDb());
  return (
    <main className="min-h-screen p-8 max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Past Debates</h1>
      {rows.length === 0 && <p className="text-gray-500">No debates yet. <Link href="/setup" className="text-blue-600 underline">Start one</Link>.</p>}
      <ul className="divide-y">
        {rows.map((r) => (
          <li key={r.id} className="py-3 flex items-center justify-between">
            <div>
              <div className="font-semibold">{r.topic}</div>
              <div className="text-xs text-gray-500">
                {new Date(r.createdAt).toLocaleString()} · status: {r.status}
              </div>
            </div>
            <Link className="px-3 py-1 border rounded text-sm" href={`/debate/${r.id}?replay=1`}>Open</Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
```

- [ ] **Step 2: Manual smoke test**

```bash
$env:DEBATE_USE_STUB_PROVIDERS = "true"; npm run dev
```

Open `http://localhost:3000/history`. Verify the table renders. After a debate completes, refresh and confirm it appears.

- [ ] **Step 3: Commit**

```bash
git add app/history/page.tsx
git commit -m "Add /history page listing past debates"
```

---

### Task 34: Replay mode

**Files:**
- Modify: `app/debate/[id]/page.tsx`, `app/debate/[id]/stage.tsx`

In replay mode (`?replay=1` query), the stage page reads the stored transcript instead of opening an SSE stream, then synthesizes "fake" events at the original cadence.

- [ ] **Step 1: Add a `replay` prop path**

Edit `app/debate/[id]/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import { getDb } from "../../../lib/db/connection";
import { getDebate } from "../../../lib/db/repo";
import { getFullTranscript } from "../../../lib/db/round-repo";
import { Stage } from "./stage";

export default async function DebatePage({ params, searchParams }: { params: { id: string }; searchParams: { replay?: string } }) {
  const db = getDb();
  const debate = getDebate(db, params.id);
  if (!debate) notFound();
  if (searchParams.replay === "1") {
    const transcript = getFullTranscript(db, params.id);
    return <Stage debate={debate} replay={transcript} />;
  }
  return <Stage debate={debate} />;
}
```

- [ ] **Step 2: Add replay synthesis to the stage**

Edit `app/debate/[id]/stage.tsx`. Update the signature:

```tsx
export function Stage({ debate, replay }: { debate: DebateConfig; replay?: { rounds: any[]; verdict: any } }) {
```

At the top of the component body, replace the `useSse` line with:

```tsx
  const live = useSse<EngineEvent>(replay ? null : `/api/debates/${debate.id}/stream`);
  const replayed = useReplayEvents(replay, debate);
  const events = replay ? replayed.events : live.events;
  const connected = replay ? replayed.done : live.connected;
```

Add the replay hook at the bottom of the file:

```tsx
function useReplayEvents(replay: { rounds: any[]; verdict: any } | undefined, debate: DebateConfig) {
  const [events, setEvents] = useState<EngineEvent[]>([]);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!replay) return;
    let cancelled = false;
    (async () => {
      const out: EngineEvent[] = [];
      for (const r of replay.rounds) {
        for (const s of r.speeches) {
          out.push({ type: "turn_start", roundNumber: r.roundNumber, debaterId: s.debaterId });
          setEvents([...out]);
          // Chunk by sentences for replay cadence; ~120 chars per chunk.
          for (let i = 0; i < s.text.length; i += 80) {
            await new Promise((res) => setTimeout(res, 150));
            if (cancelled) return;
            out.push({ type: "chunk", debaterId: s.debaterId, text: s.text.slice(i, i + 80) });
            setEvents([...out]);
          }
          out.push({ type: "turn_end", debaterId: s.debaterId, fullText: s.text, tokenCount: s.tokenCount });
          setEvents([...out]);
        }
        if (r.whispers.length > 0) {
          out.push({ type: "huddle_start", roundNumber: r.roundNumber });
          for (const w of r.whispers) {
            out.push({ type: "whisper", teamId: w.teamId, debaterId: w.debaterId, text: w.text });
          }
          out.push({ type: "huddle_end", roundNumber: r.roundNumber });
          setEvents([...out]);
        }
        out.push({ type: "round_end", roundNumber: r.roundNumber });
        setEvents([...out]);
      }
      if (replay.verdict) {
        out.push({
          type: "verdict",
          winnerDebaterId: replay.verdict.winnerDebaterId,
          winnerTeamId: replay.verdict.winnerTeamId,
          reasoning: replay.verdict.reasoning,
        });
        setEvents([...out]);
      }
      setDone(true);
    })();
    return () => { cancelled = true; };
  }, [replay, debate]);

  return { events, done };
}
```

Make sure `useState` and `useEffect` are imported.

- [ ] **Step 3: Manual smoke test**

```bash
$env:DEBATE_USE_STUB_PROVIDERS = "true"; npm run dev
```

Open `http://localhost:3000/history`. Click "Open" on a completed debate. Verify text streams back and the verdict appears.

- [ ] **Step 4: Commit**

```bash
git add app/debate/[id]/page.tsx app/debate/[id]/stage.tsx
git commit -m "Add replay mode that re-plays stored transcripts at typing cadence"
```

---

## Milestone 9 — End-to-end smoke test

### Task 35: Playwright config + stubbed E2E

**Files:**
- Create: `playwright.config.ts`, `e2e/full-debate.spec.ts`

- [ ] **Step 1: Create Playwright config**

`playwright.config.ts`:

```ts
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  webServer: {
    command: "npm run dev",
    port: 3000,
    reuseExistingServer: !process.env.CI,
    env: {
      DEBATE_USE_STUB_PROVIDERS: "true",
      DEBATE_DB_PATH: "./data/e2e.db",
      OPENAI_API_KEY: "stub",
      ANTHROPIC_API_KEY: "stub",
      DEEPSEEK_API_KEY: "stub",
      GOOGLE_API_KEY: "stub",
    },
  },
  use: {
    baseURL: "http://localhost:3000",
  },
});
```

- [ ] **Step 2: Add the e2e script to package.json**

In `package.json` `scripts`, add:

```json
"e2e": "playwright test"
```

- [ ] **Step 3: Write the E2E test**

`e2e/full-debate.spec.ts`:

```ts
import { test, expect } from "@playwright/test";

test("set up a stub debate, watch it, see a verdict", async ({ page }) => {
  await page.goto("/setup");
  await expect(page.getByText("Configure Debate")).toBeVisible();

  await page.getByPlaceholder(/should AI/i).fill("Is fire wet?");

  // Set rounds to 2 for a fast test.
  await page.locator('input[type="number"]').fill("2");

  // Fill the 4 default debater stances.
  const stances = page.getByPlaceholder("Stance (what this AI must defend)");
  await stances.nth(0).fill("Yes, fire is wet");
  await stances.nth(1).fill("No, fire is not wet");
  await stances.nth(2).fill("Conditionally wet");
  await stances.nth(3).fill("Wetness is undefined");

  // The voice picker is browser-dependent; in headless Chromium voiceschanged may not fire reliably.
  // Use page.evaluate to inject a fake voiceURI directly into each select.
  await page.evaluate(() => {
    document.querySelectorAll("select").forEach((sel) => {
      const s = sel as HTMLSelectElement;
      if (s.options.length > 0 && s.value === "" && s.options[0].text.startsWith("—")) {
        // voice picker — add and select a stub option
        const o = document.createElement("option");
        o.value = "stub-voice"; o.text = "Stub Voice"; s.appendChild(o); s.value = "stub-voice";
        s.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });
  });

  await page.getByRole("button", { name: /start debate/i }).click();

  // The stage page loads; the verdict should appear in under 30 seconds with stubs.
  await expect(page.getByText(/Verdict/i)).toBeVisible({ timeout: 30_000 });
});
```

- [ ] **Step 4: Install Playwright browsers**

```bash
npx playwright install chromium
```

- [ ] **Step 5: Run the test**

```bash
npm run e2e
```

Expected: `1 passed`. (May take ~30 seconds because of the live dev server boot.)

- [ ] **Step 6: Commit**

```bash
git add playwright.config.ts e2e/full-debate.spec.ts package.json
git commit -m "Add stubbed end-to-end test through setup → stage → verdict"
```

---

### Task 36: README + final polish

**Files:**
- Create: `README.md`

- [ ] **Step 1: Write the README**

`README.md`:

```markdown
# AI Debate Colosseum

Locally-run web app: pit AI models from different providers against each other in structured real-time debates.

## Quick start

1. Copy `.env.local.example` to `.env.local` and fill in the API keys you have. You don't need all four — only the providers you intend to use must have keys.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the dev server:
   ```bash
   npm run dev
   ```
4. Open `http://localhost:3000`. Click **New Debate** to configure one.

## Without API keys (stub mode)

To run the UI end-to-end with scripted responses (no real API calls):

```bash
DEBATE_USE_STUB_PROVIDERS=true npm run dev
```

(On PowerShell: `$env:DEBATE_USE_STUB_PROVIDERS = "true"; npm run dev`)

## Testing

```bash
npm test       # unit + integration tests
npm run e2e    # end-to-end test (uses stub providers)
```

## Spec & plan

- Design spec: `docs/superpowers/specs/2026-05-17-ai-debate-design.md`
- Implementation plan: `docs/superpowers/plans/2026-05-17-ai-debate-colosseum.md`
```

- [ ] **Step 2: Run all tests one final time**

```bash
npm test && npm run e2e
```

Expected: everything green.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "Add README"
```

---

## Self-review notes (post-write check)

**Spec coverage:**
- §1 system overview → Milestones 1–5 (foundations + engine + API), Milestone 6 (setup form covers all config fields), Milestone 7 (stage covers all play-time behaviors), Milestone 8 (history + replay).
- §2 three layers → Milestones 2 (providers), 3 (db), 4 (engine), 5 (api), 6–7 (frontend).
- §3 schema and lifecycle → Tasks 10–12 implement the schema and repos; Task 18 implements the lifecycle.
- §4 UI screens → Tasks 25 (/setup), 28–32 (/debate/[id]), 33 (/history), 34 (replay).
- §5 error handling → Task 15 covers turn_error/skip; Task 17 covers judge fallback; Task 19 covers missing keys; Task 36 documents stub mode.
- §5 testing pyramid (5 surfaces) → Tasks 6–8 (provider unit tests), 13–18 (engine tests), 10–12 (db tests), 19–22 (API tests), 35 (E2E smoke).

**Disabling-on-repeated-failure** mentioned in §5 is partially implemented: schema has the `disabled` column and runRound skips disabled debaters, but the engine doesn't yet auto-set `disabled` after N failures. That's a small follow-up — left as a known gap rather than expanding scope. Single-turn errors are handled today.

**Type consistency check:**
- `Debater.teamId` is `string | null` throughout.
- `recordVerdict({ winnerDebaterId, winnerTeamId, reasoning })` — same field names everywhere (Task 17, Task 12).
- `EngineEvent.type === "turn_error"` — used in run-round, stage, tests — consistent.
- Round repo returns `roundId` from Task 30 onward — Task 30 also updates the `TranscriptRound` interface; earlier tasks don't depend on it.

No placeholders found.
