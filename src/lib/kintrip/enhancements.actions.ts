import { setState } from "./store";
import { actorName, canEditFor, isOrganiser, logAudit, newSuggestion, withNotice } from "./governance";
import { arrangementStatus, canonicalUrl, ideaTitle, probableDuplicate } from "./enhancements";
import { ARRANGEMENTS_ENABLED } from "./features";
import type {
  Arrangement,
  ArrangementKind,
  Attraction,
  KintripState,
  PrefField,
  PrefScope,
  PreferenceRecord,
} from "./types";

/**
 * State changes for the focused enhancements. Every permission rule is
 * checked here, so a screen that forgets to hide a button still cannot make
 * an unauthorised change. Each function returns a plain sentence when it
 * refuses, or null when the change went through.
 */

const uid = () => Math.random().toString(36).slice(2, 10);
const now = () => new Date().toISOString();
type Result = string | null;

function guard(allowed: (prev: KintripState) => boolean, change: (prev: KintripState) => KintripState | string): Result {
  const out: { error: string | null } = { error: null };
  setState((prev) => {
    if (!allowed(prev)) {
      out.error = "You do not have permission to make that change.";
      return prev;
    }
    const next = change(prev);
    if (typeof next === "string") {
      out.error = next;
      return prev;
    }
    return next;
  });
  return out.error;
}

const canContribute = (s: KintripState) => {
  const me = s.travellers.find((t) => t.id === s.activeTravellerId);
  return Boolean(me) && !(me!.roles.length === 1 && me!.roles[0] === "viewer");
};

/* ---------------- CE01 ---------------- */

export interface SaveIdeaOutcome {
  error: string | null;
  duplicateOf?: string | undefined;
  savedId?: string | undefined;
}

/**
 * Save a name, note or link as a suggestion. No map lookup, no preview fetch,
 * no AI, no credits. Retrying with the same captureKey never creates a second
 * record; a probable duplicate is reported, never merged.
 */
export function saveIdea(input: { text: string; note?: string | undefined; captureKey: string; allowDuplicate?: boolean | undefined }): SaveIdeaOutcome {
  const out: SaveIdeaOutcome = { error: null };
  const text = input.text.trim();
  if (text.length < 2) return { error: "Type a place name, a note or a link." };
  if (text.length > 500 || (input.note ?? "").length > 1000) return { error: "That is a bit long — keep it short and add details later." };
  const isUrl = /^https?:\/\//i.test(text);
  if (isUrl && !canonicalUrl(text)) return { error: "That link does not look complete." };
  setState((prev) => {
    if (!canContribute(prev)) {
      out.error = "Viewers cannot add suggestions on this trip.";
      return prev;
    }
    const retried = prev.attractions.find((a) => a.captureKey === input.captureKey);
    if (retried) {
      out.savedId = retried.id;
      return prev;
    }
    const title = ideaTitle(text);
    const dup = probableDuplicate(prev.attractions, { title, url: isUrl ? text : undefined });
    if (dup && !input.allowDuplicate) {
      out.duplicateOf = dup.id;
      out.error = `This looks like "${dup.name}", already on the shortlist.`;
      return prev;
    }
    const id = `idea-${uid()}`;
    const a: Attraction = {
      id,
      name: title,
      city: prev.trip.destination,
      area: "",
      category: "Idea",
      description: "",
      durationMin: 90,
      walking: "moderate",
      cost: "$",
      indoor: false,
      opens: "",
      closes: "",
      sourceUrl: isUrl ? text : "",
      provider: undefined,
      capturedAt: now(),
      locationStatus: "needs_location",
      ideaNote: input.note?.trim() || (isUrl ? undefined : text.length > title.length ? text : undefined),
      captureKey: input.captureKey,
    };
    const s = newSuggestion(a, prev.activeTravellerId);
    out.savedId = id;
    return logAudit(
      {
        ...prev,
        attractions: [...prev.attractions, a],
        suggestions: { ...prev.suggestions, [id]: { ...s, cost: { ...s.cost, currency: prev.decisions.currency } } },
      },
      "Idea saved",
      title,
    );
  });
  return out;
}

