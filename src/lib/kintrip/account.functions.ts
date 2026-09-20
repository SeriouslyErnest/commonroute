import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Account-linked trip membership and profile.
 *
 * Sign-in is passwordless (email link). Once signed in, the trips a person has
 * created or joined on any device are remembered against their account so the
 * same trips appear when they sign in somewhere else.
 */

export interface MembershipInput {
  tripId: string;
  shareCode: string;
  title?: string | undefined;
  destination?: string | undefined;
}

const TRIP_ID = /^[A-Za-z0-9_-]{3,64}$/;
const SHARE_CODE = /^[A-Za-z0-9-]{6,40}$/;

function clean(value: unknown, max = 120): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().slice(0, max);
  return trimmed.length ? trimmed : null;
}

function validTrips(input: { trips: MembershipInput[] }) {
  if (!input || !Array.isArray(input.trips)) throw new Error("Invalid trips");
  const trips = input.trips.slice(0, 50).filter(
    (t) => t && TRIP_ID.test(String(t.tripId)) && SHARE_CODE.test(String(t.shareCode)),
  );
  return { trips };
}

export const saveMemberships = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validTrips)
  .handler(async ({ data, context }) => {
    if (!data.trips.length) return { saved: 0 };
    const rows = data.trips.map((t) => ({
      user_id: context.userId,
      trip_id: t.tripId,
      share_code: t.shareCode,
      title: clean(t.title),
      destination: clean(t.destination),
      updated_at: new Date().toISOString(),
    }));
    const { error } = await context.supabase
      .from("kintrip_memberships")
      .upsert(rows, { onConflict: "user_id,trip_id" });
    if (error) throw new Error(error.message);
    return { saved: rows.length };
  });

export const listMemberships = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("kintrip_memberships")
      .select("trip_id, share_code, title, destination, updated_at")
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map((row) => ({
      tripId: row.trip_id,
      shareCode: row.share_code,
      title: row.title,
      destination: row.destination,
      updatedAt: row.updated_at,
    }));
  });

export const removeMembership = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { tripId: string }) => {
    if (!input || !TRIP_ID.test(String(input.tripId))) throw new Error("Invalid trip");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("kintrip_memberships")
      .delete()
      .eq("trip_id", data.tripId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("profiles")
      .select("id, email, display_name")
      .eq("id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (data) return { id: data.id, email: data.email, displayName: data.display_name };
    return { id: context.userId, email: null as string | null, displayName: null as string | null };
  });

export const updateProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { displayName: string }) => {
    const name = clean(input?.displayName, 60);
    if (!name) throw new Error("Please enter a name");
    return { displayName: name };
  })
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("profiles")
      .upsert(
        { id: context.userId, display_name: data.displayName, updated_at: new Date().toISOString() },
        { onConflict: "id" },
      );
    if (error) throw new Error(error.message);
    return { displayName: data.displayName };
  });
