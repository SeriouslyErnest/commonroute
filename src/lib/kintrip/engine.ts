import { backupAttractions, eligibleAttractions } from "./governance";
import type {
  Attraction,
  Itinerary,
  ItineraryDay,
  ItineraryItem,
  KintripState,
  VoteValue,
} from "./types";

export const VOTE_LABEL: Record<VoteValue, string> = {
  MUST_GO: "Must go",
  WOULD_LIKE: "Would like",
  DONT_MIND: "Don't mind",
  SKIP: "Skip",
};

const VOTE_SCORE: Record<VoteValue, number> = {
  MUST_GO: 3,
  WOULD_LIKE: 2,
  DONT_MIND: 0.5,
  SKIP: -1.5,
};

const WALK_RANK: Record<string, number> = { low: 0, moderate: 1, high: 2 };

export function toMin(t: string) {
  const [h, m] = t.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

export function fromMin(v: number) {
  const m = ((v % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

export function mapsUrl(a: { name: string; city: string }) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${a.name}, ${a.city}`)}`;
}

export function pretty(t: string) {
  const m = toMin(t);
  const h = Math.floor(m / 60);
  const suffix = h < 12 ? "AM" : "PM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m % 60).padStart(2, "0")} ${suffix}`;
}

export interface AttractionConsensus {
  attraction: Attraction;
  counts: Record<VoteValue, number>;
  score: number;
  votesCast: number;
  group: "strong" | "mixed" | "alignment";
  note: string;
}

export function consensusFor(state: KintripState): AttractionConsensus[] {
  const familyWalking = familyWalkingLimit(state);
  return state.attractions
    .map((attraction) => {
      const counts: Record<VoteValue, number> = {
        MUST_GO: 0,
        WOULD_LIKE: 0,
        DONT_MIND: 0,
        SKIP: 0,
      };
      let score = 0;
      let votesCast = 0;
      for (const t of state.travellers) {
        const v = state.votes[t.id]?.[attraction.id];
        if (!v) continue;
        counts[v] += 1;
        score += VOTE_SCORE[v];
        votesCast += 1;
      }
      const exceedsWalking = WALK_RANK[attraction.walking]! > WALK_RANK[familyWalking]!;
      const split = counts.SKIP > 0 && counts.MUST_GO > 0;
      let group: AttractionConsensus["group"] = "mixed";
      if (split || (exceedsWalking && counts.MUST_GO >= 2)) group = "alignment";
      else if (counts.MUST_GO >= 4 || score >= 14) group = "strong";

      let note = "";
      if (group === "strong") {
        note =
          counts.MUST_GO >= 6
            ? "Everyone's on board for this one."
            : `A strong family favourite — ${counts.MUST_GO} must-gos.`;
      } else if (group === "alignment" && exceedsWalking) {
        note = `${attraction.name} is a must-do for ${counts.MUST_GO} travellers, and the full route asks for more walking than the family's comfortable limit. A shortened visit keeps it in.`;
      } else if (group === "alignment") {
        note = `${counts.MUST_GO} travellers really want this, ${counts.SKIP} would rather skip. Worth planning as an optional split or a shorter stop.`;
      } else {
        const interested = counts.MUST_GO + counts.WOULD_LIKE;
        note =
          interested >= Math.ceil(state.travellers.length * 0.7)
            ? "Works well for most of the family."
            : interested >= Math.ceil(state.travellers.length * 0.4)
              ? "A good option for part of the family, with room for flexibility."
              : "Best kept as an optional stop for those who are interested.";
      }
      return { attraction, counts, score, votesCast, group, note };
    })
    .sort((a, b) => b.score - a.score);
}

export function familyWalkingLimit(state: KintripState) {
  let limit: "low" | "moderate" | "high" = "high";
  for (const t of state.travellers) {
    if (t.prefStatus !== "complete") continue;
    if (WALK_RANK[t.preferences.walking]! < WALK_RANK[limit]!) limit = t.preferences.walking;
  }
  return limit;
}

export function fitNoteFor(state: KintripState, attraction: Attraction) {
  let fit = 0;
  for (const t of state.travellers) {
    const v = state.votes[t.id]?.[attraction.id];
    if (v === "MUST_GO" || v === "WOULD_LIKE") fit += 1;
    else if (!v && t.preferences.interests.includes(attraction.category)) fit += 1;
  }
  if (fit >= Math.ceil(state.travellers.length * 0.7)) return "Works well for most";
  if (fit >= Math.ceil(state.travellers.length * 0.4)) return "Some family interest";
  return "Optional for some";
}

function addDays(iso: string, n: number) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Hand-built so server and client render byte-identical text (no ICU differences).
export function formatDate(iso: string) {
  const d = new Date(`${iso}T00:00:00Z`);
  return `${WEEKDAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

function shortenedFor(a: Attraction, limit: string) {
  // Only trim the genuinely demanding routes; a moderate stroll stays as planned.
  return WALK_RANK[a.walking]! >= 2 && WALK_RANK[limit]! <= 1;
}

function travelFor(fromArea: string | null, toArea: string) {
  if (!fromArea) return null;
  if (fromArea === toArea) return { minutes: 10, mode: "Short walk" };
  return { minutes: 22, mode: "Train + 6 min walk" };
}

export function generateItinerary(state: KintripState, variant = 0): Itinerary {
  const limit = familyWalkingLimit(state);
  const eligible = eligibleAttractions(state);
  const allowed = eligible.length > 0 ? new Set(eligible.map((a) => a.id)) : null;
  const ranked = consensusFor(state).filter((c) =>
    allowed ? allowed.has(c.attraction.id) : c.score > 0,
  );
  const days = Math.max(
    1,
    Math.round(
      (Date.parse(state.trip.endDate) - Date.parse(state.trip.startDate)) / 86400000,
    ) + 1,
  );
  const cityList = [...new Set(ranked.map((c) => c.attraction.city))];
  const cities = cityList.length > 0 ? cityList : [state.trip.destination.split(",")[0]!.trim()];
  const counts = cities.map(
    (city) => ranked.filter((c) => c.attraction.city === city).length,
  );
  const totalCount = counts.reduce((sum, n) => sum + n, 0) || 1;
  let remaining = days;
  const dayCounts = cities.map((_, i) => {
    if (i === cities.length - 1) return remaining;
    const d = Math.min(
      remaining - (cities.length - i - 1),
      Math.max(1, Math.round((days * counts[i]!) / totalCount)),
    );
    remaining -= d;
    return d;
  });

  const pick = (city: string) =>
    ranked
      .filter((c) => c.attraction.city === city)
      .map((c) => c.attraction);

  const areaGroups = (list: Attraction[]) => {
    const areas = new Map<string, Attraction[]>();
    for (const a of list) {
      if (!areas.has(a.area)) areas.set(a.area, []);
      areas.get(a.area)!.push(a);
    }
    const groups = [...areas.values()];
    if (variant % 2 === 1) groups.reverse();
    return groups;
  };

  // Keep each day inside one area, so travel between stops stays short.
  const distribute = (groups: Attraction[][], count: number) => {
    const out: Attraction[][] = Array.from({ length: count }, () => []);
    const leastLoaded = () =>
      out.reduce((best, day, i) => (day.length < out[best]!.length ? i : best), 0);

    groups.forEach((group, i) => {
      const day = i < count ? i : leastLoaded();
      out[day]!.push(...group);
    });

    // Even the days out: a fully empty day borrows a stop from the busiest one.
    for (let pass = 0; pass < count * 2; pass += 1) {
      const empty = out.findIndex((d) => d.length === 0);
      if (empty === -1) break;
      const busiest = out.reduce((best, day, i) => (day.length > out[best]!.length ? i : best), 0);
      if (out[busiest]!.length < 2) break;
      out[empty]!.push(out[busiest]!.pop()!);
    }

    // Never leave a single day carrying a heavy load.
    for (let pass = 0; pass < count * 2; pass += 1) {
      const busiest = out.reduce((best, day, i) => (day.length > out[best]!.length ? i : best), 0);
      const lightest = leastLoaded();
      if (out[busiest]!.length - out[lightest]!.length < 2) break;
      out[lightest]!.push(out[busiest]!.pop()!);
    }
    return out;
  };

  const plan = cities.flatMap((city, i) => distribute(areaGroups(pick(city)), dayCounts[i]!));
  const cityOfDay = cities.flatMap((city, i) => Array<string>(dayCounts[i]!).fill(city));

  const shortened: string[] = [];
  const dayPlans: ItineraryDay[] = plan.map((attractions, index) => {
    const city: string = cityOfDay[index] ?? cities[0]!;
    const items: ItineraryItem[] = [];
    let clock = toMin(index === 0 ? "10:00" : "09:00");
    let lastArea: string | null = null;
    let lunchDone = false;
    let restDone = false;
    let walkLoad = 0;

    attractions.forEach((a, i) => {
      const travel = travelFor(lastArea, a.area);
      if (travel) {
        items.push({
          id: `d${index + 1}-tr${i}`,
          kind: "travel",
          title: `${lastArea} → ${a.area}`,
          start: fromMin(clock),
          durationMin: travel.minutes,
          transport: travel.mode,
        });
        clock += travel.minutes;
      }
      if (!lunchDone && clock >= toMin("12:00")) {
        items.push({
          id: `d${index + 1}-lunch`,
          kind: "meal",
          title: "Lunch together",
          start: fromMin(clock),
          durationMin: 60,
          note: "Sit-down spot near the next stop, easy for everyone.",
        });
        clock += 60;
        lunchDone = true;
      }
      const shorten = shortenedFor(a, limit);
      const duration = shorten ? Math.max(75, Math.round(a.durationMin * 0.6)) : a.durationMin;
      if (shorten) shortened.push(a.name);
      const openAt = Math.max(clock, toMin(a.opens));
      clock = openAt;
      items.push({
        id: `d${index + 1}-a${i}`,
        kind: "activity",
        title: a.name,
        start: fromMin(clock),
        durationMin: duration,
        attractionId: a.id,
        address: `${a.area}, ${a.city}`,
        walking: shorten ? "moderate" : a.walking,
        note: shorten
          ? "Shortened route planned so the walking stays within the family's comfortable level."
          : undefined,
      });
      clock += duration;
      walkLoad += WALK_RANK[a.walking]! + 1;
      lastArea = a.area;

      if (!restDone && walkLoad >= 3 && i < attractions.length - 1) {
        items.push({
          id: `d${index + 1}-rest`,
          kind: "rest",
          title: "Rest break",
          start: fromMin(clock),
          durationMin: 30,
          note: "Suggested because today has more walking than usual.",
        });
        clock += 30;
        restDone = true;
      }
    });

    if (!lunchDone) {
      items.push({
        id: `d${index + 1}-lunch`,
        kind: "meal",
        title: "Lunch together",
        start: fromMin(clock),
        durationMin: 60,
      });
      clock += 60;
    }

    return {
      day: index + 1,
      date: addDays(state.trip.startDate, index),
      city,
      areaLabel: attractions[0] ? `${city} · ${attractions[0].area}` : city,
      items,
      timingNote:
        clock > toMin("18:30") ? "Later finish than usual — dinner near the hotel is planned." : undefined,
    };
  });

  const uniqueShortened = [...new Set(shortened)];
  const fit = {
    good: [
      "All major family must-dos included",
      `${cities[0] ?? "Your"} attractions grouped geographically to cut travel time`,
      "Longer walking periods separated by rests",
      "Shopping and younger-traveller activities included",
      "Meals and quiet time built into every day",
    ],
    watch: uniqueShortened.map(
      (name) => `${name} visit shortened to stay within the family's walking preferences`,
    ),
  };

  // Mark how firm each stop is: booked places are anchors and never moved.
  for (const d of dayPlans) {
    d.items = d.items.map((item) => {
      if (item.kind === "rest") return { ...item, rigidity: "rest" as const };
      if (item.kind !== "activity") return item;
      const status = state.suggestions[item.attractionId ?? ""]?.status;
      return {
        ...item,
        rigidity: status === "booked" ? ("anchor" as const) : ("preferred" as const),
        locked: status === "booked" ? true : item.locked,
      };
    });
  }

  return {
    tripId: state.trip.id,
    version: variant + 1,
    generatedAt: new Date().toISOString(),
    days: dayPlans,
    fit,
    summary:
      "This plan keeps everyone's must-dos, groups nearby places together, keeps walking within the family's comfortable level and builds in meals and rest.",
    finalised: false,
  };
}

export interface ReplanResult {
  itinerary: Itinerary;
  changes: string[];
  message: string;
}

export function replanDay(
  state: KintripState,
  dayNumber: number,
  reasons: string[],
  freeText: string,
  fromTime = "13:00",
): ReplanResult {
  const base = state.itinerary ?? generateItinerary(state);
  const days = base.days.map((d) => ({ ...d, items: d.items.map((i) => ({ ...i })) }));
  const dayIndex = days.findIndex((d) => d.day === dayNumber);
  if (dayIndex === -1) return { itinerary: base, changes: [], message: "Nothing to adjust." };
  const day = days[dayIndex]!;
  const text = `${reasons.join(" ")} ${freeText}`.toLowerCase();
  const rain = reasons.includes("Rain") || /rain|wet|storm/.test(text);
  const tired = reasons.includes("Too tired") || /tired|rest|slow/.test(text);
  const late = reasons.includes("Running late") || /late|behind/.test(text);
  const closed = reasons.includes("Attraction unavailable") || /closed|unavailable/.test(text);
  const changes: string[] = [];

  const cutoff = toMin(fromTime);
  const kept = day.items.filter((i) => toMin(i.start) + i.durationMin <= cutoff);
  let remaining = day.items.filter((i) => toMin(i.start) + i.durationMin > cutoff);

  const scores = new Map(consensusFor(state).map((c) => [c.attraction.id, c.score]));
  const remainingActivities = remaining.filter((i) => i.kind === "activity");
  const priority = [...remainingActivities].sort(
    (a, b) => (scores.get(b.attractionId ?? "") ?? 0) - (scores.get(a.attractionId ?? "") ?? 0),
  )[0];

  const used = new Set(
    days.flatMap((d) => d.items.map((i) => i.attractionId).filter(Boolean) as string[]),
  );

  const dropped: ItineraryItem[] = [];
  for (const item of remainingActivities) {
    if (item.id === priority?.id) continue;
    if (item.locked || item.rigidity === "anchor") continue; // booked or locked stops stay put
    const attraction = state.attractions.find((a) => a.id === item.attractionId);
    const outdoor = attraction ? !attraction.indoor : false;
    const heavy = attraction ? WALK_RANK[attraction.walking]! >= 1 : false;
    if ((rain && outdoor) || (tired && heavy) || (closed && item === remainingActivities.at(-1))) {
      dropped.push(item);
    }
  }

  remaining = remaining.filter((i) => !dropped.includes(i));

  // Re-home dropped stops on a later day in the same city.
  for (const item of dropped) {
    const target = days.find((d) => d.day > dayNumber && d.city === day.city);
    if (target) {
      const last = target.items.at(-1);
      const start = last ? fromMin(toMin(last.start) + last.durationMin + 15) : "15:00";
      target.items.push({ ...item, id: `${item.id}-moved`, start });
      changes.push(`Moved ${item.title} to Day ${target.day}`);
    } else {
      changes.push(`Released ${item.title} from today's plan`);
    }
  }

  // Indoor, lower-effort alternative when the weather turns.
  if ((rain || tired) && dropped.length > 0) {
    const backups = backupAttractions(state, rain ? "rain" : "tired").filter(
      (a) => a.city === day.city && !used.has(a.id),
    );
    const alt = [...backups, ...state.attractions]
      .filter((a) => a.city === day.city && (a.indoor || backups.includes(a)) && !used.has(a.id))
      .sort((a, b) => (scores.get(b.id) ?? 0) - (scores.get(a.id) ?? 0))[0];
    if (alt) {
      remaining.push({
        id: `d${dayNumber}-alt-${alt.id}`,
        kind: "activity",
        title: alt.name,
        start: "00:00",
        durationMin: tired ? 75 : alt.durationMin,
        attractionId: alt.id,
        address: `${alt.area}, ${alt.city}`,
        walking: "low",
        note: "Indoor and easy-going — a comfortable swap for this afternoon.",
      });
      changes.push(`Added ${alt.name} as a sheltered, lower-effort stop`);
    }
  }

  if (tired) {
    remaining.push({
      id: `d${dayNumber}-rest-extra`,
      kind: "rest",
      title: "Rest break",
      start: "00:00",
      durationMin: 30,
      note: "A proper sit-down before the last stop of the day.",
    });
    changes.push("Added a rest break and reduced walking for the rest of the day");
  }

  // Rebuild the afternoon timeline from the current moment.
  let clock = cutoff + (late ? 45 : 0);
  if (late) changes.push("Shifted the afternoon 45 minutes later to match where you are now");
  const order: ItineraryItem[] = [];
  const rests = remaining.filter((i) => i.kind === "rest");
  const meals = remaining.filter((i) => i.kind === "meal");
  const acts = remaining.filter((i) => i.kind === "activity");
  for (const item of [...meals, ...acts]) {
    order.push(item);
    if (rests.length && order.filter((i) => i.kind === "activity").length === 1) {
      order.push(rests.shift()!);
    }
  }
  order.push(...rests);

  const rebuilt: ItineraryItem[] = [];
  order.forEach((item, i) => {
    if (i > 0 && item.kind === "activity") {
      rebuilt.push({
        id: `${item.id}-travel`,
        kind: "travel",
        title: `To ${item.address ?? item.title}`,
        start: fromMin(clock),
        durationMin: 18,
        transport: "Train + 6 min walk",
      });
      clock += 18;
    }
    rebuilt.push({ ...item, start: fromMin(clock) });
    clock += item.durationMin;
  });

  if (rain && dropped.length === 0) {
    changes.push("Your remaining stops today are already indoors, so the plan stays as it is");
  }
  if (priority) changes.push(`Kept ${priority.title}, your family's highest-priority stop today`);
  changes.push("Fewer moves this afternoon to keep the day comfortable");

  day.items = [...kept, ...rebuilt];

  return {
    itinerary: {
      ...base,
      version: base.version + 1,
      generatedAt: new Date().toISOString(),
      days,
    },
    changes,
    message: "We've adjusted your afternoon.",
  };
}
