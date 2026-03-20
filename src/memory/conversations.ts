import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { config } from "../config";

export interface DbUser {
  id: string;
  tenant_id: string;
  display_name: string | null;
  channel_identifiers: Record<string, string>;
  metadata: Record<string, unknown>;
}

export interface DbConversation {
  id: string;
  tenant_id: string;
  user_id: string;
  channel: string;
  channel_thread_id: string;
  is_group: boolean;
  last_active_at: string;
}

export interface DbMessage {
  id: string;
  conversation_id: string;
  role: "user" | "assistant";
  content: string;
  action_triggered: Record<string, unknown> | null;
  created_at: string;
}

export interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
}

let supabase: SupabaseClient | null = null;

function getSupabase(): SupabaseClient {
  if (!supabase) {
    supabase = createClient(config.supabase.url, config.supabase.serviceKey);
  }
  return supabase;
}

/**
 * Find or create user by tenant and channel identifier (e.g. telegram id)
 */
export async function findOrCreateUser(
  tenantId: string,
  channel: string,
  channelUserId: string,
  displayName: string | null,
  metadataExtra?: Record<string, unknown>
): Promise<DbUser> {
  const client = getSupabase();
  const key = channel;
  const identifiers = { [key]: channelUserId };

  const { data: existing } = await client
    .from("users")
    .select("*")
    .eq("tenant_id", tenantId)
    .contains("channel_identifiers", identifiers)
    .single();

  if (existing) {
    const updates: Record<string, unknown> = {};
    if (displayName && existing.display_name !== displayName) updates.display_name = displayName;
    if (metadataExtra && Object.keys(metadataExtra).length > 0) {
      const current = (existing.metadata as Record<string, unknown>) ?? {};
      updates.metadata = { ...current, ...metadataExtra };
    }
    if (Object.keys(updates).length > 0) {
      await client.from("users").update(updates).eq("id", existing.id);
    }
    return { ...existing, ...updates } as DbUser;
  }

  const meta = metadataExtra && Object.keys(metadataExtra).length > 0 ? metadataExtra : undefined;
  const { data: created, error } = await client
    .from("users")
    .insert({
      tenant_id: tenantId,
      display_name: displayName,
      channel_identifiers: identifiers,
      metadata: meta ?? {},
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create user: ${error.message}`);
  return created as DbUser;
}

/**
 * Find or create conversation by tenant, channel, thread
 */
export async function findOrCreateConversation(
  tenantId: string,
  userId: string,
  channel: string,
  channelThreadId: string,
  isGroup: boolean
): Promise<DbConversation> {
  const client = getSupabase();

  const { data: existing } = await client
    .from("conversations")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("channel", channel)
    .eq("channel_thread_id", channelThreadId)
    .single();

  if (existing) {
    await client
      .from("conversations")
      .update({ last_active_at: new Date().toISOString() })
      .eq("id", existing.id);
    return { ...existing, last_active_at: new Date().toISOString() } as DbConversation;
  }

  const { data: created, error } = await client
    .from("conversations")
    .insert({
      tenant_id: tenantId,
      user_id: userId,
      channel,
      channel_thread_id: channelThreadId,
      is_group: isGroup,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create conversation: ${error.message}`);
  return created as DbConversation;
}

/**
 * Fetch last N messages for a conversation (oldest first, for Claude context)
 */
export async function getRecentMessages(
  conversationId: string,
  limit: number = 20
): Promise<ConversationMessage[]> {
  const client = getSupabase();
  const { data, error } = await client
    .from("messages")
    .select("role, content")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) throw new Error(`Failed to fetch messages: ${error.message}`);
  return (data ?? []).map((r) => ({ role: r.role as "user" | "assistant", content: r.content }));
}

/**
 * Append user message and assistant message; optionally store action_triggered on assistant message
 */
export async function saveMessages(
  conversationId: string,
  userContent: string,
  assistantContent: string,
  actionTriggered: Record<string, unknown> | null
): Promise<void> {
  const client = getSupabase();

  const { error: err1 } = await client.from("messages").insert({
    conversation_id: conversationId,
    role: "user",
    content: userContent,
  });
  if (err1) throw new Error(`Failed to save user message: ${err1.message}`);

  const { error: err2 } = await client.from("messages").insert({
    conversation_id: conversationId,
    role: "assistant",
    content: assistantContent,
    action_triggered: actionTriggered,
  });
  if (err2) throw new Error(`Failed to save assistant message: ${err2.message}`);
}

/**
 * Update conversation last_active_at
 */
export async function touchConversation(conversationId: string): Promise<void> {
  const client = getSupabase();
  await client
    .from("conversations")
    .update({ last_active_at: new Date().toISOString() })
    .eq("id", conversationId);
}
