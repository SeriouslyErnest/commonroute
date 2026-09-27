import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  appOrigin,
  botUsername,
  hashToken,
  newLinkToken,
  sanitizePrefs,
  tgNotify,
  tgCall,
  type TelegramPrefs,
} from "./telegram.server";

export type { TelegramPrefs } from "./telegram.server";

/**
 * Telegram account linking, preferences, and delivery.
 *
 * - Linking uses short-lived (10 min), single-use, hashed tokens; the deep
 *   link is https://t.me/<bot>?start=<token>.
 * - User links and admin destinations are separate records; a Telegram chat
 *   never grants admin rights.
 * - Before any trip-specific delivery, trip membership is revalidated so
 *   removed members never receive trip details.
 * - Telegram failures never roll back app events; a blocked chat is marked
 *   "needs_attention" and delivery pauses until relinked.
 */

export interface TelegramStatus {
  configured: boolean;
  botUsername: string;
  status: "disconnected" | "active" | "needs_attention";
  prefs: TelegramPrefs;
}

const TOKEN_TTL_MS = 10 * 60 * 1000;

async function issueLinkToken(userId: string, scope: "user" | "admin_destination") {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const token = newLinkToken();
  const tokenHash = await hashToken(token);
  const { error } = await supabaseAdmin.from("telegram_link_tokens").insert({
    token_hash: tokenHash,
    user_id: userId,
    scope,
    expires_at: new Date(Date.now() + TOKEN_TTL_MS).toISOString(),
  });
  if (error) throw new Error(error.message);
  return token;
}

export const getTelegramStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<TelegramStatus> => {
    const username = botUsername();
    const configured = Boolean(process.env["TELEGRAM_BOT_TOKEN"] && username);
    const { data } = await context.supabase
      .from("telegram_user_links")
      .select("status, prefs")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!data || data.status === "revoked") {
      return { configured, botUsername: username, status: "disconnected", prefs: sanitizePrefs(null) };
    }
    return {
      configured,
      botUsername: username,
      status: data.status === "needs_attention" ? "needs_attention" : "active",
      prefs: sanitizePrefs(data.prefs),
    };
  });

export const startTelegramLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const username = botUsername();
    if (!process.env["TELEGRAM_BOT_TOKEN"] || !username) {
      throw new Error("Telegram is not configured on this server");
    }
    const token = await issueLinkToken(context.userId, "user");
    return { url: `https://t.me/${username}?start=${token}` };
  });

export const disconnectTelegram = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("telegram_user_links")
      .update({ status: "revoked" })
      .eq("user_id", context.userId);
    return { ok: true };
  });

export const updateTelegramPrefs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { prefs: unknown }) => ({ prefs: sanitizePrefs(input?.prefs) }))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("telegram_user_links")
      .update({ prefs: data.prefs as unknown as import("@/integrations/supabase/types").Json })
      .eq("user_id", context.userId)
      .neq("status", "revoked");
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const sendTelegramTest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: link } = await supabaseAdmin
      .from("telegram_user_links")
      .select("tg_chat_id, status")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!link || link.status === "revoked") throw new Error("Telegram is not connected");
    const result = await tgNotify(
      link.tg_chat_id,
      "✅ <b>CommonRoute test</b>\n\nTelegram notifications are working.",
    );
    if (!result.ok) {
      if (result.permanent) {
        await supabaseAdmin
          .from("telegram_user_links")
          .update({ status: "needs_attention", failure_reason: "delivery_blocked" })
          .eq("user_id", context.userId);
      }
      throw new Error("The test message could not be delivered. Try reconnecting Telegram.");
    }
    await supabaseAdmin
      .from("telegram_user_links")
      .update({ last_delivery_at: new Date().toISOString(), status: "active", failure_reason: null })
      .eq("user_id", context.userId);
    return { ok: true };
  });

/* ---------------- trip event delivery ---------------- */

export type TripNotifyKind = "vote_reminder" | "itinerary_change" | "organiser_update";

const KIND_PREF: Record<TripNotifyKind, keyof TelegramPrefs> = {
  vote_reminder: "vote_reminders",
  itinerary_change: "itinerary_changes",
  organiser_update: "organiser_updates",
};

