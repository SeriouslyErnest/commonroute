import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { AgeGroup, KintripState, Traveller } from "./types";

/**
 * Join requests. Opening an invite link shows only the trip title. A signed-in
 * person then asks to join; the organiser approves or declines. Until approved
 * the person cannot read or change anything in the trip.
 */

const CODE_RE = /^[A-Za-z0-9-]{6,40}$/;
const TRIP_RE = /^[A-Za-z0-9_-]{3,64}$/;
const UUID_RE = /^[0-9a-f-]{36}$/i;
const AGES: AgeGroup[] = ["child", "teen", "adult", "senior"];

function code(input: { code: string }) {
  const c = typeof input?.code === "string" ? input.code.trim().toUpperCase() : "";
  if (!CODE_RE.test(c)) throw new Error("Invalid invite code");
  return { code: c };
}

function trip(input: { tripId: string }) {
  if (!input || typeof input.tripId !== "string" || !TRIP_RE.test(input.tripId)) throw new Error("Invalid trip");
  return { tripId: input.tripId };
}

function clean(v: unknown, max: number) {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

async function tripByCode(c: string) {
  const { admin } = await import("./trip-access.server");
  const db = await admin();
  const { data } = await db.from("kintrip_trips").select("trip_id, state").eq("share_code", c).maybeSingle();
  if (!data) return null;
  const state = data.state as unknown as KintripState & { deleted?: boolean };
  if (state?.deleted) return null;
  return { db, tripId: data.trip_id as string, title: state?.trip?.title ?? "A group trip" };
}

/** Public: only the trip title, so the invitee knows what they're joining. */
export const peekInvite = createServerFn({ method: "POST" })
  .inputValidator(code)
  .handler(async ({ data }) => {
    const { enforceRateLimit } = await import("./guard.server");
    enforceRateLimit("peek-invite", 30, 60_000);
    const t = await tripByCode(data.code);
    return t ? { title: t.title } : null;
  });

/** The signed-in person's standing for the trip behind an invite code. */
export const myInviteAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(code)
  .handler(async ({ data, context }) => {
    const t = await tripByCode(data.code);
    if (!t) return null;
    const { accessFor } = await import("./trip-access.server");
    const a = await accessFor(t.db, t.tripId, context.userId);
    return { tripId: t.tripId, title: t.title, status: a.status };
  });

export const requestToJoin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { code: string; name: string; relationship: string; ageGroup: string }) => {
    const c = code(input);
    const name = clean(input.name, 60);
    const relationship = clean(input.relationship, 60);
    const ageGroup = AGES.includes(input.ageGroup as AgeGroup) ? input.ageGroup : "adult";
    if (!name || !relationship) throw new Error("Please add your name and relationship");
    return { ...c, name, relationship, ageGroup };
  })
  .handler(async ({ data, context }) => {
    const { enforceRateLimit } = await import("./guard.server");
    enforceRateLimit(`join-req:${context.userId}`, 10, 60_000);
    const t = await tripByCode(data.code);
    if (!t) throw new Error("This invite link is no longer valid");
    const { accessFor, alertOrganisers } = await import("./trip-access.server");
    const a = await accessFor(t.db, t.tripId, context.userId);
    if (a.status === "approved") return { status: "approved" as const };
    if (a.status === "removed" || a.status === "declined") return { status: a.status };
    const { maskEmail } = await import("./approval.server");
    const email = typeof context.claims?.email === "string" ? context.claims.email : null;
    const { error } = await t.db.from("trip_access").upsert(
      {
        trip_id: t.tripId,
        user_id: context.userId,
        status: "pending",
        role: "member",
        traveller_id: `t${Date.now()}${Math.floor(Math.random() * 1000)}`,
        display_name: data.name,
        relationship: data.relationship,
        age_group: data.ageGroup,
        email_masked: maskEmail(email),
        requested_at: new Date().toISOString(),
      },
      { onConflict: "trip_id,user_id" },
    );
    if (error) throw new Error("Couldn't send your request");
    if (a.status === "none") void alertOrganisers(t.db, t.tripId, t.title, data.name);
    return { status: "pending" as const };
  });

