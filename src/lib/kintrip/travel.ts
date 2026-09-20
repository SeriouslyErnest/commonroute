import type { Attraction, ItineraryDay, ItineraryItem, KintripState } from "./types";

/** Straight-line distance in km between two points. */
export function distanceKm(
  a: { latitude?: undefined | number; longitude?: undefined | number },
  b: { latitude?: undefined | number; longitude?: undefined | number },
): number | null {
  if (a.latitude == null || a.longitude == null || b.latitude == null || b.longitude == null) return null;
  const R = 6371;
  const toRad = (v: number) => (v * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(h));
}

export interface TravelEstimate {
  /** Realistic door-to-door minutes, including getting out and finding the way. */
  minutes: number;
  km: number | null;
  mode: "walk" | "transport";
  /** True when we had no coordinates and used a safe default. */
  assumed: boolean;
}

/** A realistic allowance for getting from one stop to the next. */
export function travelEstimate(from: Attraction | undefined, to: Attraction | undefined): TravelEstimate {
  const km = from && to ? distanceKm(from, to) : null;
  if (km == null) return { minutes: 20, km: null, mode: "transport", assumed: true };
  if (km <= 1.2) {
    // Walking pace on holiday, with crossings and a slower group.
    return { minutes: Math.max(5, Math.round(km * 15) + 5), km, mode: "walk", assumed: false };
  }
  // Waiting, the ride itself, and the walk at each end.
  return { minutes: Math.round(km * 3) + 15, km, mode: "transport", assumed: false };
}

export const toMinutes = (hhmm: string) => {
  const [h, m] = (hhmm || "0:0").split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};

export const fromMinutes = (mins: number) => {
  const m = ((mins % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
};

export const sortItems = (items: ItineraryItem[]) =>
  [...items].sort((a, b) => toMinutes(a.start) - toMinutes(b.start));

export interface TravelGap {
  afterItemId: string;
  beforeItemId: string;
  estimate: TravelEstimate;
  /** Minutes actually left between the two stops. */
  gap: number;
  tight: boolean;
}

/** Travel allowances between the stops of one day. */
export function travelGaps(state: KintripState, day: ItineraryDay): TravelGap[] {
  const items = sortItems(day.items);
  const byId = new Map(state.attractions.map((a) => [a.id, a]));
  const gaps: TravelGap[] = [];
  for (let i = 0; i < items.length - 1; i += 1) {
    const a = items[i]!;
    const b = items[i + 1]!;
    const estimate = travelEstimate(
      a.attractionId ? byId.get(a.attractionId) : undefined,
      b.attractionId ? byId.get(b.attractionId) : undefined,
    );
    const gap = toMinutes(b.start) - (toMinutes(a.start) + a.durationMin);
    gaps.push({ afterItemId: a.id, beforeItemId: b.id, estimate, gap, tight: gap < estimate.minutes });
  }
  return gaps;
}

/* ---------------- comfort and meals ---------------- */

export interface ComfortNote {
  id: string;
  text: string;
  fix?: undefined | { kind: "meal" | "rest"; title: string; start: string; durationMin: number };
  severity: "watch" | "fine";
}

const hasKindBetween = (items: ItineraryItem[], kind: string, from: number, to: number) =>
  items.some((i) => i.kind === kind && toMinutes(i.start) >= from && toMinutes(i.start) <= to);

/** Plain checks on one day: meals, rests and long stretches on the go. */
export function comfortReview(state: KintripState, day: ItineraryDay): ComfortNote[] {
  const items = sortItems(day.items);
  const notes: ComfortNote[] = [];
  if (items.length === 0) return notes;

  const first = toMinutes(items[0]!.start);
  const last = toMinutes(items[items.length - 1]!.start) + items[items.length - 1]!.durationMin;

  if (first <= 12 * 60 && last >= 13 * 60 && !hasKindBetween(items, "meal", 11 * 60, 14 * 60 + 30)) {
    notes.push({
      id: `lunch-${day.day}`,
      text: "No lunch break between 11:00 and 14:30.",
      fix: { kind: "meal", title: "Lunch together", start: "12:30", durationMin: 60 },
      severity: "watch",
    });
  }
  if (last >= 19 * 60 && !hasKindBetween(items, "meal", 17 * 60, 20 * 60 + 30)) {
    notes.push({
      id: `dinner-${day.day}`,
      text: "The day runs into the evening with no dinner break.",
      fix: { kind: "meal", title: "Dinner together", start: "18:30", durationMin: 75 },
      severity: "watch",
    });
  }

  // Longest stretch with no rest or meal.
  let stretchStart = first;
  let worst = 0;
  let worstEnd = first;
  for (const i of items) {
    if (i.kind === "rest" || i.kind === "meal") {
      stretchStart = toMinutes(i.start) + i.durationMin;
      continue;
    }
    const end = toMinutes(i.start) + i.durationMin;
    if (end - stretchStart > worst) {
      worst = end - stretchStart;
      worstEnd = end;
    }
  }
  const needsRest = state.travellers.some((t) =>
    (t.needs ?? []).some((n) => n.type === "rest_window" || n.severity === "hard_limit"),
  );
  if (worst >= (needsRest ? 180 : 240)) {
    notes.push({
      id: `rest-${day.day}`,
      text: `${Math.round(worst / 60)} hours on the go with no sit-down break.`,
      fix: { kind: "rest", title: "Sit-down break", start: fromMinutes(worstEnd), durationMin: 45 },
      severity: "watch",
    });
  }

  const gaps = travelGaps(state, day);
  const tight = gaps.filter((g) => g.tight).length;
  if (tight > 0) {
    notes.push({
      id: `travel-${day.day}`,
      text: `${tight} ${tight === 1 ? "hop" : "hops"} between stops look tight once travel time is counted.`,
      severity: "watch",
    });
  }

  if (notes.length === 0) {
    notes.push({ id: `ok-${day.day}`, text: "Meals, breaks and travel time all look comfortable.", severity: "fine" });
  }
  return notes;
}
