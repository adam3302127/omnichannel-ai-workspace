import * as cheerio from "cheerio";
import { config } from "../config";
import { extractPublishedCategoryGids } from "./parseFreshBrosInventory";

function norm(s: string): string {
  return s.replace(/\u00A0/g, " ").replace(/\s+/g, " ").trim();
}

function isNonDataRow(firstCell: string): boolean {
  const n = firstCell.trim().toLowerCase();
  if (!n) return true;
  if (n.startsWith("$")) return true;
  if (n === "total" || n.startsWith("total ")) return true;
  if (n.includes("est. shipping")) return true;
  if (n.includes("shipping")) return true;
  if (n.includes("talk to rep")) return true;
  if (n.includes("get in touch")) return true;
  if (n.includes("hemp approved")) return true;
  if (n.includes("ups")) return true;
  return false;
}

export async function getFreshBrosExactCategoryTableText(
  categoryName: string,
  options?: { limitRows?: number }
): Promise<{ text: string; columns: string[]; rowsReturned: number }> {
  const limitRows = options?.limitRows ?? 12;
  const sheetUrl = config.inventory.sheetUrl;
  if (!sheetUrl) {
    throw new Error("Missing INVENTORY_SHEET_URL");
  }

  // Fetch the viewer to resolve the gid for the selected category.
  const viewerRes = await fetch(sheetUrl, { method: "GET" });
  if (!viewerRes.ok) {
    throw new Error(`Failed to fetch inventory viewer: HTTP ${viewerRes.status}`);
  }
  const viewerHtml = await viewerRes.text();

  const gids = extractPublishedCategoryGids(viewerHtml);
  const found = gids.find(
    (g) => g.name.toLowerCase() === categoryName.toLowerCase()
  );
  if (!found) {
    throw new Error(`Category gid not found for "${categoryName}"`);
  }

  const baseIdMatch = sheetUrl.match(/spreadsheets\/d\/e\/([^/]+)/i);
  if (!baseIdMatch) {
    throw new Error("Could not extract Google Sheet base id from INVENTORY_SHEET_URL");
  }
  const baseId = baseIdMatch[1];

  const categoryUrl = `https://docs.google.com/spreadsheets/d/e/${baseId}/pubhtml/sheet?headers=false&gid=${found.gid}`;

  const categoryRes = await fetch(categoryUrl, { method: "GET" });
  if (!categoryRes.ok) {
    throw new Error(
      `Failed to fetch category sheet "${categoryName}": HTTP ${categoryRes.status}`
    );
  }
  const categoryHtml = await categoryRes.text();

  const $ = cheerio.load(categoryHtml);
  const table = $("table").first();
  if (!table || table.length === 0) {
    throw new Error("Could not locate category table in HTML");
  }

  const trEls = table.find("tr").toArray();

  // Header row: look for a row that contains a 'Strain' cell.
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

  if (!headerCells || headerIndex < 0) {
    throw new Error(`Could not find header row for "${categoryName}"`);
  }

  const columns = headerCells;

  const rows: string[][] = [];
  for (let i = headerIndex + 1; i < trEls.length; i++) {
    if (rows.length >= limitRows) break;
    const rowCells = $(trEls[i])
      .find("td")
      .toArray()
      .map((td) => norm($(td).text()));
    if (!rowCells.length) continue;

    const firstCell = rowCells[0] ?? "";
    if (isNonDataRow(firstCell)) continue;

    // Truncate to columns length to keep alignment stable.
    rows.push(rowCells.slice(0, columns.length));
  }

  const textLines: string[] = [];
  textLines.push(`LIVE INVENTORY DETAIL: ${categoryName}`);
  textLines.push("");
  textLines.push(`Source (Google Sheet, exact category): ${categoryUrl}`);
  textLines.push(`Source (viewer): ${sheetUrl}`);
  textLines.push("");
  textLines.push(`Columns: ${columns.join(" | ")}`);
  textLines.push("");
  rows.forEach((r, idx) => {
    textLines.push(`${idx + 1}) ${r.join(" | ")}`);
  });
  textLines.push("");
  textLines.push(`If you want pricing/availability for a specific strain, tell me the strain name + rough quantity.`);

  return { text: textLines.join("\n"), columns, rowsReturned: rows.length };
}

