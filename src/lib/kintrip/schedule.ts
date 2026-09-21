import { reviewAccess } from "./access";
import { resolveHours } from "./hours";
import { travelGaps } from "./travel";
import type { Attraction, ItineraryDay, KintripState } from "./types";

export type CheckSeverity = "block" | "warn" | "unknown";

export interface DayCheck {
  id: string;
  severity: CheckSeverity;
  text: string;
  itemId?: undefined | string;
  attractionId?: undefined | string;
}

export interface DayValidation {
  checks: DayCheck[];
  /** True when nothing is knowingly impossible — unknowns may still remain. */
  feasible: boolean;
  /** True when some fact could not be verified for this date. */
  provisional: boolean;
}

/**
 * Validate a whole day: opening hours on the real date, booked slots, travel
 * allowances and the journey home. Known-impossible things are blocks;
 * missing facts are unknowns and are never quietly treated as fine.
 */
export function validateDay(state: KintripState, day: ItineraryDay): DayValidation {
  const byId = new Map(state.attractions.map((a) => [a.id, a] as const));
  const checks: DayCheck[] = [];

  for (const item of day.items) {
    if (item.kind !== "activity" || !item.attractionId) continue;
    const place: Attraction | undefined = byId.get(item.attractionId);
    if (!place) continue;

    const hours = resolveHours(place, day.date, item.start, item.durationMin);
    if (hours.outcome === "closed") {
      checks.push({
        id: `${day.day}-${item.id}-closed`,
        severity: "block",
        text: `${place.name}: ${hours.message}`,
        itemId: item.id,
        attractionId: place.id,
      });
    } else if (hours.outcome === "exceeds_closing" || hours.outcome === "last_admission_missed") {
      checks.push({
        id: `${day.day}-${item.id}-hours`,
        severity: "block",
        text: `${place.name}: ${hours.message}`,
        itemId: item.id,
        attractionId: place.id,
      });
    } else if (hours.outcome === "unknown" || hours.outcome === "needs_check") {
      checks.push({
        id: `${day.day}-${item.id}-hoursunknown`,
        severity: "unknown",
        text: `${place.name}: ${hours.message}`,
        itemId: item.id,
        attractionId: place.id,
      });
    }

    const finish = endOf(item.start, item.durationMin);
    for (const issue of reviewAccess(place, finish)) {
      checks.push({
        id: `${day.day}-${item.id}-${issue.id}`,
        severity: issue.severity === "block" ? "block" : "warn",
        text: issue.text,
        itemId: item.id,
        attractionId: place.id,
      });
    }
  }

  // A confirmed, timed booking is a fixed point in the day.
  for (const booking of state.bookings) {
    if (booking.status !== "confirmed" || !booking.startLocal) continue;
    if (booking.startLocal.slice(0, 10) !== day.date) continue;
    if (!booking.attractionId) continue;
    const item = day.items.find((i) => i.attractionId === booking.attractionId);
    if (!item) continue;
    const bookedStart = booking.startLocal.slice(11, 16);
    if (bookedStart && bookedStart !== item.start) {
      checks.push({
        id: `${day.day}-${booking.id}-slot`,
        severity: "block",
        text: `${booking.title} is booked for ${bookedStart} but the plan starts it at ${item.start}.`,
        itemId: item.id,
      });
    }
  }

  for (const gap of travelGaps(state, day)) {
    if (!gap.tight) continue;
    checks.push({
      id: `${day.day}-${gap.afterItemId}-travel`,
      severity: "warn",
      text: `Only ${Math.max(0, gap.gap)} minutes between two stops; about ${gap.estimate.minutes} are needed to get there.`,
      itemId: gap.afterItemId,
    });
  }

  return {
    checks,
    feasible: !checks.some((c) => c.severity === "block"),
    provisional: checks.some((c) => c.severity === "unknown"),
  };
}

function endOf(start: string, durationMin: number): string {
  const [h, m] = start.split(":").map(Number);
  const total = (h ?? 0) * 60 + (m ?? 0) + durationMin;
  const wrapped = ((total % 1440) + 1440) % 1440;
  return `${String(Math.floor(wrapped / 60)).padStart(2, "0")}:${String(wrapped % 60).padStart(2, "0")}`;
}

/** One-line status for a whole plan, used before publishing. */
export function validatePlan(state: KintripState): { checks: DayCheck[]; feasible: boolean; provisional: boolean } {
  const days = state.itinerary?.days ?? [];
  const all = days.flatMap((d) => validateDay(state, d).checks);
  return {
    checks: all,
    feasible: !all.some((c) => c.severity === "block"),
    provisional: all.some((c) => c.severity === "unknown"),
  };
}
