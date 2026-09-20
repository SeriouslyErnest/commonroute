import type {
  Attraction,
  DecisionEvent,
  DeclineReasonCode,
  ItineraryDay,
  KintripState,
  Notification,
  Severity,
  Suggestion,
  SuggestionCost,
  SuggestionStatus,
  Traveller,
  TripRole,
  VoteValue,
} from "./types";

/* ---------------- labels ---------------- */

export const STATUS_LABEL: Record<SuggestionStatus, string> = {
  suggested: "Suggested",
  under_review: "On hold",
  provisionally_approved: "Provisionally approved",
  sponsor_approval_required: "Waiting on sponsor",
  approved: "Approved",
  backup: "Backup",
  declined: "Not included",
  booked: "Booked",
  cancelled: "Cancelled",
};

export const DECLINE_REASONS: Record<DeclineReasonCode, string> = {
  OVER_BUDGET: "Over budget",
  TOO_FAR: "Too far from other activities",
  DOES_NOT_FIT_NEEDS: "Does not fit group needs",
  NOT_ENOUGH_TIME: "Not enough time",
  SIMILAR_SELECTED: "Similar activity already selected",
  UNAVAILABLE: "Unavailable or sold out",
  CONFLICTS_BOOKING: "Conflicts with a confirmed booking",
  LOW_INTEREST: "Low group interest",
  SAVED_AS_ALTERNATIVE: "Saved as an alternative",
  OTHER: "Other",
};

export const FUNDING_LABEL = {
  free: "Free",
  self_paid: "Paid by each person",
  shared: "Shared expense",
  major: "Major commitment",
  already_booked: "Already booked",
} as const;

export const MODE_LABEL = {
  organiser: "Organiser decides",
  majority: "Group majority",
  sponsor: "Sponsor approval",
  consensus: "Full agreement",
} as const;

export const ROLE_LABEL: Record<TripRole, string> = {
  owner: "Owner",
  organiser: "Organiser",
  sponsor: "Budget sponsor",
  contributor: "Contributor",
  viewer: "Viewer",
};

export const SEVERITY_LABEL: Record<Severity, string> = {
  preference: "Preference",
  comfort_need: "Comfort need",
  hard_limit: "Hard limit",
};

/* ---------------- defaults & migration ---------------- */

export function defaultCost(a?: Attraction | undefined): SuggestionCost {
  const perPerson = a?.cost === "$$" ? 40 : a?.cost === "$" ? 15 : 0;
  return {
    currency: "SGD",
    perPerson,
    estimateType: perPerson === 0 ? "exact" : "estimated",
    funding: perPerson === 0 ? "free" : perPerson >= 30 ? "shared" : "self_paid",
  };
}

export function newSuggestion(a: Attraction, by?: string): Suggestion {
  return {
    attractionId: a.id,
    status: "suggested",
    cost: defaultCost(a),
    backupTags: [],
    suggestedBy: by,
    history: [],
  };
}

const uid = () => Math.random().toString(36).slice(2, 10);

/** Bring older saved trips up to the governance data model. */
export function normalizeState(input: KintripState): KintripState {
  const state = { ...input } as KintripState;
  const travellers: Traveller[] = (state.travellers ?? []).map((t) => ({
    ...t,
    roles:
      t.roles && t.roles.length > 0
        ? t.roles
        : t.id === state.trip?.organiserId || t.role === "organiser"
          ? (["owner", "organiser"] as TripRole[])
          : (["contributor"] as TripRole[]),
    needs: t.needs ?? [],
    managementMode: t.managementMode ?? (t.responsibleAdultId ? "assisted" : "self"),
    assistAccepted: t.assistAccepted ?? (t.responsibleAdultId ? true : undefined),
    canVote: t.canVote ?? true,
    consentLog: t.consentLog ?? [],
  }));

  const suggestions: Record<string, Suggestion> = { ...(state.suggestions ?? {}) };
  for (const a of state.attractions ?? []) {
    if (!suggestions[a.id]) suggestions[a.id] = newSuggestion(a);
  }

  return {
    ...state,
    travellers,
    suggestions,
    decisions: state.decisions ?? {
      mode: "organiser",
      voteThreshold: 0.6,
      quorum: 0.5,
      organiserOverrideAllowed: true,
      sponsorThreshold: 100,
      currency: "SGD",
      publication: "organisers",
    },
    sponsorApprovals: state.sponsorApprovals ?? [],
    notifications: state.notifications ?? [],
    audit: state.audit ?? [],
    bookings: state.bookings ?? [],
    tasks: state.tasks ?? [],
    packing: state.packing ?? [],
  };
}

