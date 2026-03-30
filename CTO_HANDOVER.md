# CTO handover — Omnichannel AI Workspace (Fresh Bros / white-label bot)

This document is the single place to onboard a new technical owner. It points to the **knowledge base**, **architecture**, **secrets**, and **files that matter**.

---

## 1. What this repo is

- **One Node/TypeScript server** (Hono) that powers a **Claude** assistant.
- **Channels:** Telegram (webhook), **web chat** at `/chat` (browser).
- **Data:** **Supabase (Postgres)** — tenants, users, conversations, messages, client content, **knowledge base**, optional embeddings.
- **Live inventory & videos:** Parsed from a **published Google Sheet** (`INVENTORY_SHEET_URL`), not from a static file.
- **Hosting (production):** Typically **Railway** (see `DEPLOY.md`). **Not Vercel** in the documented setup.
- **Automation:** Optional **n8n** webhooks for CRM/actions (`N8N_BASE_URL`).

---

## 2. Knowledge base (evolving learnings)

| What | Where |
|------|--------|
| **Database table** | `knowledge_base` — `tenant_id`, `topic`, `content`, `source` (`admin` \| `user` \| `conversation`), timestamps |
| **Schema** | `src/db/schema.sql` (full) · `src/db/migrations/001_knowledge_base.sql` (additive migration for existing DBs) |
| **Supabase migrations** | `supabase/migrations/` (if using Supabase CLI; may include embeddings extensions) |
| **Runtime: load & inject** | `src/memory/knowledgeBase.ts` — fetches rows and appends to **system prompt** on every message |
| **Router** | `src/core/router.ts` — calls `getKnowledgeBaseText(tenant.id)` after resolving tenant prompt |
| **Admin UI** | `/admin/knowledge` — list / add / edit / delete (requires `ADMIN_TOKEN` in prod) |
| **Admin JSON API** | `GET/POST /admin/api/tenants/:tenantId/knowledge`, `PUT/DELETE .../knowledge/:id` |
| **User “remember this” in chat** | **Disabled** — only admins manage learnings via admin UI/API |

**Optional (if enabled in your branch):**

- `scripts/backfill-knowledge-embeddings.ts` + `npm run backfill-embeddings` — Gemini embeddings for knowledge
- `src/db/migrations/002_gemini_embeddings.sql` / `supabase/migrations/*gemini*` — vector-related schema
- `docs/OBSIDIAN-INTEGRATION.md` + `npm run sync-obsidian` — sync Obsidian vault into knowledge/client content

---

## 3. Core application files (read these first)

| Area | Files |
|------|--------|
| **Entry & routes** | `src/index.ts` — health, `/chat`, `/api/chat`, Telegram webhook, admin HTML + JSON APIs |
| **Config & env** | `src/config.ts`, `.env.example` (never commit real `.env`) |
| **Message pipeline** | `src/core/router.ts` — intents (quote, menu, media/video, pricing), sheet injection, knowledge base |
| **Claude** | `src/core/ai.ts` |
| **Actions / n8n** | `src/core/actions.ts` |
| **Tenants** | `src/tenants/config.ts` — loads tenant from DB; `PROMPT_HARDENING` appended to system prompt |
| **Memory** | `src/memory/conversations.ts`, `src/memory/clientContent.ts`, `src/memory/knowledgeBase.ts` |
| **Telegram** | `src/channels/telegram.ts`, `src/channels/types.ts` |
| **Inventory / sheet** | `src/inventory/getFreshBrosQuoteContext.ts`, `exactFreshBrosCategoryTable.ts`, `getInventoryMenuSummary.ts`, `syncFreshBrosInventory.ts`, `parseFreshBrosInventory.ts` |
| **Admin layout (shared UI)** | `src/admin/layout.ts` |
| **Rate limit** | `src/utils/rateLimit.ts` |

---

## 4. Database & migrations

