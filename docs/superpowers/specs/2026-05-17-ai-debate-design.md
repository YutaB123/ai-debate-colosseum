# AI Debate Colosseum — Design Spec

**Date:** 2026-05-17
**Status:** Approved by user (sections §1–§5), ready for implementation planning

## Purpose

A locally-run web app that lets the user pit AI models from different providers against each other in a structured, real-time debate, watch it unfold on a "TV news studio" stage with per-AI text-to-speech voices, optionally form teams with hidden inter-round strategy huddles, and have a neutral AI judge render a verdict the user can override. Built primarily as a research/experiment tool for comparing how different AI models reason and argue under controlled conditions — with enough game-feel to make watching it enjoyable.

## §1 — System overview

A **Next.js 14 (App Router) project** that runs locally and can deploy to Vercel later. User opens the app and configures a debate:

- **Topic** (free text)
- **Per-AI stance** (free-text position each model must defend)
- **Teams** (optional; AIs grouped into teams of 1–4, default is no teams)
- **Judge** (fixed 5th-seat model — never debates)
- **Round count** (default 10, configurable, range 1–20)
- **Time/length cap per turn** (slider — e.g., max ~30s of speech ≈ ~150 tokens)

A debate plays on a **bright "TV news studio" stage with podiums** (one per debater, 2–6 supported, 4 is the default). Each round, AIs speak in turn order; their response **streams** from provider → server route → browser via Server-Sent Events. As text streams in, the browser **speaks it** with a distinct `SpeechSynthesis` voice per AI. The current speaker's podium and speech bubble highlight; the others sit quiet.

**Between rounds:** if teams are enabled, each team enters a **hidden huddle phase**. Teammates each write one short "whisper" visible only to their team (and to the user for research). On the next round, each AI's context includes the public transcript + its own team's whispers — never the opposing team's.

