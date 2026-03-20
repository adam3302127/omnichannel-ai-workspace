import { createClient } from "@supabase/supabase-js";
import { config } from "../config";
import {
  extractPublishedCategoryGids,
  parseFreshBrosCategorySheetHtml,
} from "./parseFreshBrosInventory";
import type { InventoryItem } from "./types";

export class InventorySyncError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InventorySyncError";
  }
}

export async function syncFreshBrosInventoryForTenant(
  tenantId: string,
): Promise<{ inserted: number; categories: string[] }> {
  const supabase = createClient(config.supabase.url, config.supabase.serviceKey);

  const sheetUrl = config.inventory.sheetUrl;
  if (!sheetUrl) {
    throw new InventorySyncError("Missing INVENTORY_SHEET_URL");
  }

  const res = await fetch(sheetUrl, { method: "GET" });
  if (!res.ok) {
    throw new InventorySyncError(
      `Failed to fetch inventory sheet: HTTP ${res.status}`
    );
  }
  const viewerHtml = await res.text();

  const baseIdMatch = sheetUrl.match(/spreadsheets\/d\/e\/([^/]+)/i);
  if (!baseIdMatch) {
    throw new InventorySyncError(
      "Could not extract Google Sheet base id from INVENTORY_SHEET_URL"
    );
  }
  const baseId = baseIdMatch[1];

  const categories = extractPublishedCategoryGids(viewerHtml);
  if (categories.length === 0) {
    throw new InventorySyncError(
      "Could not find category gids in the published sheet viewer HTML."
    );
  }

  const allItems: InventoryItem[] = [];
  const parseNotes: string[] = [];

  for (const cat of categories) {
    const categoryUrl = `https://docs.google.com/spreadsheets/d/e/${baseId}/pubhtml/sheet?headers=false&gid=${cat.gid}`;
    const catRes = await fetch(categoryUrl, { method: "GET" });
    if (!catRes.ok) {
      parseNotes.push(
        `Fetch failed for ${cat.name} (gid=${cat.gid}): HTTP ${catRes.status}`
      );
      continue;
    }
    const catHtml = await catRes.text();
    const parsed = parseFreshBrosCategorySheetHtml(catHtml, cat.name);
    if (parsed.items.length === 0) {
      parseNotes.push(
        `Parsed 0 items for ${cat.name}: ${parsed.notes.join(" | ")}`
      );
      continue;
    }
    allItems.push(...parsed.items);
    parseNotes.push(...parsed.notes.map((n) => `${cat.name}: ${n}`));
  }

  if (allItems.length === 0) {
    throw new InventorySyncError(
      `Parsed 0 inventory items across all categories. Notes: ${parseNotes.join(
        " | "
      )}`
    );
  }

  // Replace inventory for this tenant
  const { error: delErr } = await supabase
    .from("inventory_items")
    .delete()
    .eq("tenant_id", tenantId);
  if (delErr) {
    throw new InventorySyncError(`Failed to clear inventory_items: ${delErr.message}`);
  }

  const rows = allItems.map((it) => ({
    tenant_id: tenantId,
    category: it.category,
    name: it.name,
    unit: it.unit ?? null,
    unit_price: it.unitPrice ?? null,
    unit_price_text: it.unitPriceText ?? null,
    source: it.source ?? null,
  }));

  const { error: insErr } = await supabase
    .from("inventory_items")
    .insert(rows);
  if (insErr) {
    throw new InventorySyncError(`Failed to insert inventory_items: ${insErr.message}`);
  }

  const categoriesOut = Array.from(new Set(allItems.map((i) => i.category))).slice(0, 20);
  return { inserted: rows.length, categories: categoriesOut };
}

export async function previewFreshBrosInventory(): Promise<{
  report: {
    sourceUrl: string;
    categoriesDetected: string[];
    itemsExtracted: number;
    parseNotes: string[];
  };
  itemsSample: InventoryItem[];
}> {
  const sheetUrl = config.inventory.sheetUrl;
  if (!sheetUrl) {
    throw new InventorySyncError("Missing INVENTORY_SHEET_URL");
  }

  const res = await fetch(sheetUrl, { method: "GET" });
  if (!res.ok) {
    throw new InventorySyncError(`Failed to fetch inventory sheet: HTTP ${res.status}`);
  }

  const viewerHtml = await res.text();

  const baseIdMatch = sheetUrl.match(/spreadsheets\/d\/e\/([^/]+)/i);
  if (!baseIdMatch) {
    throw new InventorySyncError(
      "Could not extract Google Sheet base id from INVENTORY_SHEET_URL"
    );
  }
  const baseId = baseIdMatch[1];

  const categories = extractPublishedCategoryGids(viewerHtml);
  if (categories.length === 0) {
    return {
      report: {
        sourceUrl: sheetUrl,
        categoriesDetected: [],
        itemsExtracted: 0,
        parseNotes: ["Could not find category gids in the viewer HTML."],
      },
      itemsSample: [],
    };
  }

  const allItems: InventoryItem[] = [];
  const parseNotes: string[] = [];
  for (const cat of categories) {
    const categoryUrl = `https://docs.google.com/spreadsheets/d/e/${baseId}/pubhtml/sheet?headers=false&gid=${cat.gid}`;
    const catRes = await fetch(categoryUrl, { method: "GET" });
    if (!catRes.ok) {
      parseNotes.push(
        `Fetch failed for ${cat.name} (gid=${cat.gid}): HTTP ${catRes.status}`
      );
      continue;
    }
    const catHtml = await catRes.text();
    const parsed = parseFreshBrosCategorySheetHtml(catHtml, cat.name);
    allItems.push(...parsed.items);
    parseNotes.push(...parsed.notes.map((n) => `${cat.name}: ${n}`));
  }

  return {
    report: {
      sourceUrl: sheetUrl,
      categoriesDetected: categories.map((c) => c.name),
      itemsExtracted: allItems.length,
      parseNotes,
    },
    itemsSample: allItems.slice(0, 25),
  };
}

