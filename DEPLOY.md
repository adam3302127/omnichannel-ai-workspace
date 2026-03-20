# Deploy to Railway (24/7 hosting)

## Prerequisites

- [GitHub](https://github.com) account
- [Railway](https://railway.app) account (sign up with GitHub)
- Your `.env` values ready to copy

---

## Step 1: Push to GitHub

If you haven't already, create a repo and push:

```bash
cd omnichannel-ai-workspace
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
git push -u origin main
```

---

## Step 2: Create Railway Project

1. Go to [railway.app](https://railway.app) and log in with GitHub
2. Click **New Project** → **Deploy from GitHub repo**
3. Select your `omnichannel-ai-workspace` repo (or the repo containing it)
4. Railway will auto-detect Node.js and use `npm run build` + `npm start`

---

## Step 3: Add Environment Variables

In Railway: **Project** → **Variables** (or **Service** → **Variables**), add:

| Variable | Value | Required |
|----------|-------|----------|
| `ANTHROPIC_API_KEY` | Your Anthropic API key | Yes |
| `SUPABASE_URL` | Your Supabase project URL | Yes |
| `SUPABASE_SERVICE_KEY` | Supabase service role key | Yes |
| `TELEGRAM_BOT_TOKEN` | From BotFather | Yes |
| `CLAUDE_MODEL` | `claude-haiku-4-5` (or leave default) | No |
| `N8N_BASE_URL` | Your n8n webhook base URL | No |
| `INVENTORY_SHEET_URL` | Published Google Sheet URL | No |
| `ADMIN_TOKEN` | Random secret for `/admin` (e.g. `openssl rand -hex 24`) | **Yes in prod** |
| `NODE_ENV` | `production` | Recommended |
| `WEBHOOK_SECRET` | Optional, for webhook verification | No |

**Important:** Set `ADMIN_TOKEN` in production or admin routes will reject all requests.

---

## Step 4: Generate Public URL

1. In Railway: **Service** → **Settings** → **Networking**
2. Click **Generate Domain** (or **Add Public Domain**)
3. You'll get a URL like `https://omnichannel-ai-workspace-production.up.railway.app`

---

## Step 5: Set Telegram Webhook

Replace `YOUR_RAILWAY_URL` and `YOUR_BOT_TOKEN`:

```bash
curl "https://api.telegram.org/botYOUR_BOT_TOKEN/setWebhook?url=https://YOUR_RAILWAY_URL/webhooks/telegram/default"
```

Example:

```bash
curl "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook?url=https://your-app.up.railway.app/webhooks/telegram/default"
```

You should see `{"ok":true}`.

---

## Step 6: Verify

- **Health:** `https://YOUR_RAILWAY_URL/` → `{"ok":true}`
- **Web chat:** `https://YOUR_RAILWAY_URL/chat`
- **Telegram:** Send a message to your bot

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Build fails | Check Railway build logs. Ensure `npm run build` succeeds locally. |
| 500 on webhook | Check env vars (especially `SUPABASE_*`, `ANTHROPIC_API_KEY`). |
| Admin 401 | Set `ADMIN_TOKEN` and send `x-admin-token: YOUR_TOKEN` header. |
| Bot not replying | Verify webhook URL is correct. Check `getWebhookInfo`: `curl "https://api.telegram.org/botYOUR_TOKEN/getWebhookInfo"` |

---

## Cost

Railway Hobby: ~$5/month minimum. Expect **~$10–25/month** for this app running 24/7. Add Anthropic API usage on top.
