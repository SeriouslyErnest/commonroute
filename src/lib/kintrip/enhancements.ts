import { canEditFor, isOrganiser } from "./governance";
import type {
  Arrangement,
  Attraction,
  KintripState,
  PrefField,
  PreferenceRecord,
  Preferences,
  TripTask,
} from "./types";

/**
 * Pure helpers for the focused enhancements (CE01–CE06). No network calls,
 * no AI, no storage: screens and actions build on these.
 */

/* ---------------- CE01 quick ideas ---------------- */

/** Canonical form of a pasted link, so the same page saved twice is spotted. */
export function canonicalUrl(raw: string): string | null {
  const text = raw.trim();
  if (!/^https?:\/\//i.test(text)) return null;
  try {
    const u = new URL(text);
    const keep = new URLSearchParams();
    for (const [k, v] of u.searchParams) {
      if (!/^(utm_|fbclid|gclid|ref$|si$)/i.test(k)) keep.append(k, v);
    }
    const q = keep.toString();
    return `${u.hostname.replace(/^www\./, "").toLowerCase()}${u.pathname.replace(/\/+$/, "")}${q ? `?${q}` : ""}`;
  } catch {
    return null;
  }
}

/** A title from what was typed, without fetching anything. */
export function ideaTitle(text: string): string {
  const t = text.trim();
  if (/^https?:\/\//i.test(t)) {
    try {
      return new URL(t).hostname.replace(/^www\./, "");
    } catch {
      return t.slice(0, 60);
    }
  }
  const firstLine = t.split(/\r?\n/)[0] ?? t;
  return firstLine.slice(0, 80);
}

const simple = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

/** Probable duplicates within the trip. Never merges anything. */
export function probableDuplicate(
  list: Attraction[],
  input: { title: string; url?: string | undefined; providerPlaceId?: string | undefined },
): Attraction | undefined {
  const url = input.url ? canonicalUrl(input.url) : null;
  const name = simple(input.title);
  return list.find((a) => {
    if (input.providerPlaceId && a.providerPlaceId === input.providerPlaceId) return true;
    if (url && canonicalUrl(a.sourceUrl) === url) return true;
    return name.length > 1 && simple(a.name) === name;
  });
}

export function needsLocation(a: Attraction) {
  return a.locationStatus === "needs_location";
}

/* ---------------- CE02 preference provenance ---------------- */

export const FIELD_LABEL: Record<PrefField, string> = {
  pace: "Pace",
  walking: "Walking",
  earliestStart: "Earliest start",
  latestFinish: "Latest finish",
  restWindow: "Rest time",
  note: "Note",
};

export const SOURCE_LABEL: Record<PreferenceRecord["sourceKind"], string> = {
  self: "Said by them",
  proxy: "Entered by an authorised helper",
  organiser_observation: "Organiser's observation",
  unknown: "Source not recorded",
};

export const CONFIRM_LABEL: Record<PreferenceRecord["confirmation"], string> = {
  unconfirmed: "Not confirmed",
  confirmed_self: "Confirmed by them",
  confirmed_proxy: "Confirmed by their helper",
  needs_review: "Needs a look",
  rejected: "Not right",
  superseded: "Replaced",
};

export function isConfirmed(r: PreferenceRecord) {
  return (
    (r.confirmation === "confirmed_self" || r.confirmation === "confirmed_proxy") &&
    r.confirmedVersion === r.version
  );
}

export function appliesOnDay(r: PreferenceRecord, day?: number | undefined) {
  if (day === undefined) return r.fromDay === undefined && r.toDay === undefined;
  const from = r.fromDay ?? 1;
  const to = r.toDay ?? Number.MAX_SAFE_INTEGER;
  return day >= from && day <= to;
}

/** Who may read a record: the subject, anyone who may edit for them, and organisers unless private. */
export function maySeePreference(state: KintripState, r: PreferenceRecord, viewerId = state.activeTravellerId) {
  if (canEditFor(state, r.subjectId, viewerId)) return true;
  if (r.recordedBy === viewerId) return true;
  if (r.visibility === "private") return false;
  if (r.visibility === "organisers") return isOrganiser(state, viewerId);
  return true;
}

export function visiblePreferences(state: KintripState, viewerId = state.activeTravellerId) {
  return state.prefRecords.filter((r) => maySeePreference(state, r, viewerId));
}

export interface EffectiveValue {
  value: string | null;
  from: "trip_day" | "trip" | "general" | "profile" | "conflict";
  recordIds: string[];
}

/**
 * The value the planner should use for a soft preference.
 * Order: a confirmed trip record for that day → a confirmed trip-wide record →
 * the profile value. Two equally specific confirmed values that disagree
 * return a conflict instead of whichever was edited last.
 */
export function effectiveValue(
  state: KintripState,
  subjectId: string,
  field: PrefField,
  day?: number | undefined,
): EffectiveValue {
  const live = state.prefRecords.filter(
    (r) => r.subjectId === subjectId && r.field === field && isConfirmed(r),
  );
  const tiers: [EffectiveValue["from"], PreferenceRecord[]][] = [
    [
      "trip_day",
      day === undefined
        ? []
        : live.filter((r) => r.scope === "trip" && (r.fromDay !== undefined || r.toDay !== undefined) && appliesOnDay(r, day)),
    ],
    ["trip", live.filter((r) => r.scope === "trip" && r.fromDay === undefined && r.toDay === undefined)],
    ["general", live.filter((r) => r.scope === "general")],
  ];
  for (const [from, rows] of tiers) {
    if (rows.length === 0) continue;
    const values = new Set(rows.map((r) => r.value));
    if (values.size > 1) return { value: null, from: "conflict", recordIds: rows.map((r) => r.id) };
    return { value: rows[0]!.value, from, recordIds: rows.map((r) => r.id) };
  }
  const t = state.travellers.find((x) => x.id === subjectId);
  const profile = t ? (t.preferences as unknown as Record<string, unknown>)[field] : undefined;
  return { value: typeof profile === "string" ? profile : null, from: "profile", recordIds: [] };
}

/**
 * Preferences the planner reads for a traveller. Soft values only: a
 * temporary pace can make walking gentler but never loosens a stricter need.
 */
export function effectivePreferences(state: KintripState, travellerId: string, day?: number | undefined): Preferences {
  const t = state.travellers.find((x) => x.id === travellerId);
  const base: Preferences = t?.preferences ?? {
    interests: [],
    pace: "balanced",
    walking: "moderate",
    mustDo: "",
    avoid: "",
    constraints: "",
  };
  const pace = effectiveValue(state, travellerId, "pace", day);
  const walking = effectiveValue(state, travellerId, "walking", day);
  const rank = { low: 0, moderate: 1, high: 2 } as const;
  let nextWalking = base.walking;
  if (walking.value && walking.value in rank) {
    const w = walking.value as keyof typeof rank;
    // Only ever tighten: a temporary value cannot weaken the profile limit.
    if (rank[w] < rank[nextWalking]) nextWalking = w;
  }
  return {
    ...base,
    pace: pace.value === "relaxed" || pace.value === "balanced" || pace.value === "packed" ? pace.value : base.pace,
    walking: nextWalking,
  };
}

/** Pairs of records that need a decision: confirmed and disagreeing at the same level. */
export function preferenceConflicts(state: KintripState, viewerId = state.activeTravellerId) {
  const out: { subjectId: string; field: PrefField; ids: string[] }[] = [];
  const seen = new Set<string>();
  for (const r of visiblePreferences(state, viewerId)) {
    const days = r.fromDay !== undefined ? [r.fromDay] : [undefined];
    for (const d of days) {
      const eff = effectiveValue(state, r.subjectId, r.field, d);
      const key = `${r.subjectId}:${r.field}:${eff.recordIds.join(",")}`;
      if (eff.from === "conflict" && !seen.has(key)) {
        seen.add(key);
        out.push({ subjectId: r.subjectId, field: r.field, ids: eff.recordIds });
      }
    }
  }
  return out;
}

/** Group-safe line: what changed, never why. */
export function publicPreferenceLine(state: KintripState, r: PreferenceRecord) {
  const who = state.travellers.find((t) => t.id === r.subjectId)?.name ?? "Someone";
  if (r.field === "pace" && r.value === "relaxed") return `Allow more time between stops for ${who}`;
  if (r.field === "restWindow") return `Keep a rest for ${who} around ${r.value}`;
  return `${FIELD_LABEL[r.field]} for ${who}: ${r.value}`;
}

/* ---------------- CE03 waiting for an answer ---------------- */

export function isWaiting(t: TripTask) {
  return Boolean(t.waitingFor) && t.state !== "complete" && t.state !== "cancelled";
}

export function checkBackDue(t: TripTask, today = new Date().toISOString().slice(0, 10)) {
  return isWaiting(t) && Boolean(t.checkBackOn) && (t.checkBackOn as string) <= today;
}

export function waitingLine(t: TripTask) {
  const bits = [`Waiting for ${t.waitingFor}`];
  if (t.checkBackOn) bits.push(`check again ${t.checkBackOn}`);
  return bits.join(" · ");
}

/* ---------------- CE05 arrangements ---------------- */

export const ARRANGEMENT_LABEL: Record<Arrangement["kind"], string> = {
  later_start: "Later start",
  taxi_leg: "Taxi for one leg",
  subgroup_rest: "Some of us rest",
};

export const ARRANGEMENT_STATUS_LABEL: Record<Arrangement["status"], string> = {
  draft: "Draft",
  proposed: "Proposed",
  applied: "Added to the draft plan",
  withdrawn: "Withdrawn",
  expired: "Ended",
};

/** Status with expiry derived from the end date — never stored as a side effect. */
export function arrangementStatus(a: Arrangement, today = new Date().toISOString().slice(0, 10)) {
  if ((a.status === "proposed" || a.status === "draft") && a.endDate && a.endDate < today) return "expired";
  return a.status;
}

export function currentResponses(a: Arrangement) {
  return a.travellerIds.map((id) => {
    const r = a.responses.find((x) => x.travellerId === id && x.version === a.version);
    return r ?? { travellerId: id, state: "pending" as const, byId: "", proxy: false, version: a.version, at: "" };
  });
}

export function maySeeArrangementReason(state: KintripState, a: Arrangement, viewerId = state.activeTravellerId) {
  if (isOrganiser(state, viewerId)) return true;
  return a.travellerIds.some((id) => canEditFor(state, id, viewerId));
}

/* ---------------- CE04 pick up planning ---------------- */

export interface PickUpCard {
  id: string;
  tier: 1 | 2 | 3;
  title: string;
  hint: string;
  to: string;
  critical: boolean;
}

/**
 * Deterministic "pick up where you left off" cues. Built only from records the
 * viewer can already see; titles never quote private text.
 */
export function pickUpCards(
  state: KintripState,
  input: { viewerId?: string | undefined; lastSeenVersion?: number | undefined; today?: string | undefined } = {},
): PickUpCard[] {
  const viewer = input.viewerId ?? state.activeTravellerId;
  const today = input.today ?? new Date().toISOString().slice(0, 10);
  const organiser = isOrganiser(state, viewer);
  const cards: PickUpCard[] = [];

  // Tier 1 — deadlines, funding and review items the viewer can act on.
  const soon = new Date(Date.parse(`${today}T00:00:00Z`) + 7 * 86400000).toISOString().slice(0, 10);
  for (const b of state.bookings) {
    if (b.status !== "planned" || !b.cancellationDeadline) continue;
    if (!organiser && b.ownerId !== viewer) continue;
    const d = b.cancellationDeadline.slice(0, 10);
    if (d <= soon) {
      cards.push({ id: `bk:${b.id}`, tier: 1, title: `${b.title}: deadline ${d}`, hint: "Booking still not confirmed", to: "/bookings", critical: d <= today });
    }
  }
  if (organiser) {
    const pendingSponsor = state.sponsorApprovals.filter((s) => s.decision === "hold").length;
    if (pendingSponsor > 0) {
      cards.push({ id: "sponsor", tier: 1, title: `${pendingSponsor} waiting for the sponsor`, hint: "Funding decisions", to: "/sponsor", critical: false });
    }
    const conflicts = preferenceConflicts(state, viewer).length;
    if (conflicts > 0) {
      cards.push({ id: "prefconflict", tier: 1, title: `${conflicts} traveller setting${conflicts === 1 ? "" : "s"} to settle`, hint: "Two confirmed values disagree", to: "/context", critical: false });
    }
  }
  const reviewMine = state.prefRecords.filter(
    (r) => canEditFor(state, r.subjectId, viewer) && (r.confirmation === "unconfirmed" || r.confirmation === "needs_review"),
  ).length;
  if (reviewMine > 0) {
    cards.push({ id: "prefreview", tier: 1, title: `${reviewMine} setting${reviewMine === 1 ? "" : "s"} for you to check`, hint: "Confirm, correct or say it is not right", to: "/context", critical: false });
  }

  // Tier 2 — plan changes since last seen, and decisions for this role.
  const itin = state.itinerary;
  if (itin?.published && input.lastSeenVersion !== undefined && itin.version > input.lastSeenVersion) {
    cards.push({ id: `rev:${itin.version}`, tier: 2, title: "The plan has changed since you last looked", hint: "Seeing it does not mean you agree", to: "/changes", critical: false });
  }
  if (organiser) {
    const toDecide = Object.values(state.suggestions).filter((s) => s.status === "suggested" || s.status === "under_review").length;
    if (toDecide > 0) cards.push({ id: "decide", tier: 2, title: `${toDecide} idea${toDecide === 1 ? "" : "s"} to decide`, hint: "Suggestions waiting for an organiser", to: "/review", critical: false });
    const proposed = state.arrangements.filter((a) => arrangementStatus(a, today) === "proposed").length;
    if (proposed > 0) cards.push({ id: "arr", tier: 2, title: `${proposed} proposed change${proposed === 1 ? "" : "s"}`, hint: "Temporary arrangements", to: "/arrangements", critical: false });
  }
  const myResponses = state.arrangements.filter(
    (a) =>
      arrangementStatus(a, today) === "proposed" &&
      currentResponses(a).some((r) => r.state === "pending" && canEditFor(state, r.travellerId, viewer)),
  ).length;
  if (myResponses > 0) cards.push({ id: "arrme", tier: 2, title: `${myResponses} change${myResponses === 1 ? "" : "s"} asking for your answer`, hint: "Optional — nobody is scored", to: "/arrangements", critical: false });

  // Tier 3 — check-backs and unfinished steps.
  const due = state.tasks.filter((t) => (organiser || t.assigneeId === viewer) && t.visibility !== "private" && checkBackDue(t, today));
  if (due.length > 0) cards.push({ id: "checkback", tier: 3, title: `${due.length} answer${due.length === 1 ? "" : "s"} to check on`, hint: due.length === 1 ? waitingLine(due[0]!) : "Check-back dates reached", to: "/getting-ready", critical: false });
  const needLoc = state.attractions.filter(needsLocation).length;
  if (needLoc > 0) cards.push({ id: "ideas", tier: 3, title: `${needLoc} idea${needLoc === 1 ? "" : "s"} need a location`, hint: "Add details when you have a moment", to: "/ideas", critical: false });
  const me = state.travellers.find((t) => t.id === viewer);
  if (me && me.prefStatus !== "complete") cards.push({ id: "prefs", tier: 3, title: "Share your preferences", hint: "Takes about a minute", to: "/preferences", critical: false });

  const byId = new Map<string, PickUpCard>();
  for (const c of cards) if (!byId.has(c.id)) byId.set(c.id, c);
  return [...byId.values()].sort((a, b) => Number(b.critical) - Number(a.critical) || a.tier - b.tier);
}