/** Attach a place chosen from map search. A typed name alone is never treated as a confirmed place. */
export function resolveIdeaLocation(
  id: string,
  place: { name: string; address: string; mapsUrl: string; latitude?: number | undefined; longitude?: number | undefined; placeId: string; provider: "free" | "google" },
): Result {
  return guard(canContribute, (prev) => {
    const a = prev.attractions.find((x) => x.id === id);
    if (!a) return "That idea is no longer on the list.";
    const me = prev.activeTravellerId;
    if (prev.suggestions[id]?.suggestedBy !== me && !isOrganiser(prev)) return "Only the person who saved it or an organiser can add its location.";
    if (typeof place.latitude !== "number" || typeof place.longitude !== "number") return "That result has no map position, so it cannot be used for routes.";
    const other = prev.attractions.find((x) => x.id !== id && x.providerPlaceId === place.placeId);
    if (other) return `"${other.name}" is already on the shortlist.`;
    const updated: Attraction = {
      ...a,
      name: place.name,
      description: place.address,
      sourceUrl: a.sourceUrl || place.mapsUrl,
      latitude: place.latitude,
      longitude: place.longitude,
      provider: place.provider,
      providerPlaceId: place.placeId,
      locationStatus: "resolved",
    };
    return logAudit({ ...prev, attractions: prev.attractions.map((x) => (x.id === id ? updated : x)) }, "Idea location added", place.name);
  });
}

/* ---------------- CE02 ---------------- */

const FIELD_VALUES: Partial<Record<PrefField, string[]>> = {
  pace: ["relaxed", "balanced", "packed"],
  walking: ["low", "moderate", "high"],
};

function validValue(field: PrefField, value: string) {
  const v = value.trim();
  if (!v || v.length > 200) return false;
  const allowed = FIELD_VALUES[field];
  if (allowed) return allowed.includes(v);
  if (field === "earliestStart" || field === "latestFinish") return /^\d{2}:\d{2}$/.test(v);
  return true;
}

/**
 * Record a preference. The source is decided from who is acting, never
 * chosen: yourself → self-reported and confirmed; an authorised helper →
 * proxy; an organiser for someone else → an observation that needs review.
 */
export function recordPreference(input: {
  subjectId: string;
  field: PrefField;
  value: string;
  scope: PrefScope;
  fromDay?: number | undefined;
  toDay?: number | undefined;
  sourceTime?: string | undefined;
  visibility: PreferenceRecord["visibility"];
}): Result {
  return guard(
    (s) => canEditFor(s, input.subjectId) || isOrganiser(s),
    (prev) => {
      if (!validValue(input.field, input.value)) return "That value is not one the planner understands.";
      const actor = prev.activeTravellerId;
      const days = prev.itinerary?.days.length ?? 60;
      if (input.fromDay !== undefined && (input.fromDay < 1 || input.fromDay > days)) return "Pick a day within the trip.";
      if (input.fromDay !== undefined && input.toDay !== undefined && input.toDay < input.fromDay) return "The last day must be on or after the first.";
      if (input.scope === "general" && input.fromDay !== undefined) return "Days only apply to this trip.";
      const self = actor === input.subjectId;
      const proxy = !self && canEditFor(prev, input.subjectId, actor);
      const sourceKind: PreferenceRecord["sourceKind"] = self ? "self" : proxy ? "proxy" : "organiser_observation";
      if (sourceKind === "organiser_observation" && input.scope === "general") return "An observation stays with this trip; only the traveller or their helper can keep something for future trips.";
      const at = now();
      const name = actorName(prev, actor);
      const rec: PreferenceRecord = {
        id: `pr-${uid()}`,
        subjectId: input.subjectId,
        field: input.field,
        value: input.value.trim(),
        scope: input.scope,
        fromDay: input.fromDay,
        toDay: input.toDay,
        sourceKind,
        recordedBy: actor,
        recordedByName: name,
        sourceTime: input.sourceTime,
        createdAt: at,
        version: 1,
        confirmation: self ? "confirmed_self" : proxy ? "confirmed_proxy" : "needs_review",
        confirmedBy: self || proxy ? actor : undefined,
        confirmedAt: self || proxy ? at : undefined,
        confirmedVersion: self || proxy ? 1 : undefined,
        visibility: sourceKind === "organiser_observation" && input.visibility === "group" ? "organisers" : input.visibility,
        history: [{ version: 1, value: input.value.trim(), at, by: name, action: self ? "Saved" : proxy ? "Saved for them" : "Observed" }],
      };
      return { ...prev, prefRecords: [rec, ...prev.prefRecords] };
    },
  );
}

