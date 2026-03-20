import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { config } from "../config";

let supabase: SupabaseClient | null = null;

function getSupabase(): SupabaseClient {
  if (!supabase) {
    supabase = createClient(config.supabase.url, config.supabase.serviceKey);
  }
  return supabase;
}

export interface KnowledgeBaseRecord {
  id: string;
  tenant_id: string;
  topic: string;
  content: string;
  source: string;
  created_at: string;
  updated_at: string;
}

export async function getKnowledgeBaseEntries(
  tenantId: string
): Promise<KnowledgeBaseRecord[]> {
  const client = getSupabase();
  const { data, error } = await client
    .from("knowledge_base")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("updated_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch knowledge_base: ${error.message}`);
  }

  return (data ?? []) as KnowledgeBaseRecord[];
}

/**
 * Returns formatted knowledge base text for injection into system prompt.
 * Empty string if no entries.
 */
export async function getKnowledgeBaseText(tenantId: string): Promise<string> {
  const entries = await getKnowledgeBaseEntries(tenantId);
  if (entries.length === 0) return "";

  const lines = entries.map((e) => `- [${e.topic}] ${e.content}`);
  return (
    "\n\nLEARNINGS (evolving knowledge — use these to improve answers):\n" +
    lines.join("\n")
  );
}

/**
 * Add a learning from user message, e.g. "remember this: min order is 1 lb"
 */
export async function addLearningFromUser(
  tenantId: string,
  topic: string,
  content: string
): Promise<KnowledgeBaseRecord | null> {
  const client = getSupabase();
  const { data, error } = await client
    .from("knowledge_base")
    .insert({
      tenant_id: tenantId,
      topic: topic.trim(),
      content: content.trim(),
      source: "user",
    })
    .select("*")
    .single();

  if (error) return null;
  return data as KnowledgeBaseRecord;
}
