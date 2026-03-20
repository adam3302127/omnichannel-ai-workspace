/**
 * Simple in-memory rate limiter. Gentle limits to allow normal flow while blocking abuse.
 * 100 requests per minute per client (within reason for chat).
 */

const WINDOW_MS = 60 * 1000; // 1 minute
const MAX_PER_WINDOW = 100;

const store = new Map<
  string,
  { count: number; windowStart: number }
>();

export function checkRateLimit(key: string): { ok: boolean; retryAfterSec?: number } {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry) {
    store.set(key, { count: 1, windowStart: now });
    return { ok: true };
  }

  if (now - entry.windowStart >= WINDOW_MS) {
    store.set(key, { count: 1, windowStart: now });
    return { ok: true };
  }

  entry.count++;
  if (entry.count > MAX_PER_WINDOW) {
    const retryAfterSec = Math.ceil((entry.windowStart + WINDOW_MS - now) / 1000);
    return { ok: false, retryAfterSec };
  }

  return { ok: true };
}