const KIND_TEXT: Record<TripNotifyKind, { text: string; button: { label: string; path: string } }> = {
  vote_reminder: {
    text: "🗳️ <b>CommonRoute</b>\n\nYour trip has items waiting for your vote.",
    button: { label: "Open voting", path: "/consensus" },
  },
  itinerary_change: {
    text: "🗺️ <b>CommonRoute</b>\n\nThe itinerary for your trip was updated.",
    button: { label: "View itinerary", path: "/itinerary" },
  },
  organiser_update: {
    text: "📣 <b>CommonRoute</b>\n\nThe organiser posted a trip update.",
    button: { label: "View update", path: "/changes" },
  },
};

/**
 * Notify linked trip members about a trip event. Called after the underlying
 * action has already succeeded — delivery failure never affects it.
 * Membership is revalidated per recipient before anything is sent.
 */
export const notifyTripTelegram = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { tripId: string; shareCode: string; kind: TripNotifyKind; eventId: string }) => {
    if (
      !input ||
      !/^[A-Za-z0-9_-]{3,64}$/.test(input.tripId ?? "") ||
      !/^[A-Za-z0-9-]{6,40}$/.test(input.shareCode ?? "") ||
      !["vote_reminder", "itinerary_change", "organiser_update"].includes(input.kind) ||
      !/^[A-Za-z0-9_-]{6,80}$/.test(input.eventId ?? "")
    ) {
      throw new Error("Invalid notification request");
    }
    return input;
  })
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // The caller must be a member of this trip, and the code must match.
    const { data: callerMembership } = await context.supabase
      .from("kintrip_memberships")
      .select("trip_id, title")
      .eq("trip_id", data.tripId)
      .eq("share_code", data.shareCode)
      .maybeSingle();
    if (!callerMembership) throw new Error("You are not a member of this trip");
    const rawTitle = (callerMembership.title ?? "").trim().slice(0, 80);
    const tripTitle = rawTitle
      ? rawTitle.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      : "";

    const { data: members } = await supabaseAdmin
      .from("kintrip_memberships")
      .select("user_id")
      .eq("trip_id", data.tripId);
    const memberIds = new Set((members ?? []).map((m) => m.user_id as string));
    // Never notify the person who triggered the event.
    memberIds.delete(context.userId);
    if (memberIds.size === 0) return { sent: 0 };

    const { data: links } = await supabaseAdmin
      .from("telegram_user_links")
      .select("user_id, tg_chat_id, prefs")
      .in("user_id", [...memberIds])
      .eq("status", "active");

    const prefKey = KIND_PREF[data.kind];
    const template = KIND_TEXT[data.kind];
    let sent = 0;
    for (const link of links ?? []) {
      // Membership revalidation: the link owner must still be a member.
      if (!memberIds.has(link.user_id)) continue;
      const prefs = sanitizePrefs(link.prefs);
      if (!prefs[prefKey]) continue;

      const idemKey = `${data.tripId}:${data.kind}:${data.eventId}:${link.user_id}`;
      const { data: existing } = await supabaseAdmin
        .from("telegram_deliveries")
        .select("id")
        .eq("idempotency_key", idemKey)
        .maybeSingle();
      if (existing) continue;

      const result = await tgNotify(link.tg_chat_id, template.text, template.button);
      await supabaseAdmin.from("telegram_deliveries").insert({
        idempotency_key: idemKey,
        chat_id: link.tg_chat_id,
        kind: data.kind,
        status: result.ok ? "sent" : result.permanent ? "blocked" : "failed",
      });
      if (result.ok) {
        sent += 1;
        await supabaseAdmin
          .from("telegram_user_links")
          .update({ last_delivery_at: new Date().toISOString() })
          .eq("user_id", link.user_id);
      } else if (result.permanent) {
        await supabaseAdmin
          .from("telegram_user_links")
          .update({ status: "needs_attention", failure_reason: "delivery_blocked" })
          .eq("user_id", link.user_id);
      }
    }
    return { sent };
  });

/* ---------------- admin destinations ---------------- */

/**
 * Operator role check. EXECUTE on admin_role_of is revoked from browser
 * sessions (so roles can't be probed), so it runs with the server client
 * against the already-verified caller id from requireSupabaseAuth.
 */
async function requireAdmin(_supabase: unknown, userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: role } = await supabaseAdmin.rpc("admin_role_of", { _user_id: userId });
  if (!role) throw new Error("Forbidden");
  return role as string;
}