/** Edit a value. The new version needs confirmation again; older confirmations stay with their version. */
export function editPreference(id: string, value: string, expectedVersion: number): Result {
  return guard(
    (s) => {
      const r = s.prefRecords.find((x) => x.id === id);
      return Boolean(r) && (canEditFor(s, r!.subjectId) || (isOrganiser(s) && r!.sourceKind === "organiser_observation"));
    },
    (prev) => {
      const r = prev.prefRecords.find((x) => x.id === id)!;
      if (r.version !== expectedVersion) return "Someone changed this a moment ago — here is the current value.";
      if (!validValue(r.field, value)) return "That value is not one the planner understands.";
      const actor = prev.activeTravellerId;
      const name = actorName(prev, actor);
      const self = actor === r.subjectId;
      const proxy = !self && canEditFor(prev, r.subjectId, actor);
      const version = r.version + 1;
      const next: PreferenceRecord = {
        ...r,
        value: value.trim(),
        version,
        // Saving your own value is a confirmation of that exact version; anything else needs a look.
        confirmation: self ? "confirmed_self" : proxy ? "confirmed_proxy" : "needs_review",
        confirmedBy: self || proxy ? actor : r.confirmedBy,
        confirmedAt: self || proxy ? now() : r.confirmedAt,
        confirmedVersion: self || proxy ? version : r.confirmedVersion,
        history: [...r.history, { version, value: value.trim(), at: now(), by: name, action: "Changed" }],
      };
      return { ...prev, prefRecords: prev.prefRecords.map((x) => (x.id === id ? next : x)) };
    },
  );
}

/** Confirm the current version. Only the traveller or their authorised helper — never an organiser on their behalf. */
export function confirmPreference(id: string): Result {
  return guard(
    (s) => {
      const r = s.prefRecords.find((x) => x.id === id);
      return Boolean(r) && canEditFor(s, r!.subjectId);
    },
    (prev) => {
      const r = prev.prefRecords.find((x) => x.id === id)!;
      const actor = prev.activeTravellerId;
      const self = actor === r.subjectId;
      const next: PreferenceRecord = {
        ...r,
        confirmation: self ? "confirmed_self" : "confirmed_proxy",
        confirmedBy: actor,
        confirmedAt: now(),
        confirmedVersion: r.version,
        history: [...r.history, { version: r.version, value: r.value, at: now(), by: actorName(prev, actor), action: self ? "Confirmed" : "Confirmed for them" }],
      };
      return { ...prev, prefRecords: prev.prefRecords.map((x) => (x.id === id ? next : x)) };
    },
  );
}

/** Say a proposed value is not right. Does not touch other needs or the published plan. */
export function rejectPreference(id: string): Result {
  return guard(
    (s) => {
      const r = s.prefRecords.find((x) => x.id === id);
      return Boolean(r) && canEditFor(s, r!.subjectId);
    },
    (prev) => {
      const r = prev.prefRecords.find((x) => x.id === id)!;
      const next: PreferenceRecord = {
        ...r,
        confirmation: "rejected",
        history: [...r.history, { version: r.version, value: r.value, at: now(), by: actorName(prev, prev.activeTravellerId), action: "Marked not right" }],
      };
      return { ...prev, prefRecords: prev.prefRecords.map((x) => (x.id === id ? next : x)) };
    },
  );
}

