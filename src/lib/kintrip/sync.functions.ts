import { createServerFn } from "@tanstack/react-start";
import type { KintripState } from "./types";

/**
 * Shared-trip sync. The table is locked down (no browser access); every read
 * and write goes through these server functions and needs the trip's share
 * code, which acts as the invite secret.
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

export const pushTrip = createServerFn({ method: "POST" })
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
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: existing } = await supabaseAdmin
      .from("kintrip_trips")
      .select("trip_id, share_code")
      .or(`share_code.eq.${data.shareCode},trip_id.eq.${data.tripId}`);
    for (const row of existing ?? []) {
      // A trip may only be written by someone holding its own invite code, and
      // an invite code may only ever point at the trip it was issued for.
      if (row.share_code === data.shareCode && row.trip_id !== data.tripId) {
        throw new Error("Share code already in use");
      }
      if (row.trip_id === data.tripId && row.share_code !== data.shareCode) {
        throw new Error("Invalid invite code for this trip");
      }
    }
    const { data: row, error } = await supabaseAdmin
      .from("kintrip_trips")
      .upsert(
        {
          trip_id: data.tripId,
          share_code: data.shareCode,
          state: data.state as unknown as Record<string, unknown>,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "trip_id" },
      )
      .select("updated_at")
      .single();
    if (error) throw new Error(error.message);
    return { updatedAt: row.updated_at as string };
  });

export const pullTrip = createServerFn({ method: "POST" })
  .inputValidator((input: { shareCode: string }) => {
    if (!input || !isValidCode(input.shareCode)) throw new Error("Invalid invite code");
    return input;
  })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("kintrip_trips")
      .select("trip_id, state, updated_at")
      .eq("share_code", data.shareCode)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) return null;
    return {
      tripId: row.trip_id as string,
      state: row.state as unknown as KintripState,
      updatedAt: row.updated_at as string,
    };
  });
