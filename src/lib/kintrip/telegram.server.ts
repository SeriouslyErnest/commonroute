/**
 * Server-only Telegram Bot API helper for CommonRoute's dedicated bot.
 *
 * Security rules (see docs/SECURITY.md):
 * - TELEGRAM_BOT_TOKEN and TELEGRAM_WEBHOOK_SECRET are protected server
 *   secrets, read only inside handlers. Never expose them to the browser,
 *   the database, logs, or docs.
 * - TELEGRAM_BOT_USERNAME is public, non-secret configuration.
 * - Telegram is notification/deep-link only: no voting, editing, or admin
 *   actions ever happen inside Telegram.
 */

const TG_API = "https://api.telegram.org";

export interface TgSendResult {
  ok: boolean;
  /** true when the chat is blocked/revoked or the destination is invalid */
  permanent?: boolean;
  error?: string;
}

/** Call the Bot API. Never log the token or full response payloads. */
export async function tgCall(
  method: string,
  body: Record<string, unknown>,
): Promise<TgSendResult & { result?: unknown }> {
  const token = process.env["TELEGRAM_BOT_TOKEN"];
  if (!token) return { ok: false, permanent: true, error: "bot_not_configured" };
  try {
    const res = await fetch(`${TG_API}/bot${token}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = (await res.json().catch(() => null)) as
      | { ok?: boolean; description?: string; error_code?: number; result?: unknown }
      | null;
    if (json?.ok) return { ok: true, result: json.result };
    const code = json?.error_code ?? res.status;
    const desc = json?.description ?? `HTTP ${res.status}`;
    // 403 blocked/deactivated, 400 chat not found → permanent until relinked.
    const permanent =
      code === 403 ||
      (code === 400 && /chat not found|user is deactivated|bot was blocked/i.test(desc));
    return { ok: false, permanent, error: desc };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "network_error" };
  }
}

/** Send a notification message with one optional allowlisted in-app URL button. */
export async function tgNotify(
  chatId: number,
  text: string,
  button?: { label: string; path: string },
): Promise<TgSendResult> {
  const body: Record<string, unknown> = {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
  };
  if (button) {
    // Only same-app paths are allowlisted; never build URLs from user content.
    const safePath = /^\/[A-Za-z0-9/_-]*$/.test(button.path) ? button.path : "/";
    body["reply_markup"] = {
      inline_keyboard: [[{ text: button.label, url: `${appOrigin()}${safePath}` }]],
    };
  }
  return tgCall("sendMessage", body);
}

/** Public origin used in deep-link buttons. */
export function appOrigin(): string {
  return (
    process.env["APP_PUBLIC_ORIGIN"] ??
    (process.env["VITE_SUPABASE_URL"] ? "https://commonroute.lovable.app" : "https://commonroute.lovable.app")
  );
}

export function botUsername(): string {
  return process.env["TELEGRAM_BOT_USERNAME"] ?? "";
}

/** Random single-use linking token (Telegram start-param safe: A–Z a–z 0–9 _ -, ≤64 chars). */
export function newLinkToken(): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-";
  const bytes = new Uint8Array(48);
  crypto.getRandomValues(bytes);
  let out = "";
  for (const b of bytes) out += alphabet[b % alphabet.length];
  return out;
}

/** Only the token hash is stored; the raw token lives only in the deep link. */
export async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export interface TelegramPrefs {
  vote_reminders: boolean;
  itinerary_changes: boolean;
  organiser_updates: boolean;
  travel_day: boolean;
}

export const DEFAULT_PREFS: TelegramPrefs = {
  vote_reminders: true,
  itinerary_changes: true,
  organiser_updates: true,
  travel_day: false,
};

export function sanitizePrefs(input: unknown): TelegramPrefs {
  const src = (input ?? {}) as Record<string, unknown>;
  return {
    vote_reminders: typeof src["vote_reminders"] === "boolean" ? src["vote_reminders"] : DEFAULT_PREFS.vote_reminders,
    itinerary_changes: typeof src["itinerary_changes"] === "boolean" ? src["itinerary_changes"] : DEFAULT_PREFS.itinerary_changes,
    organiser_updates: typeof src["organiser_updates"] === "boolean" ? src["organiser_updates"] : DEFAULT_PREFS.organiser_updates,
    travel_day: typeof src["travel_day"] === "boolean" ? src["travel_day"] : DEFAULT_PREFS.travel_day,
  };
}
