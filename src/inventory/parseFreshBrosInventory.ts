import * as cheerio from "cheerio";
import type {
  InventoryItem,
  InventoryParseReport,
} from "./types";

function normalizeWhitespace(s: string): string {
  return s.replace(/\u00A0/g, " ").replace(/\s+/g, " ").trim();
}

function extractPrice(line: string): { price: number | null; text: string | null } {
  // Handles: "$1,234.56", "123.45", "1,234", etc.
  const cleaned = line.replace(/\s/g, "");
  const match = cleaned.match(/([$€£])?([0-9]{1,3}(?:,[0-9]{3})+|[0-9]+)(?:\.(\d+))?/);
  if (!match) return { price: null, text: null };

  const rawNumber = match[2].replace(/,/g, "");
  const decimal = match[3];
  const full = decimal !== undefined ? `${rawNumber}.${decimal}` : rawNumber;
  const price = Number(full);
  if (!Number.isFinite(price)) return { price: null, text: null };

  // Preserve original-ish text
  return { price, text: match[0] };
}

function extractUnit(line: string): string | null {
  // Best-effort: look for "/g", "/oz", "per gram", etc.
  const m = line.match(/\/\s*([a-zA-Z]{1,12})\b/) || line.match(/per\s+([a-zA-Z]{1,12})\b/i);
  return m ? m[1].toLowerCase() : null;
}

export function extractPublishedCategoryGids(viewerHtml: string): Array<{
  name: string;
  gid: string;
}> {
  // Viewer HTML looks like:
  // items.push({name: "Bulk Flower", pageUrl: "...gid=1984163599", gid: "1984163599", ...});
  const re =
    /name:\s*"([^"]+)"\s*,\s*pageUrl:\s*"([^"]+)"\s*,\s*gid:\s*"([^"]+)"/gim;
  const matches: Array<{ name: string; gid: string }> = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(viewerHtml)) !== null) {
    matches.push({ name: m[1], gid: m[3] });
  }
  return matches;
}