/* ---------------- assisted travellers ---------------- */

/** People whose vote counts. Care-only profiles are left out of the denominators. */
export function votingTravellers(state: KintripState): Traveller[] {
  return state.travellers.filter((t) => t.canVote !== false);
}

export function managerOf(state: KintripState, travellerId: string): Traveller | undefined {
  const t = state.travellers.find((x) => x.id === travellerId);
  if (!t?.responsibleAdultId || t.managementMode !== "assisted") return undefined;
  if (t.assistAccepted === false) return undefined;
  return state.travellers.find((x) => x.id === t.responsibleAdultId);
}

/**
 * Whether the person acting may enter answers for this traveller: for
 * themselves always, or for someone who has an accepted assistance link.
 */
export function canEditFor(state: KintripState, travellerId: string, actorId = state.activeTravellerId) {
  if (travellerId === actorId) return true;
  const target = state.travellers.find((t) => t.id === travellerId);
  if (!target) return false;
  return (
    target.managementMode === "assisted" &&
    target.assistAccepted !== false &&
    target.responsibleAdultId === actorId
  );
}

/** People the person acting may answer for, themselves included. */
export function editableTravellers(state: KintripState, actorId = state.activeTravellerId): Traveller[] {
  return state.travellers.filter((t) => canEditFor(state, t.id, actorId));
}

export function proxyLabel(state: KintripState, travellerId: string, actorId = state.activeTravellerId) {
  if (travellerId === actorId) return "";
  return `Entered by ${actorName(state, actorId)} for ${actorName(state, travellerId)}`;
}

/* ---------------- permissions ---------------- */

export function roleOf(state: KintripState, travellerId: string): TripRole[] {
  return state.travellers.find((t) => t.id === travellerId)?.roles ?? ["contributor"];
}

export function isOrganiser(state: KintripState, id = state.activeTravellerId) {
  const r = roleOf(state, id);
  return r.includes("owner") || r.includes("organiser");
}

export function isOwner(state: KintripState, id = state.activeTravellerId) {
  return roleOf(state, id).includes("owner");
}

export function isSponsor(state: KintripState, id = state.activeTravellerId) {
  return roleOf(state, id).includes("sponsor");
}

export function canPublish(state: KintripState, id = state.activeTravellerId) {
  return state.decisions.publication === "owner" ? isOwner(state, id) : isOrganiser(state, id);
}

export function hasSponsor(state: KintripState) {
  return state.travellers.some((t) => t.roles.includes("sponsor"));
}

export function actorName(state: KintripState, id = state.activeTravellerId) {
  return state.travellers.find((t) => t.id === id)?.name ?? "Someone";
}

/* ---------------- votes ---------------- */

const VOTE_SCORE: Record<VoteValue, number> = {
  MUST_GO: 3,
  WOULD_LIKE: 2,
  DONT_MIND: 0.5,
  SKIP: -1.5,
};

export interface VoteTally {
  MUST_GO: number;
  WOULD_LIKE: number;
  DONT_MIND: number;
  SKIP: number;
  cast: number;
  score: number;
  support: number; // share of travellers who want it
}

export function tallyFor(state: KintripState, attractionId: string): VoteTally {
  const t: VoteTally = {
    MUST_GO: 0,
    WOULD_LIKE: 0,
    DONT_MIND: 0,
    SKIP: 0,
    cast: 0,
    score: 0,
    support: 0,
  };
  for (const tr of votingTravellers(state)) {
    const v = state.votes[tr.id]?.[attractionId];
    if (!v) continue;
    t[v] += 1;
    t.cast += 1;
    t.score += VOTE_SCORE[v];
  }
  const people = Math.max(1, votingTravellers(state).length);
  t.support = (t.MUST_GO + t.WOULD_LIKE) / people;
  return t;
}

/* ---------------- group fit ---------------- */

const WALK_RANK: Record<string, number> = { low: 0, moderate: 1, high: 2 };

export interface GroupFit {
  label: "Strong" | "Workable" | "Difficult";
  percent: number;
  positives: string[];
  warnings: string[];
  hardLimitConflict: boolean;
}

