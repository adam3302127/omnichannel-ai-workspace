/**
 * Normalized message from any channel (Telegram, WhatsApp, etc.)
 */
export interface IncomingMessage {
  tenantSlug: string;
  channel: string;
  channelThreadId: string;
  isGroup: boolean;
  userId: string;
  displayName: string;
  text: string;
  raw?: unknown;
}

/**
 * Response to send back on the same channel
 */
export interface OutgoingMessage {
  channel: string;
  channelThreadId: string;
  text: string;
  rawPayload?: unknown;
}
