# Supabase CLI Guide

This project uses the [Supabase CLI](https://supabase.com/docs/guides/cli) for migrations, local development, and type generation.

## Prerequisites

- **Docker** — Required for local Supabase (`supabase start`)
- **Node 20+** — For `npx supabase`

## Quick Start

```bash
# 1. Start local Supabase
npm run db:start

# 2. Get connection vars
npx supabase status -o env

# 3. Copy SUPABASE_URL and SERVICE_ROLE_KEY to .env as SUPABASE_URL and SUPABASE_SERVICE_KEY

# 4. Run the app
npm run dev
```

## Commands

| Script | Description |
|--------|-------------|
| `npm run db:start` | Start local Supabase stack (Postgres, Studio, Auth, etc.) |
| `npm run db:stop` | Stop local Supabase |
| `npm run db:status` | Show URLs (Studio, API, DB) and keys |
| `npm run db:reset` | Reset DB, re-apply migrations, run seed.sql |
| `npm run db:push` | Push migrations to linked remote project |
| `npm run db:pull` | Pull remote schema as new migration |
| `npm run db:diff` | Diff local DB vs migrations, save as migration |
| `npm run db:lint` | Lint schema for errors |
| `npm run migration:new <name>` | Create `supabase/migrations/YYYYMMDDHHMMSS_<name>.sql` |
| `npm run migration:list` | List migrations (run after `db:start`; use `--linked` for remote) |
| `npm run types:gen` | Generate TypeScript types from local DB → `src/db/database.types.ts` |

## Project Structure

```
supabase/
├── config.toml      # Local Supabase config (ports, auth, etc.)
├── migrations/      # SQL migrations (timestamped)
├── seed.sql         # Seed data (runs after migrations on db reset)
└── .gitignore
```

## Linking to Remote Project

To push migrations to a hosted Supabase project:

```bash
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npm run db:push
```

Get `YOUR_PROJECT_REF` from the project URL: `https://app.supabase.com/project/abc123` → ref is `abc123`.

## Local Development URLs

When running `supabase start`:

| Service | URL |
|---------|-----|
| API | http://127.0.0.1:54321 |
| Studio | http://127.0.0.1:54323 |
| DB | postgresql://postgres:postgres@127.0.0.1:54322/postgres |
| Inbucket (email) | http://127.0.0.1:54324 |