User controls during play: **pause** (halts the engine at the next turn boundary — does not abort a mid-stream response), **skip** (aborts the current AI's stream and moves to the next debater), **replay** (re-plays the most recent completed turn's audio from stored text — does not re-generate), **interject as moderator** (text injected into the next AI's context), **vote** after each round. After the final round, the **judge model** reads the transcript (public speeches only, never whispers) and renders a verdict with reasoning; the user can **override**. Everything is saved to a local **SQLite** file (debates, rounds, public speeches, whispers, votes, verdict, override) for browsing later.

The time cap is **per AI turn** (one model's single speech), not per round overall.

## §2 — Architecture

**One Next.js project, three layers**, designed so each piece has one job and can be tested independently.

### Layer 1: AI provider adapter (`lib/providers/`)

A small interface — `streamCompletion({ messages, model, maxTokens }) → AsyncIterable<string>` — with one implementation per provider: `openai.ts`, `anthropic.ts`, `deepseek.ts`, `gemini.ts`. Each one knows only how to call its own SDK, translate our message format to theirs, and yield text chunks. The rest of the system never touches a provider SDK directly. Adding a 5th provider later means writing one file.

### Layer 2: Debate engine (`lib/engine/`)

The brain. Knows nothing about HTTP or React — just orchestrates the debate as an async state machine:

- `Debate` holds config (topic, stances, teams, judge, rounds, timeCap) and a running `Transcript`.
- `runRound()` iterates each AI's turn: builds that AI's context (public transcript + own team's whispers + optional moderator interjection), calls the provider adapter, yields streamed chunks while writing them to the transcript.
- Between rounds, if teams are enabled, `runHuddle()` collects one whisper per AI in parallel.
- `runJudgment()` runs at the end on the judge model.

Time/length cap = `maxTokens` ceiling passed to the adapter. Token caps are reliable across providers; wall-clock time isn't, because streaming speed varies — "time" is a UI-side approximation: "≈30s of speech ≈ 150 tokens".

### Layer 3: HTTP / SSE surface (`app/api/`)

Thin routes that wire the engine to the browser:

- `POST /api/debates` — create a debate, return id
- `GET /api/debates/[id]/stream` — **SSE endpoint**. Drives the engine and emits events: `turn_start`, `chunk`, `turn_end`, `turn_error`, `huddle_start`, `whisper`, `huddle_end`, `round_end`, `verdict`, `error`. The browser is a passive consumer.
- `POST /api/debates/[id]/control` — pause / resume / skip / interject / vote (mutates engine state)
- `GET /api/debates/[id]` — full record for history view
- `PATCH /api/debates/[id]/verdict` — set the user override

### Storage (`lib/db/`)

**SQLite via `better-sqlite3`**, one file at `./data/debate.db`. Synchronous, zero-config, easy to inspect. When deploying later, swap `better-sqlite3` for Turso (libSQL) — same SQL, no rewrite of queries.

### Frontend (`app/`)

- `/setup` — debate configuration form
- `/debate/[id]` — the live stage; subscribes to the SSE stream, renders the podium UI, runs `SpeechSynthesis` on incoming chunks, surfaces transport + interject + vote controls
- `/history` — list of past debates, click to replay or review

### Cross-cutting concerns

- **API keys**: server-side only, loaded from `.env.local`. Never sent to the browser.
- **SSE reconnection**: not implemented in v1. If the connection drops mid-debate, the user reloads the page; it re-reads the transcript from SQLite and re-subscribes to the SSE stream, which resumes emitting from the current turn. (Engine state persists in memory keyed by debate id.)
- **TTS sync**: text chunks arrive faster than speech. The browser queues chunks into the speech engine sentence-by-sentence so audio doesn't gap-out mid-word.

## §3 — Data model & debate lifecycle

### SQLite schema

```sql
debates (
  id              TEXT PRIMARY KEY,           -- uuid
  topic           TEXT NOT NULL,
  judge_model     TEXT NOT NULL,              -- e.g. 'openai:gpt-4o'
  round_count     INTEGER NOT NULL,
  max_tokens      INTEGER NOT NULL,           -- per-turn token cap (the "time" slider)
  teams_enabled   INTEGER NOT NULL,           -- 0/1
  status          TEXT NOT NULL,              -- 'setup' | 'running' | 'paused' | 'completed' | 'failed'
  created_at      INTEGER NOT NULL,
  completed_at    INTEGER
)

debaters (
  id           TEXT PRIMARY KEY,
  debate_id    TEXT NOT NULL REFERENCES debates(id),
  provider     TEXT NOT NULL,                 -- 'openai' | 'anthropic' | 'deepseek' | 'gemini'
  model        TEXT NOT NULL,                 -- 'gpt-4o', 'claude-opus-4-7', ...
  display_name TEXT NOT NULL,                 -- 'Claude', 'GPT-4o', etc.
  stance       TEXT NOT NULL,                 -- free-text position
  team_id      TEXT,                          -- null if teams disabled
  speak_order  INTEGER NOT NULL,              -- 0..N-1, fixed once set
  voice_uri    TEXT NOT NULL,                 -- SpeechSynthesis voice identifier
  disabled     INTEGER NOT NULL DEFAULT 0     -- set to 1 if provider fails repeatedly
)

teams (
  id         TEXT PRIMARY KEY,
  debate_id  TEXT NOT NULL REFERENCES debates(id),
  name       TEXT NOT NULL,                   -- 'Team Blue'
  color      TEXT NOT NULL                    -- hex
)

rounds (
  id           TEXT PRIMARY KEY,
  debate_id    TEXT NOT NULL REFERENCES debates(id),
  round_number INTEGER NOT NULL,
  status       TEXT NOT NULL,                 -- 'pending'|'speaking'|'huddle'|'completed'
  UNIQUE(debate_id, round_number)
)

speeches (
  id           TEXT PRIMARY KEY,
  round_id     TEXT NOT NULL REFERENCES rounds(id),
  debater_id   TEXT NOT NULL REFERENCES debaters(id),
  text         TEXT NOT NULL,                 -- final full text after streaming completes
  token_count  INTEGER NOT NULL,
  started_at   INTEGER NOT NULL,
  ended_at     INTEGER,
  error        TEXT                           -- non-null if turn errored mid-stream
)

whispers (                                    -- huddle messages, hidden from opposing team
  id         TEXT PRIMARY KEY,
  round_id   TEXT NOT NULL REFERENCES rounds(id),
  debater_id TEXT NOT NULL REFERENCES debaters(id),
  team_id    TEXT NOT NULL REFERENCES teams(id),
  text       TEXT NOT NULL,
  created_at INTEGER NOT NULL
)

interjections (                               -- user-as-moderator inputs
  id         TEXT PRIMARY KEY,
  round_id   TEXT NOT NULL REFERENCES rounds(id),
  text       TEXT NOT NULL,
  created_at INTEGER NOT NULL
)

votes (                                       -- one row per round per AI per user click
  id         TEXT PRIMARY KEY,
  round_id   TEXT NOT NULL REFERENCES rounds(id),
  debater_id TEXT NOT NULL REFERENCES debaters(id),
  created_at INTEGER NOT NULL
)

verdicts (
  id              TEXT PRIMARY KEY,
  debate_id       TEXT NOT NULL REFERENCES debates(id),
  winner_debater  TEXT REFERENCES debaters(id),   -- AI's pick
  winner_team     TEXT REFERENCES teams(id),
  reasoning       TEXT NOT NULL,
  user_override   TEXT,                            -- debater_id or team_id, if user overrode
  override_note   TEXT,                            -- optional free text from user
  created_at      INTEGER NOT NULL
)
```

### Lifecycle (one debate, end to end)

1. **Setup** — `POST /api/debates` writes `debates`, `teams`, `debaters` rows; status `setup`.
2. **Start** — browser opens `GET /api/debates/[id]/stream`. Engine flips status → `running`, creates round 1, begins emitting SSE.
3. **Speaking phase (each round)**:
   - For each debater in `speak_order` (skipping any marked `disabled`): open a `speech` row; stream from provider; emit `chunk` events; on completion, finalize the `speech` row with `text` and `token_count`.
   - User control events (`pause`, `skip`, `interject`, `vote`) come in via `POST /api/control` and are honored at the next chunk boundary or before the next turn.
4. **Huddle phase (between rounds, if teams enabled)**:
   - Spawn parallel calls — one per debater — each told to write a short private note to teammates. Each writes one `whispers` row.
   - Emit `whisper` events to the browser (visible to user, color-coded per team).
5. **Repeat** until `round_count` reached.
6. **Judgment** — engine calls judge model with the full transcript (public speeches only — judge does *not* see whispers). Writes `verdicts` row. Emits `verdict` event. Status → `completed`.
7. **Override (optional)** — user can later `PATCH` the verdict to set `user_override`. Status stays `completed`.

### Context building (what each AI sees on its turn)

```
SYSTEM: You are {display_name}. The topic is "{topic}". Your assigned position: {stance}.
        {if teams_enabled: You are on {team.name} with {teammates}.}
        Speak for at most {max_tokens} tokens. This is round {n}/{total}.

TRANSCRIPT (chronological public speeches):
  Round 1, GPT-4o (Con): "..."
  Round 1, Claude (Pro): "..."
  ...

{if teams_enabled, append:}
TEAM NOTES (private, from your teammates):
  Claude (last huddle): "..."

{if any interjections this round:}
MODERATOR: "{interjection text}"

Your turn. Speak now.
```

The judge gets a simpler prompt: topic, each debater's stance, full public transcript, instruction to pick a winner with reasoning.

## §4 — UI / screens

Three screens. Bright TV-news-studio theme: white/cream backgrounds, bold colored bands per team, clean sans-serif (Inter), brand-colored accent strips for each AI.

### `/setup` — debate configuration

Single-page form, top-to-bottom:

1. **Topic** — large text input. Example placeholder: *"Should AI systems be required to disclose when they are uncertain?"*
2. **Debaters** — a list of rows (default 4, range 2–6). Each row:
   - Provider + model dropdown (e.g., `openai → gpt-4o`)
   - Display name (auto-filled, editable)
   - **Stance** (free-text input) — *"Yes, with mandatory confidence scores in every response"*
   - Voice picker (lists available `SpeechSynthesis` voices on this device; first N distinct voices auto-assigned)
   - Team chip (only visible if teams enabled)
   - "Remove" button
3. **Teams toggle** — when on, shows a small team builder: drag debaters between named/colored teams (default: 2 teams, auto-split by `speak_order`).
4. **Judge** — provider + model dropdown. Defaults to a model not used by any debater. Cannot be one of the debaters.
5. **Rounds** — number input, default 10, range 1–20.
6. **Time/length cap** — slider labeled "Max speech length per turn". Range 50–500 tokens (default 150). Shows both `~30s ≈ 150 tokens` so the user sees both framings.
7. **Start debate** button. Disabled until topic + all stances + voices are set.

### `/debate/[id]` — the stage

```
┌────────────────────────────────────────────────────────────────┐
│  Topic: "Should AI systems disclose uncertainty?"   Round 3/10 │
│  ▶ Playing   [⏸ Pause] [⏭ Skip] [↻ Replay turn]    [📜 Log]    │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│        ┌─────────────────────────────────────────┐             │
│        │  CLAUDE  · PRO                          │             │
│        │  "Mandatory confidence scores would     │             │
│        │   actually undermine trust by..."       │             │
│        │  ▮▮▮▮▮▮▮▮▮▮▮▮▮▮▮▯▯▯▯  (speaking)        │             │
│        └─────────────────────────────────────────┘             │
│                                                                │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐            │
│ │ CLAUDE🔊 │ │ GPT-4o   │ │ DEEPSEEK │ │ GEMINI   │            │
│ │  PRO     │ │  CON     │ │  PRO     │ │  CON     │            │
│ │ Team Blue│ │ Team Red │ │ Team Blue│ │ Team Red │            │
│ └──────────┘ └──────────┘ └──────────┘ └──────────┘            │
│                                                                │
├────────────────────────────────────────────────────────────────┤
│  After-round bar (visible between rounds):                     │
│  Who won this round?  [Claude] [GPT] [DeepSeek] [Gemini] [Skip]│
│  Interject as moderator: [____________________________] [Send] │
└────────────────────────────────────────────────────────────────┘
```

Key behaviors:

- **Top bar**: topic + round counter + transport controls + log toggle.
- **Speech area**: a single large "lower-third" speech bubble for the current speaker, with a fine progress strip showing token cap consumption. Animated typing effect synced to streamed text.
- **Podium row**: cards at the bottom, one per debater. Active speaker's card lifts slightly, glows in their brand color, shows a speaker icon. Inactive cards dim. Team color shows as a colored band along the top of the card.
- **Vote bar**: appears between rounds. One click per round on whichever AI made the strongest point (or "Skip"). Selection persists; clicking another swaps the vote.
- **Interject input**: live throughout; submitting attaches the text to the *next* AI's context as a moderator note. Brief toast: "Moderator note will be heard next turn."
- **Huddle phase**: when teams enabled, the podium row dims; team banners slide up showing whispers as they arrive, color-coded. User sees both teams (research-mode); next round's AIs only see their own.
- **Log drawer (📜)**: opens a side panel with the full running transcript (no whispers in the public log; a toggle to show whispers for research view).

### `/history` — past debates

Simple table view: date · topic · participants · rounds · winner (AI verdict + override if any) · "Open" link. Clicking "Open" loads `/debate/[id]` in a read-only "replay" mode that plays the recorded transcript back at the original cadence (still using browser TTS).

## §5 — Error handling, testing, out-of-scope

### Error handling

**Provider failures during streaming.** Each provider adapter wraps its SDK call in a try/catch. On error, the adapter yields a sentinel `{ error: "..." }` and stops. The engine catches this, writes whatever partial text was already streamed to the `speeches` row (with `error` populated), emits a `turn_error` SSE event with the speaker + reason, and **proceeds to the next AI's turn**. The browser shows a small "⚠ GPT-4o failed mid-sentence" badge on that podium.

**Rate limits / quota exceeded.** Same path as above — caught, surfaced, debate continues. A persistent failure across multiple turns by the same AI marks that debater as `disabled = 1` for the rest of the debate (skipped on subsequent rounds, badge shown).

**Missing API key.** Caught at debate-creation time. `POST /api/debates` validates that every selected provider has a key in `.env.local`; returns 400 with a clear message if not. The setup form pre-flights this on load and shows "✗ No key set" next to any provider that's missing one.

**Browser disconnects mid-debate.** Engine state lives in memory keyed by `debate_id`. If the SSE connection drops, the engine keeps running until it either completes or hits a turn boundary. On reconnect (user reloads `/debate/[id]`), the page re-reads the transcript from SQLite and re-subscribes to the SSE stream, which resumes emitting from the current turn. v1 limitation: if the **server process** dies, in-memory engine state is lost — the debate becomes a stuck `running` row that can be marked `failed` via a `/history` action. We don't try to resume it.

**TTS unavailable.** If `SpeechSynthesis` isn't supported or no voices are loaded, the UI shows a banner "Voice playback unavailable — text-only mode" and skips audio. Text streaming still works.

**Judge failure.** If the judge call fails, the verdict is written with `reasoning = "(Judge unavailable)"` and `winner_debater = null`. The user can still override.

**Bad model output.** Whispers/speeches are stored verbatim. No content moderation in v1 — this is a local research tool used by one person on topics they choose.

### Testing

Five test surfaces, smallest to largest:

1. **Provider adapters** (`lib/providers/*.test.ts`) — unit tests with mocked SDK responses. Verify message-format translation and that streaming yields chunks in order. One test per provider.
2. **Engine** (`lib/engine/*.test.ts`) — feed the engine a stub provider that yields scripted chunks. Verify: turn order, context-building correctness (the right transcript + own-team whispers + interjections, **never** opposing-team whispers — this is the single most important invariant), token cap honored, round transitions, judge invocation. No real network.
3. **DB layer** (`lib/db/*.test.ts`) — in-memory SQLite (`:memory:`) with the same schema. Insert/read round-trip tests for each table.
4. **API routes** (`app/api/**/route.test.ts`) — exercise routes with stubbed engine + real DB. Verify SSE event sequence on the streaming endpoint matches the lifecycle (`turn_start` → `chunk*` → `turn_end` → … → `verdict`).
5. **End-to-end smoke** (one Playwright test) — stub all four providers to return canned responses; click through `/setup → /debate → vote → verdict`. Confirms wiring without burning API credits.

Run on every commit via `npm test`. Provider tests use mocks; **no live API calls in CI**.

### Explicitly out of scope for v1

- Authentication / multi-user. Local only.
- Streaming reconnection that survives server restarts.
- Real-time team-to-team interruption (huddles are between-round only).
- TTS provider beyond browser `SpeechSynthesis` (ElevenLabs etc. is a future swap).
- Content moderation, profanity filtering.
- Mobile/responsive polish — desktop-first; mobile is best-effort.
- Search across history (single-table scan via `/history` is fine for v1's scale).
- Exporting transcripts to PDF/Markdown — JSON export only.
- Per-debate cost tracking (token counts are recorded in `speeches` — billing math is a future feature).
- Sound effects, background music, animated transitions beyond the basic typing/podium glow.
