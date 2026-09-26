import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";
import { hashToken, tgCall, tgNotify } from "@/lib/kintrip/telegram.server";

/**
 * CommonRoute's dedicated Telegram bot webhook.
 *
 * - HTTPS only, verified with the Telegram secret-token header.
 * - Accepts only message updates containing /start or /help; everything else
 *   is acknowledged and ignored (fail-safe).
 * - /start <token> consumes a short-lived single-use linking token (stored as
 *   a hash) and records the Telegram user/chat mapping. User links and admin
 *   destinations are separate records; a bare /start never links anything.
 * - Nothing else happens in Telegram: no voting, editing, or admin actions.
 */

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

const START_RE = /^\/start(?:@\w+)?(?:\s+([A-Za-z0-9_-]{1,64}))?$/;
const HELP_RE = /^\/help(?:@\w+)?\s*$/;

export const Route = createFileRoute("/api/public/telegram/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["TELEGRAM_WEBHOOK_SECRET"];
        if (!secret) return new Response("Not configured", { status: 503 });
        const header = request.headers.get("X-Telegram-Bot-Api-Secret-Token") ?? "";
        if (!safeEqual(header, secret)) return new Response("Unauthorized", { status: 401 });

        let update: unknown;
        try {
          update = await request.json();
        } catch {
          return Response.json({ ok: true, ignored: true });
        }
        const u = update as {
          update_id?: number;
          message?: {
            text?: string;
            from?: { id?: number };
            chat?: { id?: number; type?: string };
          };
        };
        if (typeof u.update_id !== "number" || !u.message?.chat?.id) {
          return Response.json({ ok: true, ignored: true });
        }
        // Private chats only; ignore group traffic.
        if (u.message.chat.type !== "private") {
          return Response.json({ ok: true, ignored: true });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // Idempotency: Telegram retries deliveries; process each update once.
        const { error: dupError } = await supabaseAdmin
          .from("telegram_updates")
          .insert({ update_id: u.update_id });
        if (dupError) return Response.json({ ok: true, duplicate: true });

        const chatId = u.message.chat.id;
        const tgUserId = u.message.from?.id ?? chatId;
        const text = (u.message.text ?? "").trim();

        const startMatch = START_RE.exec(text);
        if (startMatch) {
          const token = startMatch[1];
          if (!token) {
            await tgNotify(
              chatId,
              "👋 <b>CommonRoute on Telegram</b>\n\nTo connect your account, open <b>CommonRoute → Account → Telegram notifications</b> and tap <b>Connect Telegram</b>.",
            );
            return Response.json({ ok: true });
          }

          const tokenHash = await hashToken(token);
          // Consume atomically: single-use, and only while unexpired.
          const { data: consumed } = await supabaseAdmin
            .from("telegram_link_tokens")
            .update({ consumed_at: new Date().toISOString() })
            .eq("token_hash", tokenHash)
            .is("consumed_at", null)
            .gt("expires_at", new Date().toISOString())
            .select("user_id, scope")
            .maybeSingle();

          if (!consumed) {
            await tgNotify(
              chatId,
              "This connection link has expired or was already used. Open CommonRoute and tap <b>Connect Telegram</b> again for a fresh link.",
            );
            return Response.json({ ok: true });
          }

          if (consumed.scope === "admin_destination") {
            // Admin linking: verify the token owner is still an active admin.
            const { data: role } = await supabaseAdmin.rpc("admin_role_of", {
              _user_id: consumed.user_id,
            });
            if (!role) {
              await tgNotify(chatId, "This admin connection link is no longer valid.");
              return Response.json({ ok: true });
            }
            await supabaseAdmin.from("telegram_admin_destinations").upsert(
              {
                admin_user_id: consumed.user_id,
                tg_user_id: tgUserId,
                tg_chat_id: chatId,
                status: "active",
              },
              { onConflict: "admin_user_id" },
            );
            await tgNotify(
              chatId,
              "🔐 <b>ADMIN — CommonRoute</b>\n✅ Admin alerts connected. You'll receive selected operational alerts here. Manage them in the admin console.",
            );
            return Response.json({ ok: true });
          }

          await supabaseAdmin.from("telegram_user_links").upsert(
            {
              user_id: consumed.user_id,
              tg_user_id: tgUserId,
              tg_chat_id: chatId,
              status: "active",
              failure_reason: null,
              linked_at: new Date().toISOString(),
            },
            { onConflict: "user_id" },
          );
          await tgNotify(
            chatId,
            "✅ <b>CommonRoute connected</b>\n\nSelected trip updates and reminders will arrive here. Voting and planning always stay inside CommonRoute. You can disconnect anytime in Account → Telegram notifications.",
          );
          return Response.json({ ok: true });
        }

        if (HELP_RE.test(text)) {
          await tgNotify(
            chatId,
            "This bot delivers optional CommonRoute notifications.\nConnect, disconnect, and choose notification preferences inside CommonRoute (Account → Telegram notifications).",
          );
          return Response.json({ ok: true });
        }

        // Unknown command/text: gentle pointer, no account questions.
        await tgNotify(
          chatId,
          "This bot only delivers CommonRoute notifications. To plan, vote, or change settings, open the CommonRoute app.",
        );
        return Response.json({ ok: true });
      },
    },
  },
});
