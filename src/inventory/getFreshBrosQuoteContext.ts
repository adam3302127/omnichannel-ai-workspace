/**
 * Fetches full category tables INCLUDING pricing tiers and shipping rows
 * for Claude to use when answering quote/order requests.
 */
import * as cheerio from "cheerio";
import { config } from "../config";
import { extractPublishedCategoryGids } from "./parseFreshBrosInventory";

function norm(s: string): string {
  return s.replace(/\u00A0/g, " ").replace(/\s+/g, " ").trim();
}

/** Only skip empty rows. Keep pricing tiers ($X/lb), shipping, and all product data. */
function isSkipRow(firstCell: string): boolean {
  return !firstCell || firstCell.trim() === "";
}

async function fetchCategoryTable(
  categoryName: string,
  baseId: string,
  gids: Array<{ name: string; gid: string }>
): Promise<string> {
  const found = gids.find((g) => g.name.toLowerCase() === categoryName.toLowerCase());
  if (!found) return "";

  const categoryUrl = `https://docs.google.com/spreadsheets/d/e/${baseId}/pubhtml/sheet?headers=false&gid=${found.gid}`;
  const res = await fetch(categoryUrl, { method: "GET" });
  if (!res.ok) return "";

  const $ = cheerio.load(await res.text());
  const table = $("table").first();
  if (!table || table.length === 0) return "";

  const trEls = table.find("tr").toArray();
  let headerCells: string[] | null = null;
  let headerIndex = -1;

  for (let i = 0; i < trEls.length; i++) {
    const rowCells = $(trEls[i])
      .find("td")
      .toArray()
      .map((td) => norm($(td).text()));
    if (rowCells.some((c) => c.toLowerCase().includes("strain"))) {
      headerCells = rowCells;
      headerIndex = i;
      break;
    }
  }

  if (!headerCells || headerIndex < 0) return "";

  const lines: string[] = [];
  lines.push(`=== ${categoryName} ===`);
  lines.push(`Columns: ${headerCells.join(" | ")}`);
  lines.push("");

  for (let i = headerIndex + 1; i < trEls.length; i++) {
    const rowCells = $(trEls[i])
      .find("td")
      .toArray()
      .map((td) => norm($(td).text()));
    if (!rowCells.length) continue;

    const firstCell = rowCells[0] ?? "";
    if (isSkipRow(firstCell)) continue;

    lines.push(rowCells.slice(0, headerCells.length).join(" | "));
  }

  lines.push("");
  return lines.join("\n");
}

/**
 * Returns full quote context from the live sheet: products, pricing tiers, and shipping.
 * Use this when the user asks for a quote, order, or "how much for X lbs".
 */
export async function getFreshBrosQuoteContext(
  categories?: string[]
): Promise<{ text: string; sheetUrl: string }> {
  const sheetUrl = config.inventory.sheetUrl;
  if (!sheetUrl) {
    throw new Error("Missing INVENTORY_SHEET_URL");
  }

  const viewerRes = await fetch(sheetUrl, { method: "GET" });
  if (!viewerRes.ok) {
    throw new Error(`Failed to fetch inventory viewer: HTTP ${viewerRes.status}`);
  }
  const viewerHtml = await viewerRes.text();

  const baseIdMatch = sheetUrl.match(/spreadsheets\/d\/e\/([^/]+)/i);
  if (!baseIdMatch) {
    throw new Error("Could not extract Google Sheet base id from INVENTORY_SHEET_URL");
  }
  const baseId = baseIdMatch[1];
  const gids = extractPublishedCategoryGids(viewerHtml);

  const toFetch = categories ?? ["Bulk Flower", "Bulk Copacked"];
  const parts: string[] = [];

  parts.push("LIVE INVENTORY & PRICING (use this for quotes):");
  parts.push("Includes products, wholesale pricing tiers, and shipping formula.");
  parts.push("");
  parts.push(`Source: ${sheetUrl}`);
  parts.push("");

  for (const cat of toFetch) {
    const table = await fetchCategoryTable(cat, baseId, gids);
    if (table) parts.push(table);
  }

  parts.push("---");
  parts.push("PRODUCT ALIASES: 'value exotics' / 'value exotic' / 'VEX' / 'deps' / 'light dep' / 'light assist' = VALUE EXOTIC/VEX (Light dep/Light Assist) in Bulk Flower. Higher sub-tier (High, Ultra) = more light assist; Entry/Standard = more light dep.");
  parts.push("");
  parts.push("SHIPPING: The sheet has Est. Shipping Costs by order size (e.g. $65/LB for 2-4 LB, $40/lb for 5-10 LB, $30/lb for 11-24 LB, $25/lb for 25+ LB). Use these tiers for shipping estimates.");
  parts.push("");
  parts.push("For a quote: use the product pricing + shipping tiers above. The main extra detail needed is SHIPPING DESTINATION (state/region) for accurate shipping cost.");

  return { text: parts.join("\n"), sheetUrl };
}
