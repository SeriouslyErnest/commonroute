/**
 * Trip access rules. An invite link only reveals a trip's title; seeing or
 * changing the plan needs a signed-in account that the organiser approved.
 */

export type AccessStatus = "none" | "pending" | "approved" | "declined" | "removed";

export interface AccessInfo {
  status: AccessStatus;
  organiser: boolean;
  travellerId: string | null;
}

type Admin = (typeof import("@/integrations/supabase/client.server"))["supabaseAdmin"];

export async function admin(): Promise<Admin> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export async function accessFor(db: Admin, tripId: string, userId: string): Promise<AccessInfo> {
  const [{ data: trip }, { data: row }] = await Promise.all([
    db.from("kintrip_trips").select("owner_user_id").eq("trip_id", tripId).maybeSingle(),
    db.from("trip_access").select("status, role, traveller_id").eq("trip_id", tripId).eq("user_id", userId).maybeSingle(),
  ]);
  if (trip?.owner_user_id === userId) {
    return { status: "approved", organiser: true, travellerId: row?.traveller_id ?? null };
  }
  if (!row) return { status: "none", organiser: false, travellerId: null };
  const status = row.status as AccessStatus;
  return {
    status,
    organiser: status === "approved" && row.role === "organiser",
    travellerId: row.traveller_id ?? null,
  };
}

export async function requireOrganiser(db: Admin, tripId: string, userId: string) {
  const a = await accessFor(db, tripId, userId);
  if (!a.organiser) throw new Error("Only the trip organiser can do this");
}

export async function requireApproved(db: Admin, tripId: string, userId: string) {
  const a = await accessFor(db, tripId, userId);
  if (a.status !== "approved") throw new Error("You don't have access to this trip yet");
  return a;
}

function esc(s: string) {
  return s.replace(/[&<>]/g, (c) => (c === "&" ? "&amp;" : c === "<" ? "&lt;" : "&gt;"));
}

/** Tell organisers on Telegram that someone asked to join. Never blocks the request. */
export async function alertOrganisers(db: Admin, tripId: string, tripTitle: string, name: string) {
  try {
    const { data: trip } = await db.from("kintrip_trips").select("owner_user_id").eq("trip_id", tripId).maybeSingle();
    const { data: orgs } = await db
      .from("trip_access")
      .select("user_id")
      .eq("trip_id", tripId)
      .eq("status", "approved")
      .eq("role", "organiser");
    const ids = new Set<string>((orgs ?? []).map((o) => o.user_id as string));
    if (trip?.owner_user_id) ids.add(trip.owner_user_id as string);
    if (!ids.size) return;
    const { data: links } = await db
      .from("telegram_user_links")
      .select("tg_chat_id, status, prefs")
      .in("user_id", [...ids]);
    const { tgNotify } = await import("./telegram.server");
    for (const l of links ?? []) {
      const prefs = (l.prefs ?? {}) as Record<string, unknown>;
      if (l.status !== "active" || prefs["organiser_updates"] === false) continue;
      await tgNotify(
        Number(l.tg_chat_id),
        `<b>${esc(tripTitle)}</b>\n${esc(name)} has asked to join this trip. Open CommonRoute to approve or decline.`,
      );
    }
  } catch {
    /* alerts are best-effort */
  }
}