export function groupFit(state: KintripState, a: Attraction): GroupFit {
  const tally = tallyFor(state, a.id);
  const people = Math.max(1, votingTravellers(state).length);
  const interested = tally.MUST_GO + tally.WOULD_LIKE;
  const positives: string[] = [];
  const warnings: string[] = [];
  let hardLimitConflict = false;

  let percent = Math.round((interested / people) * 60);

  if (interested > 0) positives.push(`Popular with ${interested} of ${people} travellers`);
  if (a.indoor) positives.push("Indoor, so it works in most weather");
  if (a.cost === "Free") positives.push("No entry cost");
  if (WALK_RANK[a.walking] === 0) positives.push("Low walking effort");

  // comfort needs and hard limits, never naming a private owner
  for (const t of state.travellers) {
    for (const need of t.needs ?? []) {
      const relevant =
        (need.type === "max_walk" && WALK_RANK[a.walking]! >= 2) ||
        (need.type === "step_free" && WALK_RANK[a.walking]! >= 2 && !a.indoor) ||
        (need.type === "crowds" && a.category.toLowerCase().includes("shopping")) ||
        (need.type === "heat" && !a.indoor && WALK_RANK[a.walking]! >= 1);
      if (!relevant) continue;
      const who = need.visibility === "group" ? `${t.name}: ` : "";
      if (need.severity === "hard_limit") {
        hardLimitConflict = true;
        warnings.push(`${who}${need.label} — this is a hard limit for one traveller`);
      } else if (need.severity === "comfort_need") {
        warnings.push(`${who}${need.label} — plan a shorter visit or a rest nearby`);
      }
    }
  }

  if (tally.SKIP > 0) warnings.push(`${tally.SKIP} traveller(s) would rather skip this`);

  const suggestion = state.suggestions[a.id];
  if (suggestion) {
    if (suggestion.cost.funding === "shared" || suggestion.cost.funding === "major") {
      const approved = state.sponsorApprovals.find(
        (s) => s.suggestionId === a.id && (s.decision === "group_funded" || s.decision === "individually_paid"),
      );
      warnings.push(approved ? "Shared cost approved by the sponsor" : "Shared cost still needs sponsor approval");
    }
    if (suggestion.cost.estimateType !== "exact" && suggestion.cost.perPerson > 0) {
      warnings.push(`Cost is an estimate (${suggestion.cost.currency} ${suggestion.cost.perPerson} per person)`);
    }
  }

  percent += a.indoor ? 8 : 0;
  percent += a.cost === "Free" ? 8 : 0;
  percent += 2 - WALK_RANK[a.walking]! * 6;
  percent -= tally.SKIP * 5;
  if (hardLimitConflict) percent -= 40;
  percent = Math.max(5, Math.min(99, percent + 25));

  const label: GroupFit["label"] = hardLimitConflict
    ? "Difficult"
    : percent >= 70
      ? "Strong"
      : percent >= 45
        ? "Workable"
        : "Difficult";

  return { label, percent, positives: positives.slice(0, 3), warnings, hardLimitConflict };
}

/* ---------------- everyone gets a win ---------------- */

export interface Fairness {
  covered: string[];
  uncovered: Traveller[];
  total: number;
}

export function fairness(state: KintripState): Fairness {
  const planned = new Set<string>();
  for (const day of state.itinerary?.days ?? []) {
    for (const item of day.items) if (item.attractionId) planned.add(item.attractionId);
  }
  // Fall back to approved suggestions when no plan exists yet.
  if (planned.size === 0) {
    for (const [id, s] of Object.entries(state.suggestions)) {
      if (s.status === "approved" || s.status === "booked") planned.add(id);
    }
  }
  const covered: string[] = [];
  const uncovered: Traveller[] = [];
  for (const t of votingTravellers(state)) {
    const win = [...planned].some((id) => {
      const vote = state.votes[t.id]?.[id];
      if (vote === "MUST_GO") return true;
      const a = state.attractions.find((x) => x.id === id);
      return !!a && t.preferences.interests.includes(a.category);
    });
    if (win) covered.push(t.id);
    else uncovered.push(t);
  }
  return { covered, uncovered, total: votingTravellers(state).length };
}

/* ---------------- energy ---------------- */