/** Deliberately keep a trip value for future trips. Never happens automatically. */
export function rememberPreference(id: string): Result {
  return guard(
    (s) => {
      const r = s.prefRecords.find((x) => x.id === id);
      return Boolean(r) && canEditFor(s, r!.subjectId);
    },
    (prev) => {
      const r = prev.prefRecords.find((x) => x.id === id)!;
      if (r.confirmation !== "confirmed_self" && r.confirmation !== "confirmed_proxy") return "Confirm it first.";
      if (r.sourceKind === "organiser_observation") return "An organiser's observation cannot be kept as a profile setting.";
      const at = now();
      const general: PreferenceRecord = {
        ...r,
        id: `pr-${uid()}`,
        scope: "general",
        fromDay: undefined,
        toDay: undefined,
        rememberedAt: at,
        createdAt: at,
        history: [{ version: r.version, value: r.value, at, by: actorName(prev, prev.activeTravellerId), action: "Kept for future trips" }],
      };
      return { ...prev, prefRecords: [general, ...prev.prefRecords] };
    },
  );
}

export function deletePreference(id: string): Result {
  return guard(
    (s) => {
      const r = s.prefRecords.find((x) => x.id === id);
      return Boolean(r) && (canEditFor(s, r!.subjectId) || r!.recordedBy === s.activeTravellerId);
    },
    (prev) => ({ ...prev, prefRecords: prev.prefRecords.filter((x) => x.id !== id) }),
  );
}

/* ---------------- CE03 ---------------- */

/** Mark a job as waiting for an answer. Naming a hotel or person sends nothing and invites nobody. */
export function setTaskWaiting(
  taskId: string,
  input: { waitingFor: string; checkBackOn?: string | undefined; waitingBookingId?: string | undefined },
): Result {
  return guard(
    (s) => {
      const t = s.tasks.find((x) => x.id === taskId);
      return Boolean(t) && (isOrganiser(s) || t!.assigneeId === s.activeTravellerId);
    },
    (prev) => {
      const t = prev.tasks.find((x) => x.id === taskId)!;
      if (t.state === "complete" || t.state === "cancelled") return "This job is already closed.";
      const what = input.waitingFor.trim();
      if (!what) return "Say what you are waiting for.";
      if (what.length > 120) return "Keep it short, for example 'hotel reply'.";
      if (input.checkBackOn && !/^\d{4}-\d{2}-\d{2}$/.test(input.checkBackOn)) return "Pick a date to check again.";
      if (input.waitingBookingId && !prev.bookings.some((b) => b.id === input.waitingBookingId)) return "That booking is no longer on the trip.";
      const name = actorName(prev, prev.activeTravellerId);
      return {
        ...prev,
        tasks: prev.tasks.map((x) =>
          x.id === taskId
            ? {
                ...x,
                waitingFor: what,
                checkBackOn: input.checkBackOn || undefined,
                waitingBookingId: input.waitingBookingId || undefined,
                version: x.version + 1,
                history: [...x.history, { at: now(), actorName: name, action: `Waiting for ${what}` }],
              }
            : x,
        ),
      };
    },
  );
}

export function clearTaskWaiting(taskId: string): Result {
  return guard(
    (s) => {
      const t = s.tasks.find((x) => x.id === taskId);
      return Boolean(t) && (isOrganiser(s) || t!.assigneeId === s.activeTravellerId);
    },
    (prev) => ({
      ...prev,
      tasks: prev.tasks.map((x) =>
        x.id === taskId ? { ...x, waitingFor: undefined, checkBackOn: undefined, waitingBookingId: undefined, version: x.version + 1 } : x,
      ),
    }),
  );
}

/* ---------------- CE04 presentation state (this device only) ---------------- */

const SEEN_KEY = "commonroute.pickup.v1";
type SeenStore = Record<string, { version?: number; dismissed: string[] }>;

function readSeen(): SeenStore {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(SEEN_KEY) ?? "{}") as SeenStore;
  } catch {
    return {};
  }
}

export function pickUpState(tripId: string, travellerId: string) {
  return readSeen()[`${tripId}:${travellerId}`] ?? { dismissed: [] };
}

function writeSeen(tripId: string, travellerId: string, patch: Partial<{ version: number; dismissed: string[] }>) {
  if (typeof window === "undefined") return;
  const all = readSeen();
  const key = `${tripId}:${travellerId}`;
  all[key] = { dismissed: [], ...all[key], ...patch };
  window.localStorage.setItem(SEEN_KEY, JSON.stringify(all));
}

