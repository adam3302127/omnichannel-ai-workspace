import "dotenv/config";
import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { createClient } from "@supabase/supabase-js";
import { config } from "./config";
import { checkRateLimit } from "./utils/rateLimit";
import { routeIncomingMessage } from "./core/router";
import {
  parseTelegramUpdate,
  sendTelegramMessage,
  type TelegramUpdate,
} from "./channels/telegram";
import type { IncomingMessage } from "./channels/types";
import {
  previewFreshBrosInventory,
  syncFreshBrosInventoryForTenant,
  InventorySyncError,
} from "./inventory/syncFreshBrosInventory";
import { getInventoryMenuSummary } from "./inventory/getInventoryMenuSummary";
import {
  ADMIN_STYLES,
  adminNav,
  tenantSelector,
  ADMIN_FETCH_SCRIPT,
} from "./admin/layout";

const app = new Hono();

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
function escapeJs(s: string): string {
  return String(s)
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r");
}

// Admin Supabase client (service role)
const adminSupabase = createClient(config.supabase.url, config.supabase.serviceKey);

// Extremely simple admin auth: allow all in dev, header token in other envs
function isAdminRequest(c: any): boolean {
  if (config.server.nodeEnv === "development") return true;
  const token = c.req.header("x-admin-token");
  const expected = process.env.ADMIN_TOKEN;
  if (!expected) return false;
  return token === expected;
}

// Health check
app.get("/", (c) => c.json({ ok: true, service: "omnichannel-ai-workspace" }));

app.get("/health", (c) => c.json({ status: "ok" }));

/**
 * Telegram webhook: POST /webhooks/telegram/:tenantSlug
 * Body: Telegram Update object
 */
