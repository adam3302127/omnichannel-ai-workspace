#!/usr/bin/env npx tsx
/**
 * Backfill embeddings for existing knowledge_base entries that don't have them.
 * Run once after deploying the Gemini RAG migration:
 *   npx tsx scripts/backfill-knowledge-embeddings.ts
 */
import * as dotenv from "dotenv";
dotenv.config();
import { createClient } from "@supabase/supabase-js";
import { embedDocument } from "../src/embeddings/gemini";
import { config } from "../src/config";

async function main() {
  if (!config.gemini.apiKey) {
    console.error("GEMINI_API_KEY is required. Set it in .env");
    process.exit(1);
  }

  const supabase = createClient(config.supabase.url, config.supabase.serviceKey);
  const { data: rows, error } = await supabase
    .from("knowledge_base")
    .select("id, topic, content")
    .is("embedding", null);

  if (error) {
    console.error("Failed to fetch knowledge_base:", error.message);
    process.exit(1);
  }

  if (!rows?.length) {
    console.log("No entries need backfilling.");
    return;
  }

  console.log(`Backfilling ${rows.length} entries...`);
  let ok = 0;
  let fail = 0;

  for (const row of rows) {
    try {
      const text = `[${row.topic}] ${row.content}`.trim();
      const embedding = await embedDocument(text);
      const { error: upErr } = await supabase
        .from("knowledge_base")
        .update({ embedding, updated_at: new Date().toISOString() })
        .eq("id", row.id);
      if (upErr) throw upErr;
      ok++;
      process.stdout.write(".");
    } catch (e) {
      fail++;
      console.error(`\nFailed ${row.id}:`, e instanceof Error ? e.message : e);
    }
  }

  console.log(`\nDone. OK: ${ok}, Failed: ${fail}`);
}

main();