export const cancelJoinRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(code)
  .handler(async ({ data, context }) => {
    const t = await tripByCode(data.code);
    if (!t) return { ok: true };
    await t.db.from("trip_access").delete().eq("trip_id", t.tripId).eq("user_id", context.userId).eq("status", "pending");
    return { ok: true };
  });

/** Organiser: everyone who asked to join, and everyone with access. */
export const listTripAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(trip)
  .handler(async ({ data, context }) => {
    const { admin, requireOrganiser } = await import("./trip-access.server");
    const db = await admin();
    await requireOrganiser(db, data.tripId, context.userId);
    const { data: rows } = await db
      .from("trip_access")
      .select("user_id, status, role, display_name, relationship, age_group, email_masked, requested_at, decided_at")
      .eq("trip_id", data.tripId)
      .order("requested_at", { ascending: true });
    return (rows ?? []).map((r) => ({
      userId: r.user_id as string,
      status: r.status as string,
      role: r.role as string,
      name: (r.display_name as string | null) ?? "Traveller",
      relationship: (r.relationship as string | null) ?? "",
      ageGroup: (r.age_group as string | null) ?? "adult",
      email: (r.email_masked as string | null) ?? "",
      requestedAt: r.requested_at as string,
      self: r.user_id === context.userId,
    }));
  });

/** Organiser: approve, decline or remove a person. */
export const decideTripAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { tripId: string; userId: string; decision: string }) => {
    const t = trip(input);
    if (!UUID_RE.test(input.userId)) throw new Error("Invalid person");
    if (!["approve", "decline", "remove"].includes(input.decision)) throw new Error("Invalid decision");
    return { ...t, userId: input.userId, decision: input.decision as "approve" | "decline" | "remove" };
  })
  .handler(async ({ data, context }) => {
    const { admin, requireOrganiser } = await import("./trip-access.server");
    const db = await admin();
    await requireOrganiser(db, data.tripId, context.userId);
    if (data.userId === context.userId) throw new Error("You can't change your own access");
    const { data: tripRow } = await db.from("kintrip_trips").select("owner_user_id, state").eq("trip_id", data.tripId).maybeSingle();
    if (!tripRow) throw new Error("Trip not found");
    if (tripRow.owner_user_id === data.userId) throw new Error("The trip creator can't be removed");
    const { data: row } = await db.from("trip_access").select("*").eq("trip_id", data.tripId).eq("user_id", data.userId).maybeSingle();
    if (!row) throw new Error("Request not found");
    const now = new Date().toISOString();
    const status = data.decision === "approve" ? "approved" : data.decision === "decline" ? "declined" : "removed";
    await db.from("trip_access").update({ status, decided_by: context.userId, decided_at: now }).eq("trip_id", data.tripId).eq("user_id", data.userId);

    if (status === "approved") {
      const state = tripRow.state as unknown as KintripState;
      const tid = (row.traveller_id as string) || `t${Date.now()}`;
      if (!state.travellers.some((t) => t.id === tid)) {
        const traveller: Traveller = {
          id: tid,
          name: (row.display_name as string) ?? "Traveller",
          relationship: (row.relationship as string) ?? "",
          ageGroup: ((row.age_group as AgeGroup) ?? "adult"),
          role: "member",
          roles: ["contributor"],
          needs: [],
          joined: true,
          prefStatus: "not_started",
          preferences: { interests: [], pace: "balanced", walking: "moderate", mustDo: "", avoid: "", constraints: "" },
        };
        const next = { ...state, travellers: [...state.travellers, traveller], cachedAt: now };
        await db.from("kintrip_trips").update({ state: next as unknown as never, updated_at: now }).eq("trip_id", data.tripId);
      }
    } else {
      await db.from("kintrip_memberships").delete().eq("trip_id", data.tripId).eq("user_id", data.userId);
    }
    return { ok: true };
  });
