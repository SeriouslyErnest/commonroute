import { seedAttractions } from "./seed";
import type { KintripState } from "./types";

/**
 * Trips saved before places carried a location or opening hours get those
 * blanks filled from the sample data, matched on the same place id.
 * Anything already entered is left exactly as it is.
 */
export function backfillPlaceData(state: KintripState): KintripState {
  const attractions = (state.attractions ?? []).map((a) => {
    const sample = seedAttractions.find((s) => s.id === a.id);
    if (!sample) return a;
    return {
      ...a,
      latitude: a.latitude ?? sample.latitude,
      longitude: a.longitude ?? sample.longitude,
      timeZone: a.timeZone ?? sample.timeZone,
      hours: a.hours ?? sample.hours,
      access: a.access ?? sample.access,
    };
  });
  return { ...state, attractions };
}