export interface DayEnergy {
  label: "Comfortable" | "Moderate" | "Demanding";
  walkingMinutes: number;
  transfers: number;
  outdoorStops: number;
  explanation: string;
}

export function dayEnergy(state: KintripState, day: ItineraryDay): DayEnergy {
  let walking = 0;
  let transfers = 0;
  let outdoor = 0;
  for (const item of day.items) {
    if (item.kind === "travel") transfers += 1;
    if (item.kind !== "activity") continue;
    const a = state.attractions.find((x) => x.id === item.attractionId);
    const rank = WALK_RANK[item.walking ?? a?.walking ?? "moderate"] ?? 1;
    walking += Math.round((item.durationMin * (rank + 1)) / 4);
    if (a && !a.indoor) outdoor += 1;
  }
  const score = walking / 30 + transfers * 0.6 + outdoor * 0.5;
  const label: DayEnergy["label"] = score >= 8 ? "Demanding" : score >= 5 ? "Moderate" : "Comfortable";
  return {
    label,
    walkingMinutes: walking,
    transfers,
    outdoorStops: outdoor,
    explanation: `About ${walking} minutes on foot (estimated), ${transfers} transfer${transfers === 1 ? "" : "s"}, ${outdoor} outdoor stop${outdoor === 1 ? "" : "s"}.`,
  };
}

/* ---------------- publication checks ---------------- */

export interface PublishCheck {
  id: string;
  text: string;
  blocking: boolean;
}

export function publicationChecks(state: KintripState): PublishCheck[] {
  const checks: PublishCheck[] = [];
  const acknowledged = new Set(state.itinerary?.acknowledged ?? []);
  const plannedIds = new Set(
    (state.itinerary?.days ?? []).flatMap((d) => d.items.map((i) => i.attractionId).filter(Boolean) as string[]),
  );

  for (const id of plannedIds) {
    const s = state.suggestions[id];
    const a = state.attractions.find((x) => x.id === id);
    if (!s || !a) continue;
    const needsSponsor = s.cost.funding === "shared" || s.cost.funding === "major";
    const approved = state.sponsorApprovals.some(
      (x) => x.suggestionId === id && (x.decision === "group_funded" || x.decision === "individually_paid"),
    );
    if (needsSponsor && hasSponsor(state) && !approved) {
      checks.push({ id: `sponsor-${id}`, text: `${a.name} needs sponsor approval for its shared cost`, blocking: true });
    }
    if (groupFit(state, a).hardLimitConflict) {
      checks.push({ id: `hard-${id}`, text: `${a.name} conflicts with a traveller's hard limit`, blocking: true });
    }
    if (s.cost.estimateType !== "exact" && s.cost.perPerson > 0) {
      checks.push({ id: `price-${id}`, text: `${a.name} cost is still an estimate`, blocking: false });
    }
  }

  const f = fairness(state);
  for (const t of f.uncovered) {
    checks.push({ id: `win-${t.id}`, text: `${t.name} has no top-choice activity in this plan`, blocking: false });
  }

  if (!state.trip.startDate || !state.trip.endDate || state.trip.endDate < state.trip.startDate) {
    checks.push({ id: "dates", text: "Trip dates are missing or in the wrong order", blocking: true });
  }
  if (!state.itinerary || state.itinerary.days.length === 0) {
    checks.push({ id: "plan", text: "There is no itinerary to publish yet", blocking: true });
  }

  const budget = state.decisions.sharedBudget;
  if (budget && budget > 0) {
    const spend = approvedSpend(state);
    if (spend.total > budget) {
      checks.push({
        id: "budget",
        text: `Approved spending (${spend.currency} ${spend.total}) is over the shared budget of ${spend.currency} ${budget}`,
        blocking: false,
      });
    }
  }
  // An organiser can accept a warning in writing; accepted items stop blocking.
  return checks.map((c) => (acknowledged.has(c.id) ? { ...c, blocking: false } : c));
}

export function approvedSpend(state: KintripState) {
  const currency = state.decisions.currency;
  let total = 0;
  let pending = 0;
  const people = Math.max(1, state.travellers.length);
  for (const [id, s] of Object.entries(state.suggestions)) {
    if (s.cost.funding !== "shared" && s.cost.funding !== "major") continue;
    const amount = s.cost.perPerson * people;
    const approved = state.sponsorApprovals.some(
      (x) => x.suggestionId === id && x.decision === "group_funded",
    );
    if (approved) total += amount;
    else if (s.status !== "declined" && s.status !== "cancelled") pending += amount;
  }
  return { currency, total, pending };
}

