#!/usr/bin/env npx tsx
/**
 * Sync Obsidian vault to omnichannel-ai-workspace knowledge_base and client_content.
 *
 * Usage:
 *   npx tsx scripts/sync-obsidian-vault.ts [--dry-run] [--knowledge-only] [--content-only]
 *
 * Env:
 *   OBSIDIAN_VAULT_PATH   Path to your Obsidian vault (required)
 *   OBSIDIAN_TENANT_SLUG  Tenant slug (default: "default")
 *   OBSIDIAN_KNOWLEDGE_FOLDER  Subfolder for knowledge base notes (default: "AI Knowledge", or "." for root)
 *   OBSIDIAN_CONTENT_FOLDER    Subfolder for client_content notes (default: "Business", or "." for root)
 *
 * Knowledge base mapping:
 *   - All .md files in OBSIDIAN_KNOWLEDGE_FOLDER (recursive) sync to knowledge_base.
 *   - Topic: frontmatter `topic`, or `key`, or filename (e.g. "Shipping Policy.md" -> "shipping policy")
 *   - Content: markdown body (frontmatter stripped)
 *   - Source: "obsidian" (replaces existing obsidian-sourced entries)
 *
 * Client content mapping:
 *   - Files: menu.md, faq.md, hours.md, pricing.md (case-insensitive) in OBSIDIAN_CONTENT_FOLDER
 *   - Maps to client_content keys: menu, faq, hours, pricing
 *   - Title: frontmatter `title` or filename
 */
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";
dotenv.config();

import { createClient } from "@supabase/supabase-js";
import { config } from "../src/config";
import { embedDocument } from "../src/embeddings/gemini";

const CLIENT_CONTENT_KEYS = ["menu", "faq", "hours", "pricing"] as const;

interface ParsedNote {
  topic: string;
  content: string;
  title?: string;
  key?: (typeof CLIENT_CONTENT_KEYS)[number];
}

