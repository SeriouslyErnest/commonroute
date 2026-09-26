import { trackEvent } from "./commerce.functions";
import type { KintripState } from "./types";

const DEMO_TRIP_ID = "tan-japan-2027";

/** Fire-and-forget product count. Never sent for the local-only demo trip. */
export function trackProduct(state: KintripState, name: string, props: Record<string, unknown> = {}) {
  if (state.trip.id === DEMO_TRIP_ID) return;
  void trackEvent({ data: { name, tripId: state.trip.id, props } }).catch(() => {});
}
