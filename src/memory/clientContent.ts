import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { config } from "../config";

let supabase: SupabaseClient | null = null;

function getSupabase(): SupabaseClient {
  if (!supabase) {
    supabase = createClient(config.supabase.url, config.supabase.serviceKey);
  }
  return supabase;
}

export interface ClientContentRecord {
  id: string;
  tenant_id: string;
  key: string;
  title: string | null;
  content: string;
  updated_at: string;
}

export async function getClientContent(
  tenantId: string,
  key: string
): Promise<ClientContentRecord | null> {
  const client = getSupabase();
  const { data, error } = await client
    .from("client_content")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("key", key)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      // No rows
      return null;
    }
    throw new Error(`Failed to fetch client_content(${key}): ${error.message}`);
  }

  return data as ClientContentRecord;
}

export async function getClientContentText(
  tenantId: string,
  key: string
): Promise<string | null> {
  const record = await getClientContent(tenantId, key);
  return record?.content ?? null;
}

