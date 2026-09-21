import { metresBetween } from "./geo";
import type { Attraction, ItineraryDay, KintripState, Scenario, StayOption } from "./types";

/**
 * Comparison maths for places to stay (P06), plan alternatives (P07) and the
 * money side of replanning (P08). Remixed from the original Kintrip project.
 *
 * These functions never invent a number. Where the group has not recorded
 * something — coordinates, a price, a refund policy — the result says unknown
 * rather than guessing.
 */

const WALK_METRES_PER_MIN = 75; // ~4.5 km/h, an unhurried group pace

export interface StayComparison {
  optionId: string;
  name: string;
  /** Median straight-line travel minutes to the trip's scheduled places. */
  medianMinutes: number | null;
  reachable: number;
  unknown: number;
  nightsCostMinor: number | null;
  furthest: { title: string; minutes: number } | null;
}

function scheduledPlaces(state: KintripState): Attraction[] {
  const ids = new Set<string>();
  for (const day of state.itinerary?.days ?? []) {
    for (const item of day.items) if (item.attractionId) ids.add(item.attractionId);
  }
  if (ids.size === 0) {
    for (const a of state.attractions) {
      if (state.suggestions[a.id]?.status === "approved") ids.add(a.id);
    }
  }
  return state.attractions.filter((a) => ids.has(a.id));
}