/** Record which plan revision was looked at. Looking is not acknowledging. */
export function markPlanSeen(tripId: string, travellerId: string, version: number) {
  writeSeen(tripId, travellerId, { version });
}

export function dismissCue(tripId: string, travellerId: string, cueId: string) {
  const cur = pickUpState(tripId, travellerId);
  writeSeen(tripId, travellerId, { dismissed: [...new Set([...cur.dismissed, cueId])] });
}

/* ---------------- CE05 ---------------- */

function mayProposeFor(s: KintripState, travellerIds: string[]) {
  return isOrganiser(s) || travellerIds.every((id) => canEditFor(s, id));
}

export function createArrangement(input: {
  kind: ArrangementKind;
  travellerIds: string[];
  dayNumber: number;
  itemId?: string | undefined;
  detail: string;
  minutes?: number | undefined;
  restStart?: string | undefined;
  reason?: string | undefined;
  endDate?: string | undefined;
}): Result {
  if (!ARRANGEMENTS_ENABLED) return "Temporary arrangements are switched off on this deployment.";
  return guard(
    (s) => mayProposeFor(s, input.travellerIds),
    (prev) => {
      if (!prev.itinerary) return "Build the itinerary first, then arrange changes to it.";
      if (input.travellerIds.length === 0) return "Choose who this affects.";
      if (!input.travellerIds.every((id) => prev.travellers.some((t) => t.id === id))) return "Someone chosen is no longer on the trip.";
      if (!prev.itinerary.days.some((d) => d.day === input.dayNumber)) return "Pick a day in the plan.";
      if (!input.detail.trim()) return "Describe the change in a few words.";
      if (input.kind === "later_start" && !(input.minutes && input.minutes > 0 && input.minutes <= 240)) return "Choose how much later, up to four hours.";
      if (input.kind === "subgroup_rest" && !/^\d{2}:\d{2}$/.test(input.restStart ?? "")) return "Choose when the rest starts.";
      if (input.kind === "taxi_leg" && !input.itemId) return "Choose which stop the taxi goes to.";
      const at = now();
      const name = actorName(prev, prev.activeTravellerId);
      const a: Arrangement = {
        id: `ar-${uid()}`,
        kind: input.kind,
        travellerIds: input.travellerIds,
        dayNumber: input.dayNumber,
        itemId: input.itemId,
        detail: input.detail.trim().slice(0, 200),
        minutes: input.minutes,
        restStart: input.restStart,
        reason: input.reason?.trim() ? input.reason.trim().slice(0, 500) : undefined,
        endDate: input.endDate || undefined,
        status: "proposed",
        version: 1,
        responses: [],
        createdBy: prev.activeTravellerId,
        createdAt: at,
        history: [{ at, by: name, action: "Proposed" }],
      };
      return withNotice({ ...prev, arrangements: [a, ...prev.arrangements] }, { text: `A change was proposed for day ${a.dayNumber}: ${a.detail}`, audience: "organisers" });
    },
  );
}

/** Answer for yourself, or for someone you are the authorised helper of. */
export function respondToArrangement(id: string, travellerId: string, state: "confirmed" | "declined"): Result {
  return guard(
    (s) => canEditFor(s, travellerId),
    (prev) => {
      const a = prev.arrangements.find((x) => x.id === id);
      if (!a) return "That change is no longer there.";
      if (arrangementStatus(a) !== "proposed") return "This change is no longer open for answers.";
      if (!a.travellerIds.includes(travellerId)) return "This change does not affect that person.";
      const actor = prev.activeTravellerId;
      const response = { travellerId, state, byId: actor, proxy: actor !== travellerId, version: a.version, at: now() };
      const responses = [...a.responses.filter((r) => !(r.travellerId === travellerId && r.version === a.version)), response];
      return {
        ...prev,
        arrangements: prev.arrangements.map((x) =>
          x.id === id ? { ...x, responses, history: [...x.history, { at: now(), by: actorName(prev, actor), action: state === "confirmed" ? "Confirmed" : "Declined" }] } : x,
        ),
      };
    },
  );
}

