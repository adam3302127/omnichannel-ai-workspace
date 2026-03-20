import dotenv from "dotenv";

// Load .env from current working directory (project root when running via npm scripts)
dotenv.config();

function requireEnv(name: string): string {
  const value = process.env[name];
  if (value === undefined || value === "") {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function optionalEnv(name: string, defaultValue: string): string {
  return process.env[name] ?? defaultValue;
}

export const config = {
  anthropic: {
    apiKey: requireEnv("ANTHROPIC_API_KEY"),
    /** Model for chat. Haiku is ~4x cheaper; Sonnet is stronger for complex quotes. */
    model: optionalEnv("CLAUDE_MODEL", "claude-haiku-4-5"),
  },
  supabase: {
    url: requireEnv("SUPABASE_URL"),
    serviceKey: requireEnv("SUPABASE_SERVICE_KEY"),
  },
  telegram: {
    botToken: requireEnv("TELEGRAM_BOT_TOKEN"),
  },
  n8n: {
    baseUrl: optionalEnv("N8N_BASE_URL", "https://freshbros2.app.n8n.cloud/webhook"),
  },
  inventory: {
    // Public Google Sheets HTML (published)
    sheetUrl: optionalEnv(
      "INVENTORY_SHEET_URL",
      "https://docs.google.com/spreadsheets/d/e/2PACX-1vQMHTL3xCIALEJmM5NWMLWPKMAwbphaNP5t14KZbBWTJFfVBOrXFkZcCVtukvaFQ2vKJvH7U_9tAx2G/pubhtml"
    ),
  },
  server: {
    port: parseInt(optionalEnv("PORT", "3000"), 10),
    nodeEnv: optionalEnv("NODE_ENV", "development"),
  },
  webhookSecret: optionalEnv("WEBHOOK_SECRET", ""),
  /** Optional: Gemini API key for embeddings (RAG). If omitted, knowledge base uses keyword-style retrieval. */
  gemini: {
    apiKey: optionalEnv("GEMINI_API_KEY", ""),
  },
} as const;
