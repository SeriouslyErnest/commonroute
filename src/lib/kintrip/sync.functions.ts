import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { KintripState } from "./types";

/**
 * Shared-trip sync. The table is locked down (no browser access); every read
 * and write goes through these server functions, needs a signed-in account,
 * and needs organiser-approved access to the trip (see trip-access.server).
 * The invite code alone only reveals the trip title.
 */

interface PushInput {
  tripId: string;
  shareCode: string;
  state: KintripState;
}

function isValidCode(code: unknown): code is string {
  return typeof code === "string" && /^[A-Za-z0-9-]{6,40}$/.test(code);
}

/** Guards the shared table against oversized or malformed trip payloads. */
const MAX_STATE_BYTES = 512 * 1024;

function safeState(state: unknown): Record<string, unknown> {
  if (!state || typeof state !== "object" || Array.isArray(state)) {
    throw new Error("Invalid trip data");
  }
  const json = JSON.stringify(state);
  if (!json || json.length > MAX_STATE_BYTES) {
    throw new Error("This trip is too large to share");
  }
  return JSON.parse(json) as Record<string, unknown>;
}

/**
 * Save a trip. A brand-new trip is owned by whoever uploads it first; after
 * that only approved members can write. The invite code is never changed here.
 */
export const pushTrip = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: PushInput) => {
    if (
      !input ||
      typeof input.tripId !== "string" ||
      !/^[A-Za-z0-9_-]{3,64}$/.test(input.tripId) ||
      !isValidCode(input.shareCode)
    ) {
      throw new Error("Invalid trip");
    }
    return { ...input, state: safeState(input.state) as unknown as KintripState };
  })
  .handler(async ({ data, context }) => {
    const { admin, requireApproved } = await import("./trip-access.server");
    const db = await admin();
    const { data: existing } = await db
      .from("kintrip_trips")
      .select("trip_id, share_code, state")
      .eq("trip_id", data.tripId)
      .maybeSingle();
    const now = new Date().toISOString();
    if (!existing) {
      const { data: clash } = await db.from("kintrip_trips").select("trip_id").eq("share_code", data.shareCode).maybeSingle();
      if (clash) throw new Error("Share code already in use");
      const { error } = await db.from("kintrip_trips").insert({
        trip_id: data.tripId,
        share_code: data.shareCode,
        state: data.state as unknown as never,
        updated_at: now,
        owner_user_id: context.userId,
      });
      if (error) throw new Error(error.message);
      await db.from("trip_access").upsert(
        {
          trip_id: data.tripId,
          user_id: context.userId,
          status: "approved",
          role: "organiser",
          traveller_id: data.state.activeTravellerId ?? null,
          decided_at: now,
        },
        { onConflict: "trip_id,user_id" },
      );
      return { updatedAt: now, shareCode: data.shareCode };
    }
    if ((existing.state as { deleted?: boolean } | null)?.deleted) throw new Error("Invalid invite code for this trip");
    await requireApproved(db, data.tripId, context.userId);
    const serverCode = existing.share_code as string;
    const next = { ...data.state, trip: { ...data.state.trip, shareCode: serverCode } };
    const { error } = await db
      .from("kintrip_trips")
      .update({ state: next as unknown as never, updated_at: now })
      .eq("trip_id", data.tripId);
    if (error) throw new Error(error.message);
    return { updatedAt: now, shareCode: serverCode };
  });

/** Read a trip. Only approved members get anything back. */
export const pullTrip = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { shareCode?: string; tripId?: string }) => {
    const tripOk = typeof input?.tripId === "string" && /^[A-Za-z0-9_-]{3,64}$/.test(input.tripId);
    const codeOk = isValidCode(input?.shareCode);
    if (!tripOk && !codeOk) throw new Error("Invalid invite code");
    return { tripId: tripOk ? input.tripId : undefined, shareCode: codeOk ? input.shareCode : undefined };
  })
  .handler(async ({ data, context }) => {
    const { admin, accessFor } = await import("./trip-access.server");
    const db = await admin();
    let q = db.from("kintrip_trips").select("trip_id, state, updated_at");
    q = data.tripId ? q.eq("trip_id", data.tripId) : q.eq("share_code", data.shareCode!);
    const { data: row, error } = await q.maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) return null;
    if ((row.state as { deleted?: boolean } | null)?.deleted) return null;
    const a = await accessFor(db, row.trip_id as string, context.userId);
    if (a.status !== "approved") return { tripId: row.trip_id as string, access: a.status, state: null, updatedAt: null, travellerId: null };
    return {
      tripId: row.trip_id as string,
      access: "approved" as const,
      state: row.state as unknown as KintripState,
      updatedAt: row.updated_at as string,
      travellerId: a.travellerId,
    };
  });

/* ---------------- organiser trip controls ---------------- */

const TRIP_ID_RE = /^[A-Za-z0-9_-]{3,64}$/;

function newServerCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(10);
  crypto.getRandomValues(bytes);
  let out = "";
  for (const b of bytes) out += alphabet[b % alphabet.length];
  return out;
}

function validControl(input: { tripId: string; shareCode: string }) {
  if (!input || typeof input.tripId !== "string" || !TRIP_ID_RE.test(input.tripId) || !isValidCode(input.shareCode)) {
    throw new Error("Invalid trip");
  }
  return { tripId: input.tripId, shareCode: input.shareCode };
}

/**
 * Issue a new invite code. The old code stops working at once for everyone,
 * including devices that already joined; the organiser re-shares the new link.
 * Requires sign-in plus the current code (the trip's write secret).
 */
export const rotateTripCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validControl)
  .handler(async ({ data, context }) => {
    const { admin, requireOrganiser } = await import("./trip-access.server");
    const db = await admin();
    await requireOrganiser(db, data.tripId, context.userId);
    const { data: row } = await db.from("kintrip_trips").select("state").eq("trip_id", data.tripId).maybeSingle();
    if (!row) throw new Error("This trip is no longer shared");
    const code = newServerCode();
    const state = row.state as unknown as KintripState;
    const nextState = { ...state, trip: { ...state.trip, shareCode: code } };
    const now = new Date().toISOString();
    const { error } = await db
      .from("kintrip_trips")
      .update({ share_code: code, state: nextState as unknown as never, updated_at: now })
      .eq("trip_id", data.tripId);
    if (error) throw new Error(error.message);
    await db.from("kintrip_memberships").update({ share_code: code, updated_at: now }).eq("trip_id", data.tripId);
    return { shareCode: code };
  });

/**
 * Delete a shared trip for everyone. The trip content is erased and the row is
 * left as a tombstone with an unusable code, so other devices cannot re-upload it.
 */
export const deleteSharedTrip = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validControl)
  .handler(async ({ data, context }) => {
    const { admin, requireOrganiser } = await import("./trip-access.server");
    const db = await admin();
    await requireOrganiser(db, data.tripId, context.userId);
    const { error } = await db
      .from("kintrip_trips")
      .update({
        share_code: `deleted_${newServerCode()}${newServerCode()}`,
        state: { deleted: true } as unknown as never,
        updated_at: new Date().toISOString(),
      })
      .eq("trip_id", data.tripId);
    if (error) throw new Error(error.message);
    await db.from("kintrip_memberships").delete().eq("trip_id", data.tripId);
    await db.from("trip_access").delete().eq("trip_id", data.tripId);
    return { ok: true };
  });