/** Change the substance. Earlier answers become history and fresh answers are needed. */
export function editArrangement(id: string, patch: { detail?: string | undefined; minutes?: number | undefined; restStart?: string | undefined; travellerIds?: string[] | undefined }): Result {
  return guard(
    (s) => {
      const a = s.arrangements.find((x) => x.id === id);
      return Boolean(a) && (isOrganiser(s) || a!.createdBy === s.activeTravellerId);
    },
    (prev) => {
      const a = prev.arrangements.find((x) => x.id === id)!;
      if (a.status !== "proposed") return "Only a proposed change can be edited.";
      const next: Arrangement = {
        ...a,
        detail: patch.detail?.trim() || a.detail,
        minutes: patch.minutes ?? a.minutes,
        restStart: patch.restStart ?? a.restStart,
        travellerIds: patch.travellerIds ?? a.travellerIds,
        version: a.version + 1,
        history: [...a.history, { at: now(), by: actorName(prev, prev.activeTravellerId), action: "Changed — answers needed again" }],
      };
      return { ...prev, arrangements: prev.arrangements.map((x) => (x.id === id ? next : x)) };
    },
  );
}

export function withdrawArrangement(id: string): Result {
  return guard(
    (s) => {
      const a = s.arrangements.find((x) => x.id === id);
      return Boolean(a) && (isOrganiser(s) || a!.createdBy === s.activeTravellerId);
    },
    (prev) => ({
      ...prev,
      arrangements: prev.arrangements.map((x) =>
        x.id === id ? { ...x, status: "withdrawn" as const, history: [...x.history, { at: now(), by: actorName(prev, prev.activeTravellerId), action: "Withdrawn" }] } : x,
      ),
    }),
  );
}

/**
 * Put the change into the draft plan. Organiser authority only; the plan
 * goes back to draft so the usual publication checks (hours, bookings,
 * needs, funding, dependencies) run before anyone sees it.
 */
export function applyArrangement(id: string): Result {
  if (!ARRANGEMENTS_ENABLED) return "Temporary arrangements are switched off on this deployment.";
  return guard(isOrganiser, (prev) => {
    const a = prev.arrangements.find((x) => x.id === id);
    if (!a) return "That change is no longer there.";
    if (arrangementStatus(a) !== "proposed") return "Only an open, proposed change can be applied.";
    if (!prev.itinerary) return "There is no plan to change.";
    const day = prev.itinerary.days.find((d) => d.day === a.dayNumber);
    if (!day) return "That day is no longer in the plan.";
    const toMin = (t: string) => {
      const [h, m] = t.split(":").map(Number);
      return (h ?? 0) * 60 + (m ?? 0);
    };
    const fmt = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
    let items = day.items;
    if (a.kind === "later_start") {
      const first = [...items].sort((x, y) => toMin(x.start) - toMin(y.start))[0];
      if (!first) return "That day has no stops to move.";
      if (first.locked) return "The first stop is locked, so it cannot move. Unlock it or choose another change.";
      items = items.map((i) => (i.id === first.id ? { ...i, start: fmt(toMin(i.start) + (a.minutes ?? 0)), note: [i.note, a.detail].filter(Boolean).join(" · ") } : i));
    } else if (a.kind === "taxi_leg") {
      if (!items.some((i) => i.id === a.itemId)) return "That stop is no longer on the day.";
      items = items.map((i) => (i.id === a.itemId ? { ...i, note: [i.note, a.detail].filter(Boolean).join(" · ") } : i));
    } else {
      items = [
        ...items,
        { id: uid(), kind: "rest" as const, title: a.detail, start: a.restStart ?? "14:00", durationMin: 90, rigidity: "rest" as const, note: "Some of the group" },
      ];
    }
    const days = prev.itinerary.days.map((d) => (d.day === a.dayNumber ? { ...d, items } : d));
    const at = now();
    const name = actorName(prev, prev.activeTravellerId);
    const next: KintripState = {
      ...prev,
      itinerary: { ...prev.itinerary, days, published: false },
      arrangements: prev.arrangements.map((x) => (x.id === id ? { ...x, status: "applied" as const, appliedAt: at, history: [...x.history, { at, by: name, action: "Added to the draft plan" }] } : x)),
    };
    return logAudit(next, "Arrangement applied to draft", `Day ${a.dayNumber}: ${a.detail}`);
  });
}