/* ---------------- state transitions ---------------- */

export function recordDecision(
  state: KintripState,
  attractionId: string,
  to: SuggestionStatus,
  opts: { reasonCode?: DeclineReasonCode; note?: string; privateReason?: boolean } = {},
): KintripState {
  const suggestion = state.suggestions[attractionId];
  const a = state.attractions.find((x) => x.id === attractionId);
  if (!suggestion || !a) return state;
  const tally = tallyFor(state, attractionId);
  const fit = groupFit(state, a);
  const event: DecisionEvent = {
    id: uid(),
    at: new Date().toISOString(),
    actorId: state.activeTravellerId,
    actorName: actorName(state),
    from: suggestion.status,
    to,
    reasonCode: opts.reasonCode,
    note: opts.privateReason ? undefined : opts.note,
    privateReason: opts.privateReason,
    voteSnapshot: `${tally.MUST_GO} must-go · ${tally.WOULD_LIKE} would like · ${tally.SKIP} skip`,
    fitSnapshot: `Group Fit ${fit.label} (${fit.percent}%)`,
  };
  const next: Suggestion = {
    ...suggestion,
    status: to,
    history: [event, ...suggestion.history],
    ...(to === "sponsor_approval_required" ? { sponsorRequestedAt: event.at } : {}),
  };
  return withNotice(
    {
      ...state,
      suggestions: { ...state.suggestions, [attractionId]: next },
      audit: [
        {
          id: uid(),
          at: event.at,
          actorName: event.actorName,
          action: `Suggestion ${STATUS_LABEL[to].toLowerCase()}`,
          detail: `${a.name}${opts.reasonCode ? ` — ${DECLINE_REASONS[opts.reasonCode]}` : ""}`,
        },
        ...state.audit,
      ].slice(0, 200),
    },
    to === "sponsor_approval_required"
      ? { text: `${a.name} is waiting for sponsor approval`, audience: "sponsors" }
      : { text: `${a.name}: ${STATUS_LABEL[to].toLowerCase()}`, audience: "all" },
  );
}

export function withNotice(
  state: KintripState,
  notice: { text: string; audience: Notification["audience"] },
): KintripState {
  const item: Notification = {
    id: uid(),
    at: new Date().toISOString(),
    text: notice.text,
    audience: notice.audience,
    read: false,
  };
  return { ...state, notifications: [item, ...state.notifications].slice(0, 60) };
}

/** Updates this person is allowed to see, newest first. */
export function visibleNotifications(state: KintripState): Notification[] {
  const roles = roleOf(state, state.activeTravellerId);
  return state.notifications.filter((n) => {
    if (n.audience === "all") return true;
    if (n.audience === "organisers") return roles.includes("organiser") || roles.includes("owner");
    return roles.includes("sponsor") || roles.includes("owner");
  });
}

export function unreadCount(state: KintripState): number {
  return visibleNotifications(state).filter((n) => !n.read).length;
}

export function logAudit(state: KintripState, action: string, detail: string): KintripState {
  return {
    ...state,
    audit: [
      { id: uid(), at: new Date().toISOString(), actorName: actorName(state), action, detail },
      ...state.audit,
    ].slice(0, 200),
  };
}

export function publicDeclineReason(s: Suggestion): string | null {
  const last = s.history[0];
  if (!last || last.to !== "declined") return null;
  if (last.privateReason) return "Does not fit current group requirements.";
  const base = last.reasonCode ? DECLINE_REASONS[last.reasonCode] : "Not included";
  return last.note ? `${base} — ${last.note}` : base;
}

/** Statuses the itinerary generator may use. */
export function eligibleAttractions(state: KintripState): Attraction[] {
  return state.attractions.filter((a) => {
    const s = state.suggestions[a.id];
    return s?.status === "approved" || s?.status === "booked";
  });
}

export function backupAttractions(state: KintripState, tag?: string): Attraction[] {
  return state.attractions.filter((a) => {
    const s = state.suggestions[a.id];
    if (s?.status !== "backup") return false;
    return !tag || s.backupTags.length === 0 || s.backupTags.includes(tag);
  });
}
