import { createServerFn } from "@tanstack/react-start";
import type { KintripState } from "./types";
import { generateExport, type ExportOptions } from "./export";

interface GenerateExportInput {
  /** Cloud/shared trips: pass the invite code to fetch from the backend. */
  shareCode?: string;
  /** Local/demo trips: pass the full state when there is no share code. */
  state?: KintripState;
  options: ExportOptions;
}

function isValidCode(code: unknown): code is string {
  return typeof code === "string" && /^[A-Za-z0-9-]{6,40}$/.test(code);
}

function safeState(state: unknown): KintripState {
  if (!state || typeof state !== "object" || Array.isArray(state)) {
    throw new Error("Invalid trip data");
  }
  const json = JSON.stringify(state);
  if (!json || json.length > 512 * 1024) {
    throw new Error("This trip is too large to export");
  }
  return JSON.parse(json) as KintripState;
}

/**
 * Generates a downloadable export (CSV or ICS) for a trip.
 *
 * For shared trips the invite code is used to fetch the canonical state from
 * the backend, enforcing that the caller is still a member. For local/demo
 * trips the client may pass the state directly because the data never leaves
 * the device and there is no cloud record to authenticate against.
 */
export const exportTrip = createServerFn({ method: "POST" })
  .inputValidator((input: GenerateExportInput) => {
    if (!input || !input.options || typeof input.options !== "object") {
      throw new Error("Missing export options");
    }
    const options = input.options as ExportOptions;
    if (!options.format || (options.format !== "csv" && options.format !== "ics")) {
      throw new Error("Invalid export format");
    }
    if (options.format === "csv" && options.csvPreset && options.csvPreset !== "mymaps" && options.csvPreset !== "readable") {
      throw new Error("Invalid CSV preset");
    }
    if (options.alarmMinutes != null && (typeof options.alarmMinutes !== "number" || options.alarmMinutes < 0)) {
      throw new Error("Invalid alarm value");
    }

    if (input.shareCode) {
      if (!isValidCode(input.shareCode)) throw new Error("Invalid invite code");
      return { shareCode: input.shareCode, options };
    }
    if (!input.state) {
      throw new Error("Provide a share code or trip state");
    }
    return { state: safeState(input.state), options };
  })
  .handler(async ({ data }) => {
    let state: KintripState;
    const options = data.options;

    if (data.shareCode) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: row, error } = await supabaseAdmin
        .from("kintrip_trips")
        .select("trip_id, state")
        .eq("share_code", data.shareCode)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!row) throw new Error("Trip not found or invite code expired");
      state = safeState(row.state);
    } else {
      state = data.state!;
    }

    // When a format-appropriate revision is not supplied, fall back to the
    // latest published revision (or the current itinerary version if nothing
    // has been published yet).
    const revision =
      options.revision ||
      (state.itinerary?.published ? state.itinerary.version : undefined) ||
      state.itinerary?.version ||
      1;

    const result = generateExport(state, { ...options, revision });
    return {
      filename: result.filename,
      mimeType: result.mimeType,
      content: result.content,
      includedCount: result.includedCount,
      omitted: result.omitted,
      revision: result.revision,
      generatedAt: result.generatedAt,
    };
  });