app.post("/webhooks/telegram/:tenantSlug", async (c) => {
  const tenantSlug = c.req.param("tenantSlug");
  console.log("[Telegram] Webhook received for tenant:", tenantSlug);
  if (!tenantSlug) {
    return c.json({ error: "Missing tenant slug" }, 400);
  }

  let body: TelegramUpdate;
  try {
    body = (await c.req.json()) as TelegramUpdate;
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const incoming = parseTelegramUpdate(tenantSlug, body);
  if (!incoming) {
    console.log("[Telegram] Ignored (no text or not a message)");
    return c.json({ ok: true });
  }

  const rlKey = `${tenantSlug}|telegram|${incoming.userId}`;
  const rl = checkRateLimit(rlKey);
  if (!rl.ok) {
    return c.json(
      { error: "Too many requests", retryAfterSec: rl.retryAfterSec },
      429
    );
  }

  console.log("[Telegram] Message from", incoming.userId, ":", incoming.text.slice(0, 50));

  try {
    const result = await routeIncomingMessage(incoming);
    await sendTelegramMessage(result.outgoing);
    console.log("[Telegram] Reply sent, status:", result.status);
    return c.json({ ok: true, status: result.status });
  } catch (err) {
    console.error("[Telegram] Error:", err instanceof Error ? err.message : err);
    await sendTelegramMessage({
      channel: "telegram",
      channelThreadId: incoming.channelThreadId,
      text: "Something went wrong on our side. Please try again in a moment.",
    }).catch(() => {});
    return c.json({ ok: false, error: "handler failed" }, 500);
  }
});

// Simple web chat UI
app.get("/chat", (c) =>
  c.html(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Omnichannel AI Workspace – Web Chat</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      body { font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 0; background: #020617; color: #e5e7eb; display: flex; flex-direction: column; height: 100vh; }
      header { padding: 12px 16px; border-bottom: 1px solid #1f2937; display: flex; justify-content: space-between; align-items: center; }
      header h1 { font-size: 16px; margin: 0; }
      main { flex: 1; display: flex; justify-content: center; padding: 16px; }
      .chat { width: 100%; max-width: 640px; border-radius: 12px; border: 1px solid #1f2937; background: #020617; display: flex; flex-direction: column; overflow: hidden; }
      .messages { flex: 1; padding: 12px; overflow-y: auto; display: flex; flex-direction: column; gap: 8px; }
      .bubble { max-width: 80%; padding: 8px 10px; border-radius: 10px; font-size: 14px; line-height: 1.4; white-space: pre-wrap; }
      .bubble.user { margin-left: auto; background: #2563eb; color: #f9fafb; border-bottom-right-radius: 2px; }
      .bubble.bot { margin-right: auto; background: #0b1120; border: 1px solid #1e293b; border-bottom-left-radius: 2px; }
      form { display: flex; gap: 8px; padding: 10px; border-top: 1px solid #1f2937; background: #020617; }
      input[type="text"] { flex: 1; padding: 8px 10px; border-radius: 999px; border: 1px solid #1f2937; background: #020617; color: #e5e7eb; outline: none; }
      input[type="text"]:focus { border-color: #2563eb; }
      button { padding: 8px 14px; border-radius: 999px; border: none; background: #2563eb; color: #f9fafb; font-weight: 500; cursor: pointer; }
      button:disabled { opacity: 0.5; cursor: default; }
      .status { font-size: 11px; color: #6b7280; padding: 0 12px 6px; }
    </style>
  </head>
  <body>
    <header>
      <h1>Omnichannel AI Workspace – Web Chat</h1>
      <span style="font-size: 12px; color: #6b7280;">Channel: web • Tenant: default</span>
    </header>
    <main>
      <section class="chat">
        <div id="messages" class="messages"></div>
        <div class="status" id="status"></div>
        <form id="chat-form" action="javascript:void(0)">
          <input id="input" type="text" autocomplete="off" placeholder="Ask me anything about your business..." />
          <button type="submit">Send</button>
        </form>
      </section>
    </main>
    <script>
      const form = document.getElementById("chat-form");
      const input = document.getElementById("input");
      const messages = document.getElementById("messages");
      const statusEl = document.getElementById("status");

      function linkify(text) {
        if (text == null || text === "") return "";
        return String(text)
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/(https?:\\/\\/[^\\s]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');
      }
      function addMessage(text, role) {
        const div = document.createElement("div");
        div.className = "bubble " + role;
        if (role === "bot") {
          div.innerHTML = linkify(text || "");
          div.querySelectorAll("a").forEach(function(a) { a.style.color = "#60a5fa"; });
        } else {
          div.textContent = text || "";
        }
        messages.appendChild(div);
        messages.scrollTop = messages.scrollHeight;
      }

      let sessionId = localStorage.getItem("chat_session_id");
      if (!sessionId) {
        sessionId = "s-" + Math.random().toString(36).slice(2) + "-" + Date.now().toString(36);
        localStorage.setItem("chat_session_id", sessionId);
      }
      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const text = input.value.trim();
        if (!text) return;
        addMessage(text, "user");
        input.value = "";
        input.focus();
        form.querySelector("button").disabled = true;
        statusEl.textContent = "Thinking...";
        try {
          const res = await fetch("/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message: text, tenantSlug: "default", sessionId: sessionId })
          });
          const data = await res.json();
          if (res.status === 429) {
            addMessage("You're sending messages a bit too fast. Please wait a moment and try again.", "bot");
          } else if (data.reply) {
            addMessage(data.reply, "bot");
          } else {
            addMessage("Sorry, I couldn't generate a response.", "bot");
          }
        } catch (err) {
          console.error(err);
          addMessage("Error talking to the server.", "bot");
        } finally {
          form.querySelector("button").disabled = false;
          statusEl.textContent = "";
        }
      });
    </script>
  </body>
</html>`)
);

// Web chat API endpoint reusing the same router logic
app.post("/api/chat", async (c) => {
  type Body = { message?: string; tenantSlug?: string; sessionId?: string };
  const body = (await c.req.json()) as Body;
  const text = body.message?.trim();
  const tenantSlug = body.tenantSlug || "default";
  const sessionId = body.sessionId?.trim() || "web-default";
  const ip = c.req.header("x-forwarded-for")?.split(",")[0]?.trim() || c.req.header("x-real-ip") || null;

  if (!text) {
    return c.json({ error: "Missing message" }, 400);
  }

  const rlKey = `${tenantSlug}|web|${ip || sessionId}`;
  const rl = checkRateLimit(rlKey);
  if (!rl.ok) {
    return c.json(
      { error: "Too many requests. Please slow down.", retryAfterSec: rl.retryAfterSec },
      429
    );
  }

  const incoming: IncomingMessage = {
    tenantSlug,
    channel: "web",
    channelThreadId: `web-${sessionId}`,
    isGroup: false,
    userId: sessionId,
    displayName: ip ? `Web (${ip})` : "Web User",
    text,
    raw: ip ? { ip } : undefined,
  };

  try {
    const result = await routeIncomingMessage(incoming);
    return c.json({ reply: result.outgoing.text, status: result.status });
  } catch (err) {
    console.error("[Web] Error:", err instanceof Error ? err.message : err);
    return c.json({ error: "Internal error" }, 500);
  }
});

// --- Admin JSON APIs ---

// List tenants (optional ?slug=)
app.get("/admin/api/tenants", async (c) => {
  if (!isAdminRequest(c)) return c.json({ error: "unauthorized" }, 401);
  const slug = c.req.query("slug");
  let query = adminSupabase
    .from("tenants")
    .select("id,name,slug,plan,allowed_channels,allowed_actions,created_at")
    .order("created_at", { ascending: true });
  if (slug) {
    query = query.eq("slug", slug);
  }
  const { data, error } = await query;
  if (error) return c.json({ error: error.message }, 500);
  const items =
    data?.map((t) => ({
      id: t.id,
      name: t.name,
      slug: t.slug,
      plan: t.plan,
      allowedChannels: t.allowed_channels ?? [],
      allowedActions: t.allowed_actions ?? [],
      createdAt: t.created_at,
    })) ?? [];
  return c.json({ items, total: items.length });
});

// Get single tenant
app.get("/admin/api/tenants/:id", async (c) => {
  if (!isAdminRequest(c)) return c.json({ error: "unauthorized" }, 401);
  const id = c.req.param("id");
  const { data, error } = await adminSupabase
    .from("tenants")
    .select("id,name,slug,plan,system_prompt,allowed_channels,allowed_actions,created_at")
    .eq("id", id)
    .single();
  if (error || !data) return c.json({ error: error?.message ?? "not found" }, 404);
  return c.json({
    id: data.id,
    name: data.name,
    slug: data.slug,
    plan: data.plan,
    systemPrompt: data.system_prompt,
    allowedChannels: data.allowed_channels ?? [],
    allowedActions: data.allowed_actions ?? [],
    createdAt: data.created_at,
  });
});

// Update tenant
app.put("/admin/api/tenants/:id", async (c) => {
  if (!isAdminRequest(c)) return c.json({ error: "unauthorized" }, 401);
  const id = c.req.param("id");
  type Body = {
    name?: string;
    slug?: string;
    plan?: string;
    systemPrompt?: string;
    allowedChannels?: string[];
    allowedActions?: string[];
  };
  const body = (await c.req.json()) as Body;
  const update: Record<string, unknown> = {};
  if (body.name !== undefined) update.name = body.name;
  if (body.slug !== undefined) update.slug = body.slug;
  if (body.plan !== undefined) update.plan = body.plan;
  if (body.systemPrompt !== undefined) update.system_prompt = body.systemPrompt;
  if (body.allowedChannels !== undefined) update.allowed_channels = body.allowedChannels;
  if (body.allowedActions !== undefined) update.allowed_actions = body.allowedActions;

  const { error } = await adminSupabase.from("tenants").update(update).eq("id", id);
  if (error) return c.json({ error: error.message }, 500);
  return c.json({ ok: true });
});

// List client content for tenant
app.get("/admin/api/tenants/:tenantId/content", async (c) => {
  if (!isAdminRequest(c)) return c.json({ error: "unauthorized" }, 401);
  const tenantId = c.req.param("tenantId");
  const { data, error } = await adminSupabase
    .from("client_content")
    .select("id,key,title,content,updated_at")
    .eq("tenant_id", tenantId)
    .order("key", { ascending: true });
  if (error) return c.json({ error: error.message }, 500);
  const items =
    data?.map((r) => ({
      id: r.id,
      key: r.key,
      title: r.title,
      content: r.content,
      updatedAt: r.updated_at,
    })) ?? [];
  return c.json({ items });
});

// Get single content record
app.get("/admin/api/tenants/:tenantId/content/:key", async (c) => {
  if (!isAdminRequest(c)) return c.json({ error: "unauthorized" }, 401);
  const tenantId = c.req.param("tenantId");
  const key = c.req.param("key");
  const { data, error } = await adminSupabase
    .from("client_content")
    .select("id,key,title,content,updated_at")
    .eq("tenant_id", tenantId)
    .eq("key", key)
    .single();
  if (error || !data) return c.json({ error: error?.message ?? "not found" }, 404);
  return c.json({
    id: data.id,
    key: data.key,
    title: data.title,
    content: data.content,
    updatedAt: data.updated_at,
  });
});

// Update content record (or 404 if missing)
app.put("/admin/api/tenants/:tenantId/content/:key", async (c) => {
  if (!isAdminRequest(c)) return c.json({ error: "unauthorized" }, 401);
  const tenantId = c.req.param("tenantId");
  const key = c.req.param("key");
  type Body = { title?: string; content?: string };
  const body = (await c.req.json()) as Body;
  const update: Record<string, unknown> = {};
  if (body.title !== undefined) update.title = body.title;
  if (body.content !== undefined) update.content = body.content;
  const { data, error } = await adminSupabase
    .from("client_content")
    .update(update)
    .eq("tenant_id", tenantId)
    .eq("key", key)
    .select("id")
    .single();
  if (error || !data) return c.json({ error: error?.message ?? "not found" }, 404);
  return c.json({ ok: true });
});

// --- Knowledge base (evolving learnings) ---
app.get("/admin/api/tenants/:tenantId/knowledge", async (c) => {
  if (!isAdminRequest(c)) return c.json({ error: "unauthorized" }, 401);
  const tenantId = c.req.param("tenantId");
  const { data, error } = await adminSupabase
    .from("knowledge_base")
    .select("id,topic,content,source,created_at,updated_at")
    .eq("tenant_id", tenantId)
    .order("updated_at", { ascending: false });
  if (error) return c.json({ error: error.message }, 500);
  const items =
    data?.map((r) => ({
      id: r.id,
      topic: r.topic,
      content: r.content,
      source: r.source,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    })) ?? [];
  return c.json({ items });
});

app.post("/admin/api/tenants/:tenantId/knowledge", async (c) => {
  if (!isAdminRequest(c)) return c.json({ error: "unauthorized" }, 401);
  const tenantId = c.req.param("tenantId");
  type Body = { topic: string; content: string; source?: string };
  const body = (await c.req.json()) as Body;
  if (!body.topic?.trim() || !body.content?.trim()) {
    return c.json({ error: "topic and content required" }, 400);
  }
  const { data, error } = await adminSupabase
    .from("knowledge_base")
    .insert({
      tenant_id: tenantId,
      topic: body.topic.trim(),
      content: body.content.trim(),
      source: body.source ?? "admin",
    })
    .select("id,topic,content,source,created_at,updated_at")
    .single();
  if (error) return c.json({ error: error.message }, 500);
  return c.json({
    id: data.id,
    topic: data.topic,
    content: data.content,
    source: data.source,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  });
});

app.put("/admin/api/tenants/:tenantId/knowledge/:id", async (c) => {
  if (!isAdminRequest(c)) return c.json({ error: "unauthorized" }, 401);
  const tenantId = c.req.param("tenantId");
  const id = c.req.param("id");
  type Body = { topic?: string; content?: string };
  const body = (await c.req.json()) as Body;
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.topic !== undefined) update.topic = body.topic.trim();
  if (body.content !== undefined) update.content = body.content.trim();
  const { data, error } = await adminSupabase
    .from("knowledge_base")
    .update(update)
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .select("id")
    .single();
  if (error || !data) return c.json({ error: error?.message ?? "not found" }, 404);
  return c.json({ ok: true });
});

app.delete("/admin/api/tenants/:tenantId/knowledge/:id", async (c) => {
  if (!isAdminRequest(c)) return c.json({ error: "unauthorized" }, 401);
  const tenantId = c.req.param("tenantId");
  const id = c.req.param("id");
  const { error } = await adminSupabase
    .from("knowledge_base")
    .delete()
    .eq("id", id)
    .eq("tenant_id", tenantId);
  if (error) return c.json({ error: error.message }, 500);
  return c.json({ ok: true });
});

// Preview inventory parsing (no DB writes)
app.get("/admin/api/sync/inventory/preview", async (c) => {
  if (!isAdminRequest(c)) return c.json({ error: "unauthorized" }, 401);
  try {
    const { report, itemsSample } = await previewFreshBrosInventory();
    return c.json({ report, itemsSample });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ error: message }, 500);
  }
});

// Sync inventory into Postgres for a tenant (DB writes)
app.post("/admin/api/sync/inventory", async (c) => {
  if (!isAdminRequest(c)) return c.json({ error: "unauthorized" }, 401);
  const body = (await c.req.json().catch(() => ({}))) as { tenantSlug?: string };
  const tenantSlug = body.tenantSlug || c.req.query("tenantSlug") || "default";

  try {
    const { data: tenant, error: tenantErr } = await adminSupabase
      .from("tenants")
      .select("id")
      .eq("slug", tenantSlug)
      .single();
    if (tenantErr || !tenant) {
      return c.json({ error: tenantErr?.message ?? "tenant not found" }, 404);
    }

    const { inserted, categories } = await syncFreshBrosInventoryForTenant(tenant.id);
    return c.json({ ok: true, inserted, categories, tenantSlug });
  } catch (err) {
    const message =
      err instanceof InventorySyncError
        ? err.message
        : err instanceof Error
          ? err.message
          : String(err);
    return c.json({ error: message }, 500);
  }
});

// Read current inventory snapshot from DB (no parsing)
app.get("/admin/api/inventory/menu-summary", async (c) => {
  if (!isAdminRequest(c)) return c.json({ error: "unauthorized" }, 401);
  const body = c.req.query("tenantSlug");
  const tenantSlug = typeof body === "string" && body ? body : "default";
  try {
    const { data: tenant, error: tenantErr } = await adminSupabase
      .from("tenants")
      .select("id")
      .eq("slug", tenantSlug)
      .single();
    if (tenantErr || !tenant) {
      return c.json({ error: tenantErr?.message ?? "tenant not found" }, 404);
    }
    const inv = await getInventoryMenuSummary(tenant.id);
    return c.json(inv);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ error: message }, 500);
  }
});

// List all conversations (chats) with user info and message count
app.get("/admin/api/conversations", async (c) => {
  if (!isAdminRequest(c)) return c.json({ error: "unauthorized" }, 401);
  const tenantSlug = (c.req.query("tenantSlug") as string) || "default";
  const limit = Math.min(parseInt((c.req.query("limit") as string) || "50", 10) || 50, 200);

  const { data: tenant, error: te } = await adminSupabase
    .from("tenants")
    .select("id")
    .eq("slug", tenantSlug)
    .single();
  if (te || !tenant) return c.json({ error: "tenant not found" }, 404);

  const { data: convos, error: ce } = await adminSupabase
    .from("conversations")
    .select("id,user_id,channel,channel_thread_id,is_group,last_active_at")
    .eq("tenant_id", tenant.id)
    .order("last_active_at", { ascending: false })
    .limit(limit);
  if (ce) return c.json({ error: ce.message }, 500);

  const convList = convos ?? [];
  const userIds = [...new Set(convList.map((c) => c.user_id))];
  let userMap = new Map<string, { display_name?: string; channel_identifiers?: object; metadata?: object }>();
  if (userIds.length > 0) {
    const { data: users } = await adminSupabase
      .from("users")
      .select("id,display_name,channel_identifiers,metadata,created_at")
      .in("id", userIds);
    userMap = new Map((users ?? []).map((u) => [u.id, u]));
  }

  const convIds = convList.map((c) => c.id);
  let countMap = new Map<string, number>();
  if (convIds.length > 0) {
    const { data: msgCounts } = await adminSupabase
      .from("messages")
      .select("conversation_id")
      .in("conversation_id", convIds);
    for (const m of msgCounts ?? []) {
      countMap.set(m.conversation_id, (countMap.get(m.conversation_id) ?? 0) + 1);
    }
  }
  const items = convList.map((conv) => {
    const u = userMap.get(conv.user_id);
    return {
      id: conv.id,
      channel: conv.channel,
      channelThreadId: conv.channel_thread_id,
      displayName: u?.display_name ?? "—",
      channelIdentifiers: u?.channel_identifiers ?? {},
      metadata: u?.metadata ?? {},
      lastActiveAt: conv.last_active_at,
      messageCount: Math.floor((countMap.get(conv.id) ?? 0) / 2),
    };
  });

  return c.json({ items, total: items.length });
});

// Get full message history for a conversation
app.get("/admin/api/conversations/:id/messages", async (c) => {
  if (!isAdminRequest(c)) return c.json({ error: "unauthorized" }, 401);
  const id = c.req.param("id");

  const { data: msgs, error } = await adminSupabase
    .from("messages")
    .select("id,role,content,action_triggered,created_at")
    .eq("conversation_id", id)
    .order("created_at", { ascending: true });

  if (error) return c.json({ error: error.message }, 500);
  return c.json({ messages: msgs ?? [] });
});

// Debug: list inventory items for a category
app.get("/admin/api/inventory/items", async (c) => {
  if (!isAdminRequest(c)) return c.json({ error: "unauthorized" }, 401);

  const tenantSlug = (c.req.query("tenantSlug") as string) || "default";
  const category = (c.req.query("category") as string) || "";
  const limit = Math.min(
    parseInt((c.req.query("limit") as string) || "25", 10) || 25,
    100
  );

  if (!category) return c.json({ error: "Missing category" }, 400);

  const { data: tenant, error: tenantErr } = await adminSupabase
    .from("tenants")
    .select("id")
    .eq("slug", tenantSlug)
    .single();
  if (tenantErr || !tenant) {
    return c.json({ error: tenantErr?.message ?? "tenant not found" }, 404);
  }

  const { data, error } = await adminSupabase
    .from("inventory_items")
    .select("category,name,unit,unit_price,unit_price_text,updated_at")
    .eq("tenant_id", tenant.id)
    .eq("category", category)
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (error) return c.json({ error: error.message }, 500);
  return c.json({ items: data ?? [] });
});

// Chats / conversations overview page
app.get("/admin/chats", async (c) => {
  if (!isAdminRequest(c)) {
    return c.html("<h1>Unauthorized</h1><p>Missing or invalid admin token.</p>", 401);
  }
  const tenantSlug = (c.req.query("tenantSlug") as string) || "default";
  const { data: tenants } = await adminSupabase
    .from("tenants")
    .select("id,name,slug")
    .order("created_at", { ascending: true });
  const tenantList = tenants ?? [];
  const tenantSel = tenantSelector(
    tenantList.map((t) => ({ id: t.id, name: t.name, slug: t.slug })),
    tenantSlug,
    "/admin/chats"
  );
  return c.html(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Chats – Omnichannel Admin</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>${ADMIN_STYLES}
      .conv-row { cursor: pointer; }
      .msg-preview { max-width: 280px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #94a3b8; font-size: 12px; }
      .detail { margin-top: 16px; padding: 16px; background: #1e293b; border-radius: 8px; display: none; }
      .detail.visible { display: block; }
      .msg { margin: 8px 0; padding: 8px 12px; border-radius: 6px; font-size: 13px; }
      .msg.user { background: #1e3a5f; margin-left: 0; margin-right: 24px; }
      .msg.assistant { background: #334155; margin-left: 24px; margin-right: 0; }
    </style>
    <script>${ADMIN_FETCH_SCRIPT}</script>
  </head>
  <body>
    <header>
      <h1>Chats & History</h1>
      ${adminNav("chats")}
      <span style="margin-left:auto;">${tenantSel}</span>
    </header>
    <main>
      <div id="loading">Loading conversations…</div>
      <table id="table" style="display: none;">
        <thead>
          <tr><th>Channel</th><th>User / Thread</th><th>Messages</th><th>Last active</th></tr>
        </thead>
        <tbody id="tbody"></tbody>
      </table>
      <div id="detail" class="detail">
        <h3 style="margin-top:0;">Conversation <span id="detail-id"></span></h3>
        <div id="messages"></div>
      </div>
    </main>
    <script>
      const tenantSlug = "${tenantSlug}";
      const fetchFn = window.adminFetch || fetch;
      fetchFn("/admin/api/conversations?tenantSlug=" + encodeURIComponent(tenantSlug))
        .then(r => r.text().then(t => { try { return { ok: r.ok, data: JSON.parse(t) }; } catch { return { ok: r.ok, data: { error: t.slice(0,200) } }; }))
        .then(({ ok, data }) => {
          document.getElementById("loading").style.display = "none";
          if (!ok || data.error) {
            document.getElementById("loading").style.display = "block";
            document.getElementById("loading").innerHTML = "Error: " + (data.error || "Request failed") + " <br/><small>Open DevTools (F12) → Console for details</small>";
            return;
          }
          document.getElementById("table").style.display = "table";
          const tbody = document.getElementById("tbody");
          (data.items || []).forEach(c => {
            const tr = document.createElement("tr");
            tr.className = "conv-row";
            const ip = (c.metadata && c.metadata.last_ip) ? " <span class=\"meta\">IP: " + c.metadata.last_ip + "</span>" : "";
            tr.innerHTML = "<td>" + c.channel + "</td><td>" + (c.displayName || "—") + ip + " <span class=\"meta\">" + c.channelThreadId + "</span></td><td>" + c.messageCount + "</td><td>" + new Date(c.lastActiveAt).toLocaleString() + "</td>";
            tr.onclick = () => loadMessages(c.id, c.channelThreadId);
            tbody.appendChild(tr);
          });
        })
        .catch(e => { document.getElementById("loading").textContent = "Error: " + e.message + " — Check console (F12)"; });

      function loadMessages(convId, threadId) {
        document.getElementById("detail").classList.add("visible");
        document.getElementById("detail-id").textContent = threadId;
        fetchFn("/admin/api/conversations/" + convId + "/messages")
          .then(r => r.json())
          .then(data => {
            const div = document.getElementById("messages");
            div.innerHTML = "";
            (data.messages || []).forEach(m => {
              const p = document.createElement("div");
              p.className = "msg " + m.role;
              p.innerHTML = "<span class=\"meta\">" + m.role + " · " + new Date(m.created_at).toLocaleString() + "</span><br/>" + m.content.replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\\n/g, "<br/>");
              div.appendChild(p);
            });
          });
      }
    </script>
  </body>
</html>`);
});

// --- Admin HTML pages ---

// Main dashboard
app.get("/admin", async (c) => {
  if (!isAdminRequest(c)) {
    return c.html("<h1>Unauthorized</h1><p>Missing or invalid admin token.</p>", 401);
  }
  const { data, error } = await adminSupabase
    .from("tenants")
    .select("id,name,slug,plan,allowed_channels,allowed_actions,created_at")
    .order("created_at", { ascending: true });
  if (error) {
    return c.html(`<h1>Admin</h1><p>Error: ${error.message}</p>`, 500);
  }
  const tenants = data ?? [];
  const rows = tenants
    .map(
      (t) =>
        `<tr><td>${t.name}</td><td>${t.slug}</td><td>${t.plan}</td><td>${
          (t.allowed_channels ?? []).join(", ")
        }</td><td>${(t.allowed_actions ?? []).join(", ")}</td></tr>`
    )
    .join("");
  return c.html(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Omnichannel Admin</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>${ADMIN_STYLES}</style>
    <script>${ADMIN_FETCH_SCRIPT}</script>
  </head>
  <body>
    <header>
      <h1>Omnichannel Admin</h1>
      ${adminNav("dashboard")}
    </header>
    <main>
      <div class="card">
        <h2>Quick links</h2>
        <p>
          <a href="/admin/chats">Chats & history</a> ·
          <a href="/admin/knowledge">Knowledge base</a> ·
          <a href="/admin/content">Client content</a>
        </p>
      </div>
      <div class="card">
        <h2>Tenants</h2>
        <table>
          <thead><tr><th>Name</th><th>Slug</th><th>Plan</th><th>Channels</th><th>Actions</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      <div class="card">
        <h2>APIs</h2>
        <p class="muted">JSON APIs under <code>/admin/api</code>. Use <code>x-admin-token</code> header in production.</p>
      </div>
    </main>
  </body>
</html>`);
});

// Knowledge base management
app.get("/admin/knowledge", async (c) => {
  if (!isAdminRequest(c)) {
    return c.html("<h1>Unauthorized</h1><p>Missing or invalid admin token.</p>", 401);
  }
  const tenantSlug = (c.req.query("tenantSlug") as string) || "default";
  const { data: tenants } = await adminSupabase
    .from("tenants")
    .select("id,name,slug")
    .order("created_at", { ascending: true });
  const tenantList = tenants ?? [];
  const tenant = tenantList.find((t) => t.slug === tenantSlug) ?? tenantList[0];
  if (!tenant) {
    return c.html(`<h1>Admin</h1><p>No tenants found.</p>`, 500);
  }
  const { data: items } = await adminSupabase
    .from("knowledge_base")
    .select("id,topic,content,source,created_at,updated_at")
    .eq("tenant_id", tenant.id)
    .order("updated_at", { ascending: false });
  const learnings = items ?? [];
  const learningsJson = JSON.stringify(learnings.map((k) => ({ id: k.id, topic: k.topic, content: k.content }))).replace(
    /<\/script>/gi,
    "<\\/script>"
  );
  const rows = learnings
    .map(
      (k) =>
        `<tr data-id="${k.id}">
          <td><strong>${escapeHtml(k.topic)}</strong></td>
          <td>${escapeHtml(k.content.slice(0, 80))}${k.content.length > 80 ? "…" : ""}</td>
          <td><span class="badge">${k.source}</span></td>
          <td class="muted">${new Date(k.updated_at).toLocaleDateString()}</td>
          <td>
            <button class="btn btn-ghost btn-sm" onclick="editLearning('${k.id}')">Edit</button>
            <button class="btn btn-ghost btn-sm" onclick="deleteLearning('${k.id}')">Delete</button>
          </td>
        </tr>`
    )
    .join("");
  const tenantSel = tenantSelector(
    tenantList.map((t) => ({ id: t.id, name: t.name, slug: t.slug })),
    tenantSlug,
    "/admin/knowledge"
  );
  return c.html(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Knowledge Base – Admin</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>${ADMIN_STYLES}</style>
    <script>${ADMIN_FETCH_SCRIPT}</script>
  </head>
  <body>
    <header>
      <h1>Knowledge Base</h1>
      ${adminNav("knowledge")}
      <span style="margin-left:auto;">${tenantSel}</span>
    </header>
    <main>
      <div class="card">
        <h2>Add learning</h2>
        <form id="addForm" onsubmit="return addLearning(event)">
          <div class="form-row">
            <div class="form-group">
              <label>Topic</label>
              <input type="text" id="newTopic" placeholder="e.g. deps, shipping, min order" required />
            </div>
            <div class="form-group" style="flex:2;">
              <label>Content</label>
              <input type="text" id="newContent" placeholder="The fact or learning..." required />
            </div>
          </div>
          <button type="submit" class="btn btn-primary">Add</button>
        </form>
      </div>
      <div class="card">
        <h2>Learnings (${learnings.length})</h2>
        ${learnings.length === 0 ? '<div class="empty-state">No learnings yet. Add one above or have users say "remember this: …" in chat.</div>' : `
        <table>
          <thead><tr><th>Topic</th><th>Content</th><th>Source</th><th>Updated</th><th></th></tr></thead>
          <tbody>${rows}</tbody>
        </table>`}
      </div>
      <div id="editModal" style="display:none; position:fixed; inset:0; background:rgba(0,0,0,0.6); z-index:100; align-items:center; justify-content:center;">
        <div class="card" style="margin:20px; max-width:500px;">
          <h2>Edit learning</h2>
          <form id="editForm" onsubmit="return saveEdit(event)">
            <input type="hidden" id="editId" />
            <div class="form-group">
              <label>Topic</label>
              <input type="text" id="editTopic" required />
            </div>
            <div class="form-group">
              <label>Content</label>
              <textarea id="editContent" required></textarea>
            </div>
            <button type="submit" class="btn btn-primary">Save</button>
            <button type="button" class="btn btn-ghost" onclick="document.getElementById('editModal').style.display='none'">Cancel</button>
          </form>
        </div>
      </div>
    </main>
    <script>
      const tenantId = "${tenant.id}";
      const base = "/admin/api/tenants/" + tenantId + "/knowledge";
      const fetchFn = window.adminFetch || fetch;
      const learningsData = ${learningsJson};
      function addLearning(e) {
        e.preventDefault();
        const topic = document.getElementById("newTopic").value.trim();
        const content = document.getElementById("newContent").value.trim();
        if (!topic || !content) return false;
        fetchFn(base, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ topic, content }) })
          .then(r => r.json())
          .then(d => { if (d.error) alert(d.error); else location.reload(); });
        return false;
      }
      function editLearning(id) {
        const k = learningsData.find(x => x.id === id);
        if (!k) return;
        document.getElementById("editId").value = k.id;
        document.getElementById("editTopic").value = k.topic;
        document.getElementById("editContent").value = k.content;
        document.getElementById("editModal").style.display = "flex";
      }
      function saveEdit(e) {
        e.preventDefault();
        const id = document.getElementById("editId").value;
        const topic = document.getElementById("editTopic").value.trim();
        const content = document.getElementById("editContent").value.trim();
        fetchFn(base + "/" + id, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ topic, content }) })
          .then(r => r.json())
          .then(d => { if (d.error) alert(d.error); else location.reload(); });
        return false;
      }
      function deleteLearning(id) {
        if (!confirm("Delete this learning?")) return;
        fetchFn(base + "/" + id, { method: "DELETE" })
          .then(r => r.json())
          .then(d => { if (d.error) alert(d.error); else location.reload(); });
      }
    </script>
  </body>
</html>`);
});

// Client content management
app.get("/admin/content", async (c) => {
  if (!isAdminRequest(c)) {
    return c.html("<h1>Unauthorized</h1><p>Missing or invalid admin token.</p>", 401);
  }
  const tenantSlug = (c.req.query("tenantSlug") as string) || "default";
  const { data: tenants } = await adminSupabase
    .from("tenants")
    .select("id,name,slug")
    .order("created_at", { ascending: true });
  const tenantList = tenants ?? [];
  const tenant = tenantList.find((t) => t.slug === tenantSlug) ?? tenantList[0];
  if (!tenant) {
    return c.html(`<h1>Admin</h1><p>No tenants found.</p>`, 500);
  }
  const { data: items } = await adminSupabase
    .from("client_content")
    .select("id,key,title,content,updated_at")
    .eq("tenant_id", tenant.id)
    .order("key", { ascending: true });
  const contentList = items ?? [];
  const tenantSel = tenantSelector(
    tenantList.map((t) => ({ id: t.id, name: t.name, slug: t.slug })),
    tenantSlug,
    "/admin/content"
  );
  const rows = contentList
    .map(
      (r) =>
        `<tr>
          <td><strong>${escapeHtml(r.key)}</strong></td>
          <td>${escapeHtml(r.title ?? "—")}</td>
          <td>${escapeHtml(r.content.slice(0, 60))}${r.content.length > 60 ? "…" : ""}</td>
          <td class="muted">${new Date(r.updated_at).toLocaleDateString()}</td>
          <td><a href="/admin/content/${tenant.slug}/${r.key}">Edit</a></td>
        </tr>`
    )
    .join("");
  return c.html(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Client Content – Admin</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>${ADMIN_STYLES}</style>
    <script>${ADMIN_FETCH_SCRIPT}</script>
  </head>
  <body>
    <header>
      <h1>Client Content</h1>
      ${adminNav("content")}
      <span style="margin-left:auto;">${tenantSel}</span>
    </header>
    <main>
      <div class="card">
        <h2>Content keys (menu, hours, pricing, faq)</h2>
        <p class="muted">Edit via API: <code>PUT /admin/api/tenants/:tenantId/content/:key</code> with <code>{ title?, content }</code></p>
        ${contentList.length === 0 ? '<div class="empty-state">No client content. Add via API or seed.</div>' : `
        <table>
          <thead><tr><th>Key</th><th>Title</th><th>Content</th><th>Updated</th><th></th></tr></thead>
          <tbody>${rows}</tbody>
        </table>`}
      </div>
    </main>
  </body>
</html>`);
});

// Content edit page (single key)
app.get("/admin/content/:tenantSlug/:key", async (c) => {
  if (!isAdminRequest(c)) {
    return c.html("<h1>Unauthorized</h1><p>Missing or invalid admin token.</p>", 401);
  }
  const tenantSlug = c.req.param("tenantSlug");
  const key = c.req.param("key");
  const { data: tenant } = await adminSupabase
    .from("tenants")
    .select("id,name,slug")
    .eq("slug", tenantSlug)
    .single();
  if (!tenant) return c.html("<h1>Not found</h1>", 404);
  const { data: row } = await adminSupabase
    .from("client_content")
    .select("id,key,title,content,updated_at")
    .eq("tenant_id", tenant.id)
    .eq("key", key)
    .single();
  const content = row ?? { key, title: "", content: "" };
  return c.html(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Edit ${escapeHtml(key)} – Admin</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>${ADMIN_STYLES}</style>
    <script>${ADMIN_FETCH_SCRIPT}</script>
  </head>
  <body>
    <header>
      <a href="/admin/content?tenantSlug=${tenantSlug}">← Content</a>
      <h1>Edit ${escapeHtml(key)}</h1>
    </header>
    <main>
      <div class="card">
        <form id="form" onsubmit="return save(event)">
          <div class="form-group">
            <label>Title</label>
            <input type="text" id="title" value="${escapeHtml(content.title ?? "")}" />
          </div>
          <div class="form-group">
            <label>Content</label>
            <textarea id="content" style="min-height:200px;">${escapeHtml(content.content ?? "")}</textarea>
          </div>
          <button type="submit" class="btn btn-primary">Save</button>
        </form>
      </div>
    </main>
    <script>
      const base = "/admin/api/tenants/${tenant.id}/content/${key}";
      const fetchFn = window.adminFetch || fetch;
      function save(e) { e.preventDefault();
        fetchFn(base, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: document.getElementById("title").value, content: document.getElementById("content").value }) })
          .then(r => r.json()).then(d => { if (d.error) alert(d.error); else location.href="/admin/content?tenantSlug=${tenantSlug}"; });
        return false;
      }
    </script>
  </body>
</html>`);
});

const port = config.server.port;
console.log(`Omnichannel AI Workspace listening on port ${port}`);

if (config.server.nodeEnv !== "development" && !process.env.ADMIN_TOKEN) {
  console.warn(
    "[Admin] NODE_ENV is not development but ADMIN_TOKEN is not set. Admin routes will reject all requests. Set ADMIN_TOKEN in production."
  );
}

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`Server running at http://localhost:${info.port}`);
});