export const getAdminTelegramStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("telegram_admin_destinations")
      .select("status, event_prefs")
      .eq("admin_user_id", context.userId)
      .maybeSingle();
    return {
      configured: Boolean(process.env["TELEGRAM_BOT_TOKEN"] && botUsername()),
      status: !data || data.status === "revoked" ? "disconnected" : data.status,
      eventPrefs: (data?.event_prefs ?? { operations: true, billing: true, accounts: true }) as Record<string, boolean>,
    };
  });

export const startAdminTelegramLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context.supabase, context.userId);
    const username = botUsername();
    if (!process.env["TELEGRAM_BOT_TOKEN"] || !username) {
      throw new Error("Telegram is not configured on this server");
    }
    const token = await issueLinkToken(context.userId, "admin_destination");
    return { url: `https://t.me/${username}?start=${token}` };
  });

export const disconnectAdminTelegram = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("telegram_admin_destinations")
      .update({ status: "revoked" })
      .eq("admin_user_id", context.userId);
    return { ok: true };
  });

export const sendAdminTelegramTest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: dest } = await supabaseAdmin
      .from("telegram_admin_destinations")
      .select("tg_chat_id, status")
      .eq("admin_user_id", context.userId)
      .maybeSingle();
    if (!dest || dest.status === "revoked") throw new Error("Admin Telegram is not connected");
    const result = await tgNotify(
      dest.tg_chat_id,
      "🔐 <b>ADMIN — CommonRoute</b>\n✅ Test alert\nTelegram admin alerts are working.",
    );
    if (!result.ok) {
      if (result.permanent) {
        await supabaseAdmin
          .from("telegram_admin_destinations")
          .update({ status: "needs_attention" })
          .eq("admin_user_id", context.userId);
      }
      throw new Error("The test alert could not be delivered.");
    }
    return { ok: true };
  });

/**
 * Send an operational alert to all active admin destinations. Admin-only
 * caller; content is a safe category + reference, never sensitive narratives.
 */
export const sendAdminTelegramAlert = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { category: string; summary: string; reference?: string }) => {
    if (
      !input ||
      !["operations", "billing", "accounts"].includes(input.category) ||
      typeof input.summary !== "string" ||
      input.summary.length < 3 ||
      input.summary.length > 200
    ) {
      throw new Error("Invalid alert");
    }
    return input;
  })
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: dests } = await supabaseAdmin
      .from("telegram_admin_destinations")
      .select("id, admin_user_id, tg_chat_id, event_prefs")
      .eq("status", "active");
    let sent = 0;
    for (const dest of dests ?? []) {
      const prefs = (dest.event_prefs ?? {}) as Record<string, boolean>;
      if (prefs[data.category] === false) continue;
      const text =
        `🔐 <b>ADMIN — CommonRoute</b>\n🟠 ${data.category.charAt(0).toUpperCase() + data.category.slice(1)} alert\n` +
        `${data.summary.replace(/[<>&]/g, "")}` +
        (data.reference ? `\nRef: ${data.reference.replace(/[<>&]/g, "")}` : "");
      // Admin alerts never include a link to the operations console.
      const result = await tgNotify(dest.tg_chat_id, text);
      if (result.ok) sent += 1;
      else if (result.permanent) {
        await supabaseAdmin
          .from("telegram_admin_destinations")
          .update({ status: "needs_attention" })
          .eq("id", dest.id);
      }
    }
    return { sent };
  });

/** Register the webhook with Telegram. Super-admin only; safe to re-run. */
export const registerTelegramWebhook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { publicUrl: string }) => {
    if (!input || !/^https:\/\/[A-Za-z0-9.-]+(:\d+)?$/.test(input.publicUrl ?? "")) {
      throw new Error("A public https origin is required");
    }
    return input;
  })
  .handler(async ({ data, context }) => {
    const role = await requireAdmin(context.supabase, context.userId);
    if (role !== "super_admin") throw new Error("Forbidden");
    const secret = process.env["TELEGRAM_WEBHOOK_SECRET"];
    if (!secret) throw new Error("Webhook secret is not configured");
    const result = await tgCall("setWebhook", {
      url: `${data.publicUrl}/api/public/telegram/webhook`,
      secret_token: secret,
      allowed_updates: ["message"],
      drop_pending_updates: true,
    });
    if (!result.ok) throw new Error(`Telegram rejected the webhook: ${result.error ?? "unknown"}`);
    return { ok: true, url: `${data.publicUrl}/api/public/telegram/webhook`, origin: appOrigin() };
  });
