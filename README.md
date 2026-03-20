# Omnichannel AI Workspace

A white-label, multi-tenant API that deploys a Claude-powered assistant across **Telegram**, WhatsApp, SMS, Slack, web widget, and email from a single backend. This repo implements the core server with **Telegram** as the first channel.

## What it does

1. Receives messages from connected channels (Telegram first).
2. Loads the tenant's system prompt and the user's conversation history from Postgres.
3. Calls the Claude API (`claude-sonnet-4-5`) to generate a response.
4. Optionally triggers an n8n workflow when Claude returns an action block.
5. Sends the response back on the same channel and stores the exchange in Postgres.

## Tech stack

- **Runtime:** Node.js 20+ with TypeScript (strict)
- **Framework:** Hono
- **Database:** Supabase (Postgres) via `@supabase/supabase-js`
- **AI:** Anthropic SDK, model `claude-sonnet-4-5-20251001`
- **Channels:** Telegram Bot API (webhooks)

## Setup

### 1. Clone and install

```bash
git clone <repo-url>
cd omnichannel-ai-workspace
npm install
```

### 2. Environment

```bash
cp .env.example .env
```

Edit `.env` and set:

- `ANTHROPIC_API_KEY` — Your Anthropic API key
- `SUPABASE_URL` — Supabase project URL
- `SUPABASE_SERVICE_KEY` — Supabase service role key (not anon)
- `TELEGRAM_BOT_TOKEN` — From [BotFather](https://t.me/botfather)
- `N8N_BASE_URL` — e.g. `https://your-instance.app.n8n.cloud/webhook`
- `PORT` — Default `3000`
- `WEBHOOK_SECRET` — Optional; for future webhook verification

### 3. Supabase

**Option A: Supabase CLI (recommended for local dev)**

Requires Docker. Migrations live in `supabase/migrations/`; seeds in `supabase/seed.sql`.

```bash
# Start local Supabase (Studio at http://127.0.0.1:54323, DB on 54322)
npm run db:start

# Get local env vars for .env
npx supabase status -o env
```

Copy the `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (or `SERVICE_ROLE_KEY`) into `.env` as `SUPABASE_URL` and `SUPABASE_SERVICE_KEY`.

**Option B: Hosted Supabase**

1. Create a project at [supabase.com](https://supabase.com).
2. Link locally: `npx supabase link --project-ref YOUR_PROJECT_REF`
3. Push migrations: `npm run db:push`
4. Or manually: Run `src/db/schema.sql` and `src/db/migrations/*.sql` in the SQL Editor.

### 4. Telegram bot

1. Open [@BotFather](https://t.me/botfather) on Telegram.
2. Create a new bot with `/newbot` and follow the prompts.
3. Copy the bot token into `.env` as `TELEGRAM_BOT_TOKEN`.

### 5. Run locally

```bash
npm run dev
```

The server listens on `PORT` (default 3000).

### 6. Expose with a tunnel

Telegram needs a public HTTPS URL for webhooks. For local testing:

```bash
npx localtunnel --port 3000
```

Use the generated URL (e.g. `https://something.loca.lt`) in the next step.

### 7. Register the webhook

Replace `<TOKEN>` with your bot token and `https://your-tunnel-url` with your tunnel URL (no trailing slash):

```bash
curl -X POST "https://api.telegram.org/bot<TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://your-tunnel-url/webhooks/telegram/default"}'
```

For the seed tenant, the slug is `default`, so the path is `/webhooks/telegram/default`.

### 8. Test

Send a message to your bot on Telegram. It should reply using Claude and the default tenant system prompt.

## Project structure

```
src/
├── index.ts              # Hono app, route registration
├── config.ts             # Env validation
├── channels/
│   ├── telegram.ts       # Telegram webhook + send
│   └── types.ts          # IncomingMessage, OutgoingMessage
├── core/
│   ├── router.ts         # Route message → AI → response
│   ├── ai.ts             # Claude API call
│   └── actions.ts        # Parse <action> blocks, call n8n
├── memory/
│   └── conversations.ts  # Supabase conversation history
├── tenants/
│   └── config.ts         # Tenant config (system prompt, etc.)
└── db/
    └── schema.sql        # Postgres schema for Supabase
```

## Scripts

- `npm run dev` — Start with tsx watch
- `npm run build` — Compile TypeScript to `dist/`
- `npm start` — Run compiled `dist/index.js`
- `npm run lint` — ESLint
- `npm run format` — Prettier

**Supabase CLI:**

- `npm run db:start` — Start local Supabase (Docker)
- `npm run db:stop` — Stop local Supabase
- `npm run db:status` — Show local URLs and keys
- `npm run db:reset` — Reset DB, re-run migrations and seeds
- `npm run db:push` — Push migrations to linked remote project
- `npm run db:pull` — Pull remote schema as migration
- `npm run db:diff` — Diff schema, save as new migration
- `npm run migration:new <name>` — Create new migration file
- `npm run types:gen` — Generate TypeScript types from local DB
- `npm run sync-obsidian` — Sync Obsidian vault to knowledge base & client content (see [docs/OBSIDIAN-INTEGRATION.md](docs/OBSIDIAN-INTEGRATION.md))
- `npm run backfill-embeddings` — Backfill Gemini embeddings for knowledge base

## License

ISC
