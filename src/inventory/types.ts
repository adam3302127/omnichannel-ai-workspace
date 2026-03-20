export type InventoryCategory =
  | "Bulk Flower"
  | "Ingredients"
  | "THCP Flower"
  | "Bulk Copacked"
  | "Bulk PreRolls"
  | string;

export interface InventoryItem {
  category: InventoryCategory;
  name: string;
  unit?: string | null;
  unitPrice?: number | null;
  unitPriceText?: string | null;
  source?: Record<string, unknown> | null;
}

export interface InventoryParseReport {
  sourceUrl: string;
  categoriesDetected: string[];
  itemsExtracted: number;
  parseNotes: string[];
}