| Purpose | Path |
|---------|------|
| Reference schema (SQL editor friendly) | `src/db/schema.sql` |
| Incremental migrations (older style) | `src/db/migrations/*.sql` |
| Supabase CLI migrations | `supabase/migrations/*.sql`, `supabase/seed.sql`, `supabase/config.toml` |
| CLI guide | `SUPABASE-CLI.md` |

---

## 5. Documentation in repo

| Doc | Contents |
|-----|----------|
| `README.md` | Setup, structure, scripts |
| `DEPLOY.md` | Railway, env vars, Telegram webhook, troubleshooting |
| **`API_REFERENCE.md`** | **HTTP API reference** — public endpoints, admin JSON APIs, auth, examples |
| **`SECRETS_AND_KEYS.md`** | **API keys & credentials** — Anthropic, Supabase, Telegram, admin token, optional keys, where to obtain each |
| `SUPABASE-CLI.md` | Local DB, push/pull migrations |
| `docs/OBSIDIAN-INTEGRATION.md` | Optional Obsidian → knowledge/content sync |

---

## 6. Public URLs (typical)

- **Web chat (24/7):** `https://<RAILWAY_PUBLIC_DOMAIN>/chat`
- **Health:** `https://<DOMAIN>/`
- **Admin:** `https://<DOMAIN>/admin` (use `x-admin-token` or `?token=` flow documented in admin pages for prod)
- **Telegram webhook path:** `/webhooks/telegram/<tenantSlug>` (e.g. `default`)

Exact hostname: **Railway → project → Networking / public URL**.

---

## 7. Secrets & API keys (full detail)

See **`SECRETS_AND_KEYS.md`** for every credential, where to get it, and a copy-paste checklist.

Short list: **Anthropic**, **Supabase (service role)**, **Telegram bot token**, **`ADMIN_TOKEN`** (production), optional **n8n**, **sheet URL**, **GEMINI** if embeddings are used.

Hand the CTO (securely):

- [ ] **Anthropic** — `ANTHROPIC_API_KEY`, optional `CLAUDE_MODEL`
- [ ] **Supabase** — project URL + **service role** key (`SUPABASE_SERVICE_KEY`)
- [ ] **Telegram** — `TELEGRAM_BOT_TOKEN`; webhook URL registered to your Railway domain
- [ ] **Railway** — project access, env vars mirror `.env.example`
- [ ] **n8n** — `N8N_BASE_URL` if actions are used
- [ ] **ADMIN_TOKEN** — production admin routes
- [ ] **INVENTORY_SHEET_URL** — published Google Sheet HTML URL
- [ ] **GitHub** — repo access (`omnichannel-ai-workspace` or your fork)

---

## 8. How to run locally

```bash
cd omnichannel-ai-workspace
npm install
cp .env.example .env   # fill in secrets
npm run dev            # http://localhost:3000 — NOT npm dev (use npm run dev)
```

Build & prod-style run:

```bash
npm run build
npm start
```

---

## 9. Deploy

- **Push to `main`** → if Railway is connected, auto-deploy.
- Or **manual redeploy** in Railway dashboard.
- After schema changes: run migrations in Supabase (SQL Editor or `npm run db:push` if linked).

---

## 10. GSD / planning (parent folder)

If this project lives under a larger workspace (e.g. `Claude Code Test`), **GSD** workflows may live under `.claude/commands/gsd/` and `.planning/` — see repo root `CLAUDE.md` / `.cursor/rules` if present. Not required to run the server.

---

## 11. Quick “who owns what”

| Concern | Owner |
|---------|--------|
| App uptime & scaling | Railway (or your host) |
| Database | Supabase |
| LLM billing & limits | Anthropic account |
| Bot identity & webhook | Telegram / BotFather |
| Sheet structure & links | Business / ops (sheet must stay published) |

---

*Generated for CTO handover. Update this file when architecture or env changes.*
