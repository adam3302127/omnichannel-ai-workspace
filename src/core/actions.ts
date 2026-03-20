import { config } from "../config";

const ACTION_REGEX = /<action>(\s*\{[\s\S]*?\})\s*<\/action>/;

export interface ParsedAction {
  type: string;
  payload: Record<string, unknown>;
}

/**
 * Parse optional <action>{...}</action> block from the end of Claude's response.
 * Returns { cleanText, action } — action is null if not present or invalid.
 */
export function parseActionBlock(rawResponse: string): {
  cleanText: string;
  action: ParsedAction | null;
} {
  const match = rawResponse.match(ACTION_REGEX);
  if (!match) {
    return { cleanText: rawResponse.trim(), action: null };
  }

  let parsed: { type?: string; payload?: Record<string, unknown> };
  try {
    parsed = JSON.parse(match[1].trim()) as { type?: string; payload?: Record<string, unknown> };
  } catch {
    return { cleanText: rawResponse.trim(), action: null };
  }

  if (!parsed.type || typeof parsed.type !== "string") {
    return { cleanText: rawResponse.trim(), action: null };
  }

  const cleanText = rawResponse.replace(ACTION_REGEX, "").trim();
  const action: ParsedAction = {
    type: parsed.type,
    payload: typeof parsed.payload === "object" && parsed.payload !== null ? parsed.payload : {},
  };
  return { cleanText, action };
}

/**
 * POST action to n8n webhook: {N8N_BASE_URL}/{actionType}
 */
export async function triggerN8nWebhook(action: ParsedAction): Promise<{ ok: boolean; error?: string }> {
  const base = config.n8n.baseUrl.replace(/\/$/, "");
  const url = `${base}/${encodeURIComponent(action.type)}`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(action.payload),
    });
    if (!res.ok) {
      return { ok: false, error: `HTTP ${res.status}: ${await res.text()}` };
    }
    return { ok: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { ok: false, error: message };
  }
}