export function parseFreshBrosCategorySheetHtml(
  categoryHtml: string,
  categoryName: string
): { items: InventoryItem[]; notes: string[] } {
  const $ = cheerio.load(categoryHtml);

  // Find the first table row that includes a "Strain" header cell.
  let headerRowCells: string[] | null = null;
  let strainIdx: number | null = null;

  const allRows = $("table").first().find("tr").toArray();
  const notes: string[] = [];

  for (let i = 0; i < allRows.length; i++) {
    const row = $(allRows[i]);
    const cells = row.find("td").toArray().map((td) => normalizeWhitespace($(td).text()));
    if (cells.length === 0) continue;

    const lowerCells = cells.map((c) => c.toLowerCase());
    const hasStrainHeader = lowerCells.some((c) => c.includes("strain"));
    if (!hasStrainHeader) continue;

    headerRowCells = cells;
    strainIdx = lowerCells.findIndex((c) => c.includes("strain"));
    break;
  }

  if (headerRowCells === null || strainIdx === null || strainIdx < 0) {
    return {
      items: [],
      notes: [
        `Could not locate header row for category "${categoryName}" (expected a row containing 'Strain').`,
      ],
    };
  }

  const table = $("table").first();
  const dataRows = table.find("tr").toArray();

  const headerLower = headerRowCells.map((c) => c.toLowerCase());
  const hasWholesalePrice = headerLower.some((c) => c.includes("wholesale price"));
  const hasSizeTier =
    headerLower.some((c) => c.includes("size")) && headerLower.some((c) => c.includes("tier"));

  // Category-specific parsing to preserve sheet structure.
  if (hasSizeTier) {
    // Bulk PreRolls: columns like Strain | Size | Tier | 1-4,999 Units | ...
    const items: InventoryItem[] = [];

    // Find header row index
    let headerRowIndex = -1;
    for (let i = 0; i < dataRows.length; i++) {
      const row = $(dataRows[i]);
      const cells = row
        .find("td")
        .toArray()
        .map((td) => normalizeWhitespace($(td).text()));
      const lc = cells.map((c) => c.toLowerCase());
      if (lc.some((c) => c.includes("strain")) && lc.some((c) => c.includes("size"))) {
        headerRowIndex = i;
        break;
      }
    }
    if (headerRowIndex < 0) headerRowIndex = 0;

    // Get header cells for column names
    const headerCells = $(dataRows[headerRowIndex])
      .find("td")
      .toArray()
      .map((td) => normalizeWhitespace($(td).text()));
    const headerLc = headerCells.map((c) => c.toLowerCase());

    const strainI = headerLc.findIndex((c) => c.includes("strain"));
    const sizeI = headerLc.findIndex((c) => c.includes("size"));
    const tierI = headerLc.findIndex((c) => c.includes("tier"));

    // Price columns are everything after tier column
    const priceColStart = tierI >= 0 ? tierI + 1 : Math.min(headerCells.length, 3);
    const priceHeaders = headerCells
      .slice(priceColStart)
      .map((h) => h.trim())
      .filter(Boolean);

    for (let i = headerRowIndex + 1; i < dataRows.length; i++) {
      const row = $(dataRows[i]);
      const cells = row
        .find("td")
        .toArray()
        .map((td) => normalizeWhitespace($(td).text()));
      if (cells.length === 0) continue;

      const strain = cells[strainI] ?? cells[0] ?? "";
      const size = cells[sizeI] ?? null;
      const tier = cells[tierI] ?? null;
      if (!strain || /contact|get in touch/i.test(strain)) continue;

      const priceCells = cells.slice(priceColStart, priceColStart + priceHeaders.length);
      const entries: string[] = [];
      let firstPrice: number | null = null;

      for (let j = 0; j < priceHeaders.length; j++) {
        const header = priceHeaders[j];
        const cell = priceCells[j] ?? "";
        if (!cell) continue;
        const { price } = extractPrice(cell);
        if (firstPrice === null && price !== null) firstPrice = price;
        entries.push(`${header}=${cell}`);
      }

      const unitPriceText = entries.length
        ? `Tier: ${tier ?? ""}; Size: ${size ?? ""}; ${entries.join("; ")}`
        : null;

      if (unitPriceText) {
        items.push({
          category: categoryName,
          name: strain,
          unit: undefined,
          unitPrice: firstPrice ?? undefined,
          unitPriceText: unitPriceText,
          source: { size, tier, entries },
        });
      } else {
        // still store name if needed
        items.push({
          category: categoryName,
          name: strain,
          source: { size, tier },
        });
      }
    }

    return { items, notes: notes.length ? notes : ["Parsed Bulk PreRolls using Size/Tier table mapping."] };
  }

  if (hasWholesalePrice) {
    // Bulk Copacked: rows include Strain and wholesale price columns per size/range.
    // We map the first 4 wholesale-price cells to the 4 size labels from the row that contains '1LB'.
    let headerRowIndex = -1;
    for (let i = 0; i < dataRows.length; i++) {
      const row = $(dataRows[i]);
      const cells = row
        .find("td")
        .toArray()
        .map((td) => normalizeWhitespace($(td).text()));
      const lc = cells.map((c) => c.toLowerCase());
      if (lc.some((c) => c.includes("strain")) && lc.some((c) => c.includes("wholesale price"))) {
        headerRowIndex = i;
        break;
      }
    }
    if (headerRowIndex < 0) headerRowIndex = 0;

    // Find size row (contains 1LB)
    let sizeRowCells: string[] | null = null;
    for (let i = headerRowIndex + 1; i < dataRows.length && !sizeRowCells; i++) {
      const row = $(dataRows[i]);
      const cells = row
        .find("td")
        .toArray()
        .map((td) => normalizeWhitespace($(td).text()));
      const lowerCells = cells.map((c) => c.toLowerCase());
      if (
        lowerCells.some((c) => c.includes("1lb")) &&
        lowerCells.some((c) => c.includes("1/2lb"))
      ) {
        sizeRowCells = cells;
      }
    }

    const sizeLabels =
      sizeRowCells
        ? sizeRowCells.slice(1, 5).map((s) => s.trim()).filter(Boolean)
        : ["1LB", "1/2LB", "1/4LB", "1 OZ"];

    const items: InventoryItem[] = [];
    for (let i = headerRowIndex + 1; i < dataRows.length; i++) {
      const row = $(dataRows[i]);
      const cells = row
        .find("td")
        .toArray()
        .map((td) => normalizeWhitespace($(td).text()));
      if (cells.length === 0) continue;

      const strain = cells[strainIdx] ?? cells[0] ?? "";
      if (!strain) continue;
      if (/^value /i.test(strain) || /contact|get in touch/i.test(strain)) continue;

      // Extract non-zero decimals from the row; take first 4 as wholesale price points.
      const decimals = cells
        .map((c) => c.trim())
        .filter((c) => /^\\d+\\.\\d+$/i.test(c) || /^\\d+(?:,\\d+)*(?:\\.\\d+)?$/i.test(c))
        .map((c) => c.replace(/,/g, ""));
      const nonZeroDecimals = decimals.filter((c) => c !== "0.00" && c !== "0" && c !== "0.0");
      const priceValues = nonZeroDecimals.slice(0, sizeLabels.length);

      if (priceValues.length === 0) continue;

      const entries: string[] = [];
      for (let j = 0; j < priceValues.length && j < sizeLabels.length; j++) {
        entries.push(`${sizeLabels[j]}=${priceValues[j]}`);
      }

      const firstPrice = priceValues.length ? Number(priceValues[0]) : null;
      items.push({
        category: categoryName,
        name: strain,
        unit: undefined,
        unitPrice: firstPrice ?? undefined,
        unitPriceText: `Wholesale: ${entries.join("; ")}`,
        source: { sizeLabels, priceValues, entries },
      });
    }

    return { items, notes: notes.length ? notes : ["Parsed Bulk Copacked using Wholesale Price + 1LB row mapping."] };
  }

  // Default: tiered parsing (Bulk Flower / THCP Flower style)
  // Find the index of the header row so we can start extracting after it.
  let headerRowIndex = -1;
  for (let i = 0; i < dataRows.length; i++) {
    const row = $(dataRows[i]);
    const cells = row.find("td").toArray().map((td) => normalizeWhitespace($(td).text()));
    const lowerCells = cells.map((c) => c.toLowerCase());
    if (lowerCells.some((c) => c.includes("strain"))) {
      headerRowIndex = i;
      break;
    }
  }
  if (headerRowIndex < 0) headerRowIndex = 0;

  // Extract tier indices from header row cells
  const headerCells = $(dataRows[headerRowIndex])
    .find("td")
    .toArray()
    .map((td) => normalizeWhitespace($(td).text()));
  const headerLc = headerCells.map((c) => c.toLowerCase());
  const t1 = headerLc.findIndex((c) => c.includes("tier 1"));
  const t2 = headerLc.findIndex((c) => c.includes("tier 2"));
  const t3 = headerLc.findIndex((c) => c.includes("tier 3"));
  const stockIdx = headerLc.findIndex((c) => c.includes("stock"));

  const items: InventoryItem[] = [];

  for (let i = headerRowIndex + 1; i < dataRows.length; i++) {
    const row = $(dataRows[i]);
    const cells = row.find("td").toArray().map((td) => normalizeWhitespace($(td).text()));
    if (cells.length === 0) continue;

    const strain = cells[strainIdx] ? cells[strainIdx].trim() : "";
    if (!strain) continue;
    // Skip accidental repeats of header-ish values.
    if (/tier|warehouse|media|coas|type|stock/i.test(strain.toLowerCase())) continue;

    const t1Text = t1 >= 0 ? cells[t1] : null;
    const t2Text = t2 >= 0 ? cells[t2] : null;
    const t3Text = t3 >= 0 ? cells[t3] : null;

    // Prefer extracting a numeric value from tier 1.
    const price1 = t1Text ? extractPrice(t1Text).price : null;
    const price2 = t2Text ? extractPrice(t2Text).price : null;
    const price3 = t3Text ? extractPrice(t3Text).price : null;
    const unitPrice = price1 ?? price2 ?? price3 ?? null;

    const unitPriceText =
      [t1Text, t2Text, t3Text].filter(Boolean).length > 0
        ? `Tier1: ${t1Text ?? ""}; Tier2: ${t2Text ?? ""}; Tier3: ${t3Text ?? ""}`.replace(
            /\s+/g,
            " "
          )
        : null;

    const stockHeaderText = stockIdx >= 0 ? cells[stockIdx] : null;
    const unit = t1Text
      ? extractUnit(`${stockHeaderText ?? ""} ${t1Text}`)
      : extractUnit(`${stockHeaderText ?? ""}`);

    items.push({
      category: categoryName,
      name: strain,
      unit: unit ?? undefined,
      unitPrice,
      unitPriceText: unitPriceText ?? undefined,
      source: {
        tier1: t1Text ?? null,
        tier2: t2Text ?? null,
        tier3: t3Text ?? null,
      },
    });
  }

  if (items.length === 0) {
    notes.push(`No rows extracted for category "${categoryName}".`);
  }

  return { items, notes };
}

// Backwards compatible: the old parser attempted to parse a single table.
// Kept as-is so other potential sheet formats can still work.
export function parseInventoryHtml(
  html: string,
  sourceUrl: string
): { items: InventoryItem[]; report: InventoryParseReport } {
  // We no longer rely on this for the published Google Sheet viewer,
  // but keep the return shape for compatibility.
  const items: InventoryItem[] = [];
  return {
    items,
    report: {
      sourceUrl,
      categoriesDetected: [],
      itemsExtracted: 0,
      parseNotes: [
        "parseInventoryHtml is not used for the published Fresh Bros viewer anymore. Use parseFreshBrosCategorySheetHtml via the sync endpoint.",
      ],
    },
  };
}

