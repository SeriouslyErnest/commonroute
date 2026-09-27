/**
 * Sign-up approval gate and admin sign-up alerts (server-only).
 *
 * - Settings live in the server-only `app_settings` table (key "signups").
 * - Alerts go to active operators' Telegram destinations (category "accounts").
 * - Alerts never contain a link to the operations console, and never throw.
 */
import { tgNotify } from "./telegram.server";

export interface SignupSettings {
  approvalRequired: boolean;
  alertPending: boolean;
  alertFirstEntry: boolean;
}

export const DEFAULT_SIGNUP_SETTINGS: SignupSettings = {
  approvalRequired: false,
  alertPending: true,
  alertFirstEntry: true,
};

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export async function readSignupSettings(): Promise<SignupSettings> {
  const db = await admin();
  const { data } = await db.from("app_settings").select("value").eq("key", "signups").maybeSingle();
  const v = (data?.value ?? {}) as Record<string, unknown>;
  const pick = (k: keyof SignupSettings) =>
    typeof v[k] === "boolean" ? (v[k] as boolean) : DEFAULT_SIGNUP_SETTINGS[k];
  return {
    approvalRequired: pick("approvalRequired"),
    alertPending: pick("alertPending"),
    alertFirstEntry: pick("alertFirstEntry"),
  };
}

export function maskEmail(email: string | null | undefined): string {
  if (!email || !email.includes("@")) return "unknown";
  const [local = "", domain = ""] = email.split("@");
  const masked = local.length <= 2 ? `${local[0] ?? ""}*` : `${local[0]}***${local[local.length - 1]}`;
  return `${masked}@${domain}`.replace(/[<>&]/g, "");
}

function utcStamp(): string {
  return new Date().toISOString().slice(0, 16).replace("T", " ") + " UTC";
}

/** Send an accounts-category alert to active operators. Never throws; no links. */
export async function alertOperators(kind: "pending" | "entered", email: string | null) {
  try {
    const db = await admin();
    const { data: ops } = await db.from("app_admins").select("user_id").eq("status", "active");
    const opIds = (ops ?? []).map((o) => o.user_id as string);
    if (!opIds.length) return;
    const { data: dests } = await db
      .from("telegram_admin_destinations")
      .select("id, tg_chat_id, event_prefs")
      .in("admin_user_id", opIds)
      .eq("status", "active");
    const who = maskEmail(email);
    const text =
      kind === "pending"
        ? `🔐 <b>ADMIN — CommonRoute</b>\n🟡 New account waiting for approval\n\nEmail: ${who}\nSigned up: ${utcStamp()}`
        : `🔐 <b>ADMIN — CommonRoute</b>\nℹ️ ${who} has entered the app for the first time\n\nEntered: ${utcStamp()}`;
    for (const d of dests ?? []) {
      const prefs = (d.event_prefs ?? {}) as Record<string, boolean>;
      if (prefs["accounts"] === false) continue;
      const r = await tgNotify(d.tg_chat_id, text);
      if (!r.ok && r.permanent) {
        await db.from("telegram_admin_destinations").update({ status: "needs_attention" }).eq("id", d.id);
      }
    }
  } catch {
    /* alerts never block sign-in */
  }
}

export type ApprovalState = "approved" | "pending" | "rejected";

/** Whether this account may write (used by server actions). Operators always pass. */
export async function approvalBlocks(userId: string): Promise<ApprovalState | null> {
  const settings = await readSignupSettings();
  if (!settings.approvalRequired) return null;
  const db = await admin();
  const { data: op } = await db.from("app_admins").select("user_id").eq("user_id", userId).eq("status", "active").maybeSingle();
  if (op) return null;
  const { data } = await db.from("account_approvals").select("status").eq("user_id", userId).maybeSingle();
  const status = (data?.status ?? "pending") as ApprovalState;
  return status === "approved" ? null : status;
}
