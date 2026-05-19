# Add Grok (xAI) Provider

## Goal

Add Grok as a fourth model provider alongside OpenAI, Anthropic, and Gemini, so users can pit Grok models against other frontier models in debates.

## Scope

Two Grok models exposed in the model picker:

- `grok-4` — flagship
- `grok-4-fast` — faster / cheaper variant

## Implementation Approach

xAI's API is OpenAI-compatible at `https://api.x.ai/v1`. The Grok provider reuses the `openai` SDK with a custom `baseURL`. This avoids a new SDK dependency and keeps streaming/error semantics identical to the existing OpenAI provider.

The provider reads its key from `XAI_API_KEY`.

## Changes

1. **`lib/types.ts`** — extend `ProviderId` union with `"grok"`.

2. **`lib/providers/grok.ts`** (new) — factory `createGrokProvider({ apiKey })` that returns a `StreamingProvider` with `id: "grok"`. Internally constructs `new OpenAI({ apiKey, baseURL: "https://api.x.ai/v1" })` and streams chat completions identically to the OpenAI provider.

3. **`lib/providers/registry.ts`**:
   - Add `"grok"` to the `KNOWN` array.
   - Add a `case "grok"` returning `createGrokProvider({ apiKey: requireEnv("XAI_API_KEY") })`.

4. **`lib/providers/catalog.ts`** — append:
   ```ts
   { provider: "grok", model: "grok-4",      label: "Grok 4",      brandColor: "#000000" },
   { provider: "grok", model: "grok-4-fast", label: "Grok 4 Fast", brandColor: "#000000" },
   ```

5. **`components/provider-logo.tsx`** — add to `PROVIDER_META`:
   ```ts
   grok: { letter: "X", bg: "#000000", fg: "#ffffff", label: "xAI" }
   ```
   The component auto-discovers a `public/logos/grok.{svg,png,jpg,jpeg,webp}` if present; until one is added, the black "X" letter avatar is the fallback.

## Tests

- **`lib/providers/grok.test.ts`** (new) — mirrors `openai.test.ts`: verifies the provider yields text chunks on a happy-path stream and emits an `error` chunk when the SDK throws. Uses the same mocking pattern as the existing OpenAI test.
- **`lib/providers/registry.test.ts`** — extend to cover `"grok"`: returns a provider when `XAI_API_KEY` is set, throws when missing, returns a stub when `DEBATE_USE_STUB_PROVIDERS=true`.

## Non-Goals

- No new SDK dependency.
- No changes to debate engine, persistence, or API routes (provider IDs are opaque strings to those layers).
- No UI changes beyond the logo metadata entry.
- No custom xAI-specific features (reasoning controls, etc.) — those can be added later if needed.

## Deployment

After merge, the Azure App Service (`ai-debate-yutab-qsait`) needs `XAI_API_KEY` added to **Application settings**, then a restart. Without it, selecting a Grok debater will fail at runtime with `missing env var: XAI_API_KEY` — same failure mode as the other providers.
