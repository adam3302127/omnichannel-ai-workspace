# Obsidian Integration

Use your [Obsidian](https://obsidian.md) vault as a knowledge source for the omnichannel AI assistant. Notes sync into the **knowledge base** (RAG) and **client content** (menu, hours, FAQ, pricing).

## Quick Start

1. **Apply the migration** (adds `obsidian` source to `knowledge_base`):
   ```bash
   npm run db:push
   # or run supabase/migrations/20260320160000_obsidian_source.sql manually
   ```

2. **Configure `.env`**:
   ```env
   OBSIDIAN_VAULT_PATH=/path/to/your/vault
   OBSIDIAN_TENANT_SLUG=default
   OBSIDIAN_KNOWLEDGE_FOLDER=AI Knowledge
   OBSIDIAN_CONTENT_FOLDER=Business
   ```

3. **Create folders in your vault** (or use vault root):
   - `AI Knowledge/` — Notes that feed the RAG knowledge base
   - `Business/` — `menu.md`, `faq.md`, `hours.md`, `pricing.md` for client content

4. **Run sync**:
   ```bash
   npm run sync-obsidian
   ```

## Knowledge Base (RAG)

All `.md` files in `OBSIDIAN_KNOWLEDGE_FOLDER` (default: `AI Knowledge`) are synced to the knowledge base. The AI uses them for semantic search when answering questions.

### Note format

- **Topic**: From frontmatter `topic` or `key`, or derived from filename (e.g. `Shipping Policy.md` → topic `shipping policy`)
- **Content**: Markdown body (frontmatter stripped)

Example:

```md
---
topic: shipping
---

We ship nationwide. Minimum order: 1 lb. Free shipping over $500.
```

### Sync behavior

- Replaces all existing `source='obsidian'` entries for the tenant
- If `GEMINI_API_KEY` is set, embeddings are generated for RAG
- Run `npm run sync-obsidian` after editing notes

## Client Content

Files in `OBSIDIAN_CONTENT_FOLDER` (default: `Business`) map to client content keys:

| File        | Key     |
|-------------|---------|
| menu.md     | menu    |
| faq.md      | faq     |
| hours.md    | hours   |
| pricing.md  | pricing |

These power the bot’s menu, FAQ, hours, and pricing replies (see [router](../src/core/router.ts)).

## Script options

```bash
npm run sync-obsidian                    # Full sync
npm run sync-obsidian -- --dry-run       # Preview only
npm run sync-obsidian -- --knowledge-only
npm run sync-obsidian -- --content-only
```

## Optional: Scheduled sync

Use cron or a scheduler to keep the vault in sync:

```bash
# Every hour
0 * * * * cd /path/to/omnichannel-ai-workspace && npm run sync-obsidian
```

Or use [Obsidian Sync](https://obsidian.md/sync) / cloud storage and trigger sync on file change (e.g. via a watcher or n8n).

## Troubleshooting

- **"Tenant slug not found"** — Set `OBSIDIAN_TENANT_SLUG` to an existing tenant (e.g. `default`).
- **No embeddings** — Set `GEMINI_API_KEY` for semantic RAG.
- **Folder not found** — If `AI Knowledge` or `Business` don’t exist, the script uses the vault root.