function parseFrontmatter(content: string): { frontmatter: Record<string, string>; body: string } {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) return { frontmatter: {}, body: content.trim() };
  const [, fm, body] = match;
  const frontmatter: Record<string, string> = {};
  for (const line of fm.split("\n")) {
    const m = line.match(/^(\w+):\s*(.+)$/);
    if (m) frontmatter[m[1].toLowerCase()] = m[2].trim().replace(/^["']|["']$/g, "");
  }
  return { frontmatter, body: body.trim() };
}

function topicFromFilename(filename: string): string {
  return path.basename(filename, ".md").replace(/[-_]/g, " ");
}

function parseNote(filePath: string, relativePath: string): ParsedNote | null {
  const raw = fs.readFileSync(filePath, "utf-8");
  const { frontmatter, body } = parseFrontmatter(raw);
  const topic = frontmatter.topic ?? frontmatter.key ?? topicFromFilename(path.basename(filePath));
  const title = frontmatter.title ?? path.basename(filePath, ".md");

  const base = path.basename(filePath, ".md").toLowerCase();
  const key = CLIENT_CONTENT_KEYS.find((k) => base === k);

  return { topic, content: body, title, key: key ?? undefined };
}

function walkMdFiles(dir: string, baseDir: string): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name.startsWith(".") || e.name === "node_modules") continue;
      results.push(...walkMdFiles(full, baseDir));
    } else if (e.name.endsWith(".md")) {
      results.push(path.relative(baseDir, full));
    }
  }
  return results;
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const knowledgeOnly = args.includes("--knowledge-only");
  const contentOnly = args.includes("--content-only");

  const vaultPath = process.env.OBSIDIAN_VAULT_PATH;
  if (!vaultPath || !fs.existsSync(vaultPath)) {
    console.error("OBSIDIAN_VAULT_PATH must point to an existing vault. Set it in .env");
    process.exit(1);
  }

  const tenantSlug = process.env.OBSIDIAN_TENANT_SLUG ?? "default";
  const knowledgeFolder = process.env.OBSIDIAN_KNOWLEDGE_FOLDER ?? "AI Knowledge";
  const contentFolder = process.env.OBSIDIAN_CONTENT_FOLDER ?? "Business";

  const supabase = createClient(config.supabase.url, config.supabase.serviceKey);

  const { data: tenant } = await supabase
    .from("tenants")
    .select("id")
    .eq("slug", tenantSlug)
    .single();

  if (!tenant) {
    console.error(`Tenant slug "${tenantSlug}" not found.`);
    process.exit(1);
  }

  const tenantId = tenant.id;
  const hasGemini = Boolean(config.gemini.apiKey);

  if (dryRun) {
    console.log("[DRY RUN] No changes will be made.\n");
  }

  // --- Knowledge base sync ---
  if (!contentOnly) {
    const knowledgeDir = path.join(vaultPath, knowledgeFolder);
    const useRoot = !fs.existsSync(knowledgeDir);
    const scanDir = useRoot ? vaultPath : knowledgeDir;
    const knowledgeFiles = walkMdFiles(scanDir, scanDir);

    console.log(
      `Knowledge: scanning ${knowledgeFiles.length} .md files in "${useRoot ? "vault root" : knowledgeFolder}"`
    );

    if (!dryRun && knowledgeFiles.length > 0) {
      const { error: delErr } = await supabase
        .from("knowledge_base")
        .delete()
        .eq("tenant_id", tenantId)
        .eq("source", "obsidian");

      if (delErr) {
        console.error("Failed to clear obsidian-sourced knowledge:", delErr.message);
        process.exit(1);
      }
      console.log("Cleared existing obsidian-sourced knowledge entries");
    }

    let kbInserted = 0;
    for (const rel of knowledgeFiles) {
      const absPath = path.join(scanDir, rel);
      if (!fs.existsSync(absPath)) continue;

      const parsed = parseNote(absPath, rel);
      if (!parsed || !parsed.content) continue;

      if (dryRun) {
        console.log(`  [would add] ${rel} -> topic="${parsed.topic}"`);
        kbInserted++;
        continue;
      }

      const payload: Record<string, unknown> = {
        tenant_id: tenantId,
        topic: parsed.topic,
        content: parsed.content,
        source: "obsidian",
      };

      if (hasGemini) {
        try {
          const textToEmbed = `[${parsed.topic}] ${parsed.content}`.trim();
          payload.embedding = await embedDocument(textToEmbed);
        } catch (e) {
          console.warn(`  [skip embed] ${rel}:`, e instanceof Error ? e.message : e);
        }
      }

      const { error } = await supabase.from("knowledge_base").insert(payload);
      if (error) {
        console.error(`  [FAIL] ${rel}:`, error.message);
      } else {
        kbInserted++;
        process.stdout.write(".");
      }
    }
    console.log(`\nKnowledge: ${kbInserted} entries synced.`);
  }

  // --- Client content sync ---
  if (!knowledgeOnly) {
    const contentDir = path.join(vaultPath, contentFolder);
    const contentBase = fs.existsSync(contentDir) ? contentDir : vaultPath;

    console.log(`\nClient content: looking for ${CLIENT_CONTENT_KEYS.join(", ")}.md in "${contentFolder}"`);

    for (const key of CLIENT_CONTENT_KEYS) {
      const candidates = [
        path.join(contentBase, `${key}.md`),
        path.join(contentBase, `${key.charAt(0).toUpperCase() + key.slice(1)}.md`),
      ];
      const filePath = candidates.find((p) => fs.existsSync(p));
      if (!filePath) continue;

      const parsed = parseNote(filePath, key);
      if (!parsed) continue;

      if (dryRun) {
        console.log(`  [would upsert] ${key} <- ${path.basename(filePath)}`);
        continue;
      }

      const { error } = await supabase.from("client_content").upsert(
        {
          tenant_id: tenantId,
          key,
          title: parsed.title ?? key,
          content: parsed.content,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "tenant_id,key" }
      );

      if (error) {
        console.error(`  [FAIL] ${key}:`, error.message);
      } else {
        console.log(`  [ok] ${key}`);
      }
    }
  }

  console.log("\nObsidian sync complete.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