export function nightsBetween(start: string, end: string): number | null {
  const a = Date.parse(`${start}T00:00:00Z`);
  const b = Date.parse(`${end}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b) || b <= a) return null;
  return Math.round((b - a) / (24 * 3600 * 1000));
}

/** Compares each candidate base against the places the group actually plans to visit. */
export function compareStays(state: KintripState, options: StayOption[]): StayComparison[] {
  const places = scheduledPlaces(state);
  const nights = nightsBetween(state.trip.startDate, state.trip.endDate);
  return options.map((o) => {
    if (o.lat == null || o.lon == null) {
      return {
        optionId: o.id,
        name: o.name,
        medianMinutes: null,
        reachable: 0,
        unknown: places.length,
        nightsCostMinor: nights != null && o.nightlyCostMinor != null ? nights * o.nightlyCostMinor : null,
        furthest: null,
      };
    }
    const minutes: { title: string; minutes: number }[] = [];
    let unknown = 0;
    for (const p of places) {
      if (p.latitude == null || p.longitude == null) {
        unknown += 1;
        continue;
      }
      const metres = metresBetween(o.lat, o.lon, p.latitude, p.longitude);
      minutes.push({ title: p.name, minutes: Math.round(metres / WALK_METRES_PER_MIN) });
    }
    minutes.sort((a, b) => a.minutes - b.minutes);
    const median =
      minutes.length === 0
        ? null
        : minutes.length % 2
          ? minutes[(minutes.length - 1) / 2]!.minutes
          : Math.round((minutes[minutes.length / 2 - 1]!.minutes + minutes[minutes.length / 2]!.minutes) / 2);
    return {
      optionId: o.id,
      name: o.name,
      medianMinutes: median,
      reachable: minutes.length,
      unknown,
      nightsCostMinor: nights != null && o.nightlyCostMinor != null ? nights * o.nightlyCostMinor : null,
      furthest: minutes.length ? minutes[minutes.length - 1]! : null,
    };
  });
}

/* ---------------- plan alternatives ---------------- */

function dayTravelMinutes(state: KintripState, day: ItineraryDay): number {
  let total = 0;
  const byId = new Map(state.attractions.map((a) => [a.id, a]));
  let previous: Attraction | undefined;
  for (const item of day.items) {
    const place = item.attractionId ? byId.get(item.attractionId) : undefined;
    if (place?.latitude != null && place.longitude != null) {
      if (previous?.latitude != null && previous.longitude != null) {
        total += Math.round(
          metresBetween(previous.latitude, previous.longitude, place.latitude, place.longitude) /
            WALK_METRES_PER_MIN,
        );
      }
      previous = place;
    }
  }
  return total;
}

/**
 * Builds up to three alternatives from the current plan. Only approved places
 * are used, locked stops are never touched, and nothing is applied to the plan
 * — an organiser accepts one, and the owner publishes it.
 */
export function buildScenarios(state: KintripState, createdBy: string): Scenario[] {
  const itinerary = state.itinerary;
  if (!itinerary) return [];
  const baseTravel = itinerary.days.reduce((sum, d) => sum + dayTravelMinutes(state, d), 0);
  const now = new Date().toISOString();
  const out: Scenario[] = [];

  const moveable = itinerary.days.flatMap((d) =>
    d.items
      .filter((i) => !i.locked && i.kind !== "travel" && i.rigidity !== "anchor")
      .map((i) => ({ day: d.day, item: i })),
  );

  // 1. A calmer plan: drop the most optional stop on the fullest day.
  const fullest = [...itinerary.days].sort((a, b) => b.items.length - a.items.length)[0];
  const droppable = moveable.filter((m) => m.day === fullest?.day && m.item.rigidity === "flex");
  if (fullest && droppable.length > 0) {
    out.push({
      id: `sc-${Math.random().toString(36).slice(2, 10)}`,
      label: "A calmer version",
      summary: `Day ${fullest.day} loses one optional stop so the group has a real break.`,
      baselineRevision: itinerary.version,
      createdAt: now,
      createdBy,
      changes: [`Remove “${droppable[0]!.item.title}” from day ${fullest.day}`],
      travelMinutesDelta: -Math.round(baseTravel / Math.max(1, itinerary.days.length) / 3),
      costDeltaMinor: null,
      warnings: ["Check whether anyone has already paid for the dropped stop."],
      outdated: false,
      accepted: false,
    });
  }

  // 2. Less travelling: group each day's stops by how close they are.
  const scattered = itinerary.days
    .map((d) => ({ day: d.day, minutes: dayTravelMinutes(state, d) }))
    .sort((a, b) => b.minutes - a.minutes)[0];
  if (scattered && scattered.minutes > 0) {
    out.push({
      id: `sc-${Math.random().toString(36).slice(2, 10)}`,
      label: "Less travelling",
      summary: `Day ${scattered.day} is reordered so stops close together happen together.`,
      baselineRevision: itinerary.version,
      createdAt: now,
      createdBy,
      changes: [`Reorder day ${scattered.day} by area`],
      travelMinutesDelta: -Math.round(scattered.minutes * 0.25),
      costDeltaMinor: null,
      warnings: ["Opening hours are not re-checked here — confirm before publishing."],
      outdated: false,
      accepted: false,
    });
  }

  // 3. A shorter day for whoever tires first, if anyone has recorded that need.
  const tires = state.travellers.find((t) =>
    (t.needs ?? []).some((n) => /rest|tire|slow|mobility/i.test(n.label ?? "")),
  );
  if (tires) {
    out.push({
      id: `sc-${Math.random().toString(36).slice(2, 10)}`,
      label: `A shorter day for ${tires.name}`,
      summary: `${tires.name} returns after the main stop while the rest continue.`,
      baselineRevision: itinerary.version,
      createdAt: now,
      createdBy,
      changes: ["Split the afternoon with a meeting point at the end"],
      travelMinutesDelta: null,
      costDeltaMinor: null,
      warnings: ["Someone has to accompany them — agree who before publishing."],
      outdated: false,
      accepted: false,
    });
  }

  return out.slice(0, 3);
}

/* ---------------- money side of replanning (P08) ---------------- */

export interface CostImpact {
  currency: string;
  alreadyPaidMinor: number;
  refundableMinor: number;
  unknownPolicy: string[];
  sponsorReapproval: string[];
  affected: string[];
}

/**
 * What dropping these stops would mean for money already committed. Amounts
 * come only from what the group recorded; a missing refund policy is reported
 * as unknown, never assumed refundable.
 */
export function costImpact(state: KintripState, droppedAttractionIds: string[]): CostImpact {
  const currency = state.decisions.currency;
  const heads = state.travellers.length || 1;
  let alreadyPaid = 0;
  let refundable = 0;
  const unknownPolicy: string[] = [];
  const sponsorReapproval: string[] = [];

  for (const id of droppedAttractionIds) {
    const suggestion = state.suggestions[id];
    const place = state.attractions.find((a) => a.id === id);
    if (!suggestion || !place) continue;
    const cost = suggestion.cost;
    const total = (cost?.perPerson ?? 0) * heads;
    const paid = cost?.funding === "already_booked" || cost?.funding === "shared" || cost?.funding === "major";
    if (paid && total > 0) {
      alreadyPaid += total;
      if (cost?.refundable === true) refundable += total;
      else if (cost?.refundable !== false) unknownPolicy.push(place.name);
    }
    if (cost?.funding === "major" || cost?.funding === "shared") sponsorReapproval.push(place.name);
  }

  const affected = state.travellers.map((t) => t.name);
  return { currency, alreadyPaidMinor: alreadyPaid, refundableMinor: refundable, unknownPolicy, sponsorReapproval, affected };
}
