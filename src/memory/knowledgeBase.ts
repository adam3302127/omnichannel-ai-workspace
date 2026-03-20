import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { config } from "../config";
import { embedDocument, embedQuery } from "../embeddings/gemini";

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

interface MatchResult {
  id: string;
  tenant_id: string;
  topic: string;
  content: string;
  source: string;
  similarity: number;
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

/** Whether Gemini RAG (semantic search) is available */
export function isRagAvailable(): boolean {
  return Boolean(config.gemini.apiKey);
}

/**
 * Returns formatted knowledge base text for injection into system prompt.
 * - If GEMINI_API_KEY is set: uses semantic search (RAG) to fetch only relevant entries.
 * - If not: returns all entries (legacy behavior).
 * Empty string if no entries.
 */
export async function getKnowledgeBaseText(
  tenantId: string,
  userMessage?: string
): Promise<string> {
  if (isRagAvailable() && userMessage?.trim()) {
    return getRelevantKnowledgeText(tenantId, userMessage);
  }
  return getAllKnowledgeText(tenantId);
}

/**
 * Semantic search: embed query, match against knowledge_base, return formatted text.
 */
async function getRelevantKnowledgeText(
  tenantId: string,
  userMessage: string
): Promise<string> {
  try {
    const queryEmbedding = await embedQuery(userMessage);
    const client = getSupabase();
    const { data, error } = await client.rpc("match_knowledge_base", {
      query_embedding: queryEmbedding,
      p_tenant_id: tenantId,
      match_threshold: 0.4,
      match_count: 5,
    });

    if (error) {
      console.error("[KnowledgeBase] RAG match failed, falling back to all entries:", error.message);
      return getAllKnowledgeText(tenantId);
    }

    const matches = (data ?? []) as MatchResult[];
    if (matches.length === 0) return "";

    const lines = matches.map((m) => `- [${m.topic}] ${m.content}`);
    return (
      "\n\nLEARNINGS (semantic match — use these to improve answers):\n" +
      lines.join("\n")
    );
  } catch (err) {
    console.error("[KnowledgeBase] RAG error, falling back:", err instanceof Error ? err.message : err);
    return getAllKnowledgeText(tenantId);
  }
}

/** Returns all knowledge entries as formatted text (legacy fallback) */
async function getAllKnowledgeText(tenantId: string): Promise<string> {
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
 * If GEMINI_API_KEY is set, also generates and stores embedding for RAG.
 */
export async function addLearningFromUser(
  tenantId: string,
  topic: string,
  content: string
): Promise<KnowledgeBaseRecord | null> {
  const client = getSupabase();
  const textToEmbed = `[${topic}] ${content}`.trim();

  const insertPayload: Record<string, unknown> = {
    tenant_id: tenantId,
    topic: topic.trim(),
    content: content.trim(),
    source: "user",
  };

  if (isRagAvailable()) {
    try {
      const embedding = await embedDocument(textToEmbed);
      insertPayload.embedding = embedding;
    } catch (err) {
      console.error("[KnowledgeBase] Failed to embed new entry:", err instanceof Error ? err.message : err);
    }
  }

  const { data, error } = await client
    .from("knowledge_base")
    .insert(insertPayload)
    .select("*")
    .single();

  if (error) return null;
  return data as KnowledgeBaseRecord;
}

/**
 * Generate and store embedding for an existing knowledge base entry.
 * Call after admin adds entries via UI/API (entries without embeddings).
 */
export async function embedKnowledgeEntry(
  id: string,
  topic: string,
  content: string
): Promise<boolean> {
  if (!isRagAvailable()) return false;
  try {
    const textToEmbed = `[${topic}] ${content}`.trim();
    const embedding = await embedDocument(textToEmbed);
    const client = getSupabase();
    const { error } = await client
      .from("knowledge_base")
      .update({ embedding, updated_at: new Date().toISOString() })
      .eq("id", id);
    return !error;
  } catch {
    return false;
  }
}
