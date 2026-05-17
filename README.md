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
