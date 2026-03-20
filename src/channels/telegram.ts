import type { IncomingMessage, OutgoingMessage } from "./types";
import { config } from "../config";
import { linkify } from "../utils/linkify";

export interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    chat: {
      id: number;
      type: "private" | "group" | "supergroup" | "channel";
      title?: string;
    };
    from?: {
      id: number;
      first_name: string;
      last_name?: string;
      username?: string;
    };
    text?: string;
    date: number;
  };
}

/**
 * Parse Telegram Update into normalized IncomingMessage
 */
export function parseTelegramUpdate(tenantSlug: string, body: TelegramUpdate): IncomingMessage | null {
  const msg = body.message;
  if (!msg?.from?.id || msg.chat.id === undefined) return null;
  const text = msg.text?.trim();
  if (!text) return null;

  const chatId = String(msg.chat.id);
  const isGroup =
    msg.chat.type === "group" || msg.chat.type === "supergroup";
  const displayName = [msg.from.first_name, msg.from.last_name].filter(Boolean).join(" ");

  return {
    tenantSlug,
    channel: "telegram",
    channelThreadId: chatId,
    isGroup,
    userId: String(msg.from.id),
    displayName: displayName || "User",
    text,
    raw: body,
  };
}

/**
 * Send response back via Telegram Bot API
 */
export async function sendTelegramMessage(outgoing: OutgoingMessage): Promise<void> {
  if (outgoing.channel !== "telegram") return;

  const token = config.telegram.botToken;
  const url = `https://api.telegram.org/bot${token}/sendMessage`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: outgoing.channelThreadId,
      text: linkify(outgoing.text),
      parse_mode: "HTML",
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Telegram sendMessage failed: ${res.status} ${err}`);
  }
}
