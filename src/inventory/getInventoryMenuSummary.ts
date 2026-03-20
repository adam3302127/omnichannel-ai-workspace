import { createClient } from "@supabase/supabase-js";
import { config } from "../config";

function isNonSkuRow(name: string): boolean {
  const n = name.trim().toLowerCase();
  if (!n) return true;

  // Tier pricing rows / blocks sometimes end up in the "name" column.
  if (n.startsWith("$")) return true;
  if (n.includes("shipping")) return true;
  if (n.includes("ups")) return true;
  if (n.includes("hemp approved")) return true;
  if (n === "total" || n.startsWith("total ")) return true;
  if (n.includes("exotic") && n.includes("indoor")) return true;

  return false;
}

function isPricingTierRow(name: string): boolean {
  const n = name.trim().toLowerCase();
  if (!n.startsWith("$")) return false;
  return n.includes("/lb") || n.includes("lb") || n.includes("orders");
}

const CATEGORY_ORDER = [
  "Bulk Flower",
  "Ingredients",
  "THCP Flower",
  "Bulk Copacked",
  "Bulk PreRolls",
];

export async function getInventoryMenuSummary(
  tenantId: string,
  maxCategories: number = 6,
  maxItemsPerCategory: number = 3
): Promise<{ summary: string; categories: string[] }> {
  const supabase = createClient(config.supabase.url, config.supabase.serviceKey);

  const { data, error } = await supabase
    .from("inventory_items")
    .select("category,name,unit,unit_price_text")
    .eq("tenant_id", tenantId)
    .order("updated_at", { ascending: false })
    .limit(300);

  if (error) {
    throw new Error(`Failed to fetch inventory_items: ${error.message}`);
  }

  const items = (data ?? []) as Array<{
    category: string;
    name: string;
    unit: string | null;
    unit_price_text: string | null;
  }>;

  const byCategory = new Map<string, typeof items>();
  for (const it of items) {
    const cat = it.category;
    if (!byCategory.has(cat)) byCategory.set(cat, []);
    byCategory.get(cat)!.push(it);
  }

  const categories = Array.from(byCategory.keys())
    .sort((a, b) => {
      const ai = CATEGORY_ORDER.indexOf(a);
      const bi = CATEGORY_ORDER.indexOf(b);
      const aScore = ai === -1 ? 999 : ai;
      const bScore = bi === -1 ? 999 : bi;
      return aScore - bScore;
    })
    .slice(0, maxCategories);
  if (categories.length === 0) {
    return { summary: "", categories: [] };
  }

  const lines: string[] = [];
  for (const cat of categories) {
    const list = byCategory.get(cat) ?? [];

    const skuRows = list.filter((it) => !isNonSkuRow(it.name));

    const tierNames = Array.from(
      new Set(
        list
          .filter((it) => isPricingTierRow(it.name))
          .map((it) => it.name)
      )
    ).slice(0, 5);

    console.log(
      `[Inventory] menu-summary cat=${cat} skuRows=${skuRows.length} tierNames=${tierNames.length}`
    );

    // Prefer rows that have explicit parsed tier text
    const skuRowsWithPrices = skuRows.filter((it) => Boolean(it.unit_price_text));
    const skuRowsWithoutPrices = skuRows.filter((it) => !it.unit_price_text);

    const pick = (rows: typeof skuRows) =>
      rows
        .slice(0, maxItemsPerCategory)
        .map((r) => r);

    const topWithPrices = pick(skuRowsWithPrices);
    const remaining = maxItemsPerCategory - topWithPrices.length;
    const topWithoutPrices = remaining > 0 ? pick(skuRowsWithoutPrices).slice(0, remaining) : [];
    const top = [...topWithPrices, ...topWithoutPrices];

    lines.push(`${cat}:`);
    lines.push(`Products:`);
    for (const it of top) {
      const unitPriceText = it.unit_price_text ? it.unit_price_text : "";
      // unit_price_text is already in "Tier1: ...; Tier2: ...; Tier3: ..." format from parsing
      lines.push(
        unitPriceText
          ? `- ${it.name} — ${unitPriceText}`
          : `- ${it.name}`
      );
    }

    if (tierNames.length > 0) {
      lines.push(`Pricing tiers:`);
      for (const t of tierNames) {
        lines.push(`- ${t}`);
      }
    }
    lines.push("");
  }

  return {
    summary:
      `LIVE INVENTORY SNAPSHOT (may change):\n` +
      lines.join("\n").trim() +
      `\n\nFor pricing and exact availability, ask for the category and rough quantity; we’ll route to a human quote.`,
    categories,
  };
}

export async function getInventoryCategoriesOverviewText(
  tenantId: string,
  options?: { maxCategories?: number; maxExampleNamesPerCategory?: number }
): Promise<{ text: string; categories: string[] }> {
  const maxCategories = options?.maxCategories ?? 6;
  const maxExampleNamesPerCategory = options?.maxExampleNamesPerCategory ?? 3;

  const supabase = createClient(config.supabase.url, config.supabase.serviceKey);
  const { data, error } = await supabase
    .from("inventory_items")
    .select("category,name")
    .eq("tenant_id", tenantId)
    .order("updated_at", { ascending: false })
    .limit(400);

  if (error) {
    throw new Error(`Failed to fetch inventory_items: ${error.message}`);
  }

  const items = (data ?? []) as Array<{
    category: string;
    name: string;
  }>;

  const byCategory = new Map<string, Array<{ category: string; name: string }>>();
  for (const it of items) {
    const cat = it.category;
    if (!byCategory.has(cat)) byCategory.set(cat, []);
    byCategory.get(cat)!.push(it);
  }

  const categories = Array.from(byCategory.keys())
    .sort((a, b) => {
      const ai = CATEGORY_ORDER.indexOf(a);
      const bi = CATEGORY_ORDER.indexOf(b);
      const aScore = ai === -1 ? 999 : ai;
      const bScore = bi === -1 ? 999 : bi;
      return aScore - bScore;
    })
    .slice(0, maxCategories);

  const lines: string[] = [];
  lines.push(`Source (Google Sheet, viewer): ${config.inventory.sheetUrl}`);
  lines.push("LIVE INVENTORY CATEGORIES (choose one for the exact table):");
  for (const cat of categories) {
    const list = byCategory.get(cat) ?? [];
    const exampleNames = Array.from(
      new Set(
        list
          .filter((it) => !isNonSkuRow(it.name))
          .map((it) => it.name)
      )
    ).slice(0, maxExampleNamesPerCategory);

    lines.push("");
    lines.push(`- ${cat}`);
    if (exampleNames.length > 0) {
      lines.push(`  Examples: ${exampleNames.join(", ")}`);
    }
  }

  lines.push("");
  lines.push("Reply with exactly one of the categories above (or say something like “Bulk Copacked”).");

  return { text: lines.join("\n").trim(), categories };
}

