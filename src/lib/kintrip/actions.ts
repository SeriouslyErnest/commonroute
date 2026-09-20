import { setState } from "./store";
import {
  logAudit,
  recordDecision,
  withNotice,
  actorName,
  isOrganiser,
  isSponsor,
  canPublish,
  publicationChecks,
  canEditFor,
  proxyLabel,
} from "./governance";
import type {
  AttendanceRecord,
  AttendanceState,
  Booking,
  ItineraryDay,
  PlanChange,
  PublishedChange,
  DeclineReasonCode,
  DecisionSettings,
  KintripState,
  PackingItem,
  SponsorApproval,
  SponsorDecision,
  SuggestionCost,
  SuggestionStatus,
  Traveller,
  TravellerConstraint,
  TripRole,
  TripTask,
  VoteValue,
} from "./types";

const uid = () => Math.random().toString(36).slice(2, 10);

/** Organiser decision on one suggested place. */
export function decideSuggestion(
  attractionId: string,
  to: SuggestionStatus,
  opts: { reasonCode?: DeclineReasonCode; note?: string; privateReason?: boolean } = {},
) {
  setState((prev) => {
    if (!isOrganiser(prev)) return prev;
    return recordDecision(prev, attractionId, to, opts);
  });
}

export function bulkDecide(ids: string[], to: SuggestionStatus) {
  setState((prev) => {
    if (!isOrganiser(prev)) return prev;
    return ids.reduce((acc, id) => recordDecision(acc, id, to), prev);
  });
}

export function updateCost(attractionId: string, cost: Partial<SuggestionCost>) {
  setState((prev) => {
    const s = prev.suggestions[attractionId];
    if (!s || !isOrganiser(prev)) return prev;
    return logAudit(
      { ...prev, suggestions: { ...prev.suggestions, [attractionId]: { ...s, cost: { ...s.cost, ...cost } } } },
      "Cost updated",
      prev.attractions.find((a) => a.id === attractionId)?.name ?? attractionId,
    );
  });
}

export function setBackupTags(attractionId: string, tags: string[]) {
  setState((prev) => {
    const s = prev.suggestions[attractionId];
    if (!s) return prev;
    return { ...prev, suggestions: { ...prev.suggestions, [attractionId]: { ...s, backupTags: tags } } };
  });
}

export function requestSponsorApproval(attractionId: string) {
  decideSuggestion(attractionId, "sponsor_approval_required");
}

export function recordSponsorDecision(
  attractionId: string,
  decision: SponsorDecision,
  amount: number,
  note?: string,
) {
  setState((prev) => {
    if (!isSponsor(prev)) return prev;
    const approval: SponsorApproval = {
      id: uid(),
      suggestionId: attractionId,
      sponsorId: prev.activeTravellerId,
      sponsorName: actorName(prev),
      decision,
      amount,
      currency: prev.decisions.currency,
      note,
      at: new Date().toISOString(),
    };
    const withApproval = { ...prev, sponsorApprovals: [approval, ...prev.sponsorApprovals] };
    const name = prev.attractions.find((a) => a.id === attractionId)?.name ?? attractionId;
    const next =
      decision === "declined"
        ? { ...withApproval, activeTravellerId: prev.activeTravellerId }
        : withApproval;
    const status: SuggestionStatus =
      decision === "declined" ? "declined" : decision === "hold" ? "under_review" : "approved";
    const s = next.suggestions[attractionId];
    const updated = s
      ? recordDecision(next, attractionId, status, note ? { note } : {})
      : next;
    return withNotice(
      logAudit(updated, "Sponsor decision", `${name}: ${decision.replace("_", " ")}`),
      { text: `${name}: sponsor said ${decision.replace(/_/g, " ")}`, audience: "all" },
    );
  });
}

export function setRoles(travellerId: string, roles: TripRole[]) {
  setState((prev) => {
    if (!isOrganiser(prev)) return prev;
    const owners = prev.travellers.filter((t) => t.roles.includes("owner"));
    if (owners.length === 1 && owners[0]!.id === travellerId && !roles.includes("owner")) return prev;
    const travellers = prev.travellers.map((t) => (t.id === travellerId ? { ...t, roles } : t));
    const name = prev.travellers.find((t) => t.id === travellerId)?.name ?? "";
    return logAudit({ ...prev, travellers }, "Roles updated", `${name}: ${roles.join(", ")}`);
  });
}

export function updateDecisionSettings(patch: Partial<DecisionSettings>) {
  setState((prev) => {
    if (!isOrganiser(prev)) return prev;
    return logAudit(
      { ...prev, decisions: { ...prev.decisions, ...patch } },
      "Decision settings updated",
      Object.keys(patch).join(", "),
    );
  });
}

export function addNeed(travellerId: string, need: Omit<TravellerConstraint, "id">) {
  setState((prev) => ({
    ...prev,
    travellers: prev.travellers.map((t) =>
      t.id === travellerId ? { ...t, needs: [...(t.needs ?? []), { ...need, id: uid() }] } : t,
    ),
  }));
}

export function removeNeed(travellerId: string, needId: string) {
  setState((prev) => ({
    ...prev,
    travellers: prev.travellers.map((t) =>
      t.id === travellerId ? { ...t, needs: (t.needs ?? []).filter((n) => n.id !== needId) } : t,
    ),
  }));
}

export function toggleItemLock(dayNumber: number, itemId: string) {
  setState((prev) => {
    if (!prev.itinerary || !isOrganiser(prev)) return prev;
    const days = prev.itinerary.days.map((d) =>
      d.day !== dayNumber
        ? d
        : {
            ...d,
            items: d.items.map((i) =>
              i.id === itemId
                ? { ...i, locked: !i.locked, lockedBy: !i.locked ? actorName(prev) : undefined }
                : i,
            ),
          },
    );
    return { ...prev, itinerary: { ...prev.itinerary, days } };
  });
}

export function publishItinerary(acknowledged: string[]) {
  setState((prev) => {
    if (!prev.itinerary || !canPublish(prev)) return prev;
    const blocking = publicationChecks(prev).filter((c) => c.blocking);
    if (blocking.length > 0) return prev;
    const itinerary = {
      ...prev.itinerary,
      published: true,
      finalised: true,
      publishedAt: new Date().toISOString(),
      publishedBy: actorName(prev),
      acknowledged,
    };
    const before = prev.publishedSnapshot;
    const changes: PlanChange[] = before ? diffDays(before.days, itinerary.days) : [];
    const record: PublishedChange | null =
      before && changes.length > 0
        ? {
            id: uid(),
            version: itinerary.version,
            previousVersion: before.version,
            at: itinerary.publishedAt!,
            by: itinerary.publishedBy!,
            changes,
            acknowledged: [],
          }
        : null;
    const next: KintripState = {
      ...prev,
      itinerary,
      publishedSnapshot: { version: itinerary.version, days: itinerary.days },
      publishedChanges: record ? [record, ...(prev.publishedChanges ?? [])] : (prev.publishedChanges ?? []),
    };
    return withNotice(logAudit(next, "Itinerary published", `Version ${itinerary.version}`), {
      text: record
        ? `The plan changed — ${changes.length} ${changes.length === 1 ? "change" : "changes"} to look at`
        : "The group plan has been published",
      audience: "all",
    });
  });
}

export function unpublishItinerary() {
  setState((prev) => {
    if (!prev.itinerary || !canPublish(prev)) return prev;
    return logAudit(
      { ...prev, itinerary: { ...prev.itinerary, published: false, finalised: false } },
      "Itinerary unpublished",
      "Back to draft",
    );
  });
}

/** Split one day so part of the group does something else, then meet back up. */
export function splitDay(
  dayNumber: number,
  input: { memberIds: string[]; activity: string; label: string; meetingPoint: string; meetingTime: string },
) {
  setState((prev) => {
    if (!prev.itinerary || !isOrganiser(prev)) return prev;
    const rest = prev.travellers.filter((t) => !input.memberIds.includes(t.id)).map((t) => t.id);
    const days = prev.itinerary.days.map((d) =>
      d.day === dayNumber
        ? {
            ...d,
            split: {
              id: uid(),
              groups: [
                { id: uid(), label: "Main group", memberIds: rest, activity: "Stays with the planned day" },
                { id: uid(), label: input.label || "Second group", memberIds: input.memberIds, activity: input.activity },
              ],
              meetingPoint: input.meetingPoint,
              meetingTime: input.meetingTime,
              approved: true,
            },
          }
        : d,
    );
    const next = { ...prev, itinerary: { ...prev.itinerary, days } };
    return withNotice(
      logAudit(next, "Day split", `Day ${dayNumber}: ${input.activity}`),
      { text: `Day ${dayNumber} splits into two groups, meeting at ${input.meetingPoint} at ${input.meetingTime}`, audience: "all" },
    );
  });
}

export function rejoinDay(dayNumber: number) {
  setState((prev) => {
    if (!prev.itinerary || !isOrganiser(prev)) return prev;
    const days = prev.itinerary.days.map((d) => (d.day === dayNumber ? { ...d, split: undefined } : d));
    return logAudit({ ...prev, itinerary: { ...prev.itinerary, days } }, "Day rejoined", `Day ${dayNumber}`);
  });
}

/** Organiser accepts a publishing warning, with a record in the history. */
export function acknowledgeCheck(checkId: string, text: string) {
  setState((prev) => {
    if (!prev.itinerary || !isOrganiser(prev)) return prev;
    const acknowledged = [...new Set([...(prev.itinerary.acknowledged ?? []), checkId])];
    return logAudit(
      { ...prev, itinerary: { ...prev.itinerary, acknowledged } },
      "Warning accepted",
      text,
    );
  });
}

export function markNotificationsRead() {
  setState((prev) => ({ ...prev, notifications: prev.notifications.map((n) => ({ ...n, read: true })) }));
}

/* ================= v2.2 — assisted travellers, bookings, jobs, packing ================= */

/** Add someone who has no account of their own: a child or an assisted relative. */
export function addAssistedTraveller(input: {
  name: string;
  relationship: string;
  ageGroup: Traveller["ageGroup"];
  managerId: string;
  canVote: boolean;
  responsibilityConfirmed: boolean;
}) {
  setState((prev) => {
    if (!isOrganiser(prev) && prev.activeTravellerId !== input.managerId) return prev;
    if (!input.responsibilityConfirmed) return prev;
    const traveller: Traveller = {
      id: `tr-${uid()}`,
      name: input.name.trim(),
      relationship: input.relationship.trim() || "Traveller",
      ageGroup: input.ageGroup,
      role: "member",
      roles: ["viewer"],
      managed: true,
      responsibleAdultId: input.managerId,
      managementMode: "assisted",
      assistAccepted: true,
      canVote: input.canVote,
      consentLog: [
        {
          at: new Date().toISOString(),
          action: "responsibility_confirmed",
          by: actorName(prev, input.managerId),
        },
      ],
      needs: [],
      joined: true,
      prefStatus: "not_started",
      preferences: { interests: [], pace: "balanced", walking: "moderate", mustDo: "", avoid: "", constraints: "" },
    };
    return logAudit(
      { ...prev, travellers: [...prev.travellers, traveller] },
      "Traveller added",
      `${traveller.name} — helped by ${actorName(prev, input.managerId)}`,
    );
  });
}

/** Ask a named adult to help someone, or change who helps them. */
export function assignHelper(travellerId: string, managerId: string) {
  setState((prev) => {
    const target = prev.travellers.find((t) => t.id === travellerId);
    if (!target) return prev;
    if (!isOrganiser(prev) && prev.activeTravellerId !== travellerId) return prev;
    const adult = target.ageGroup === "adult" || target.ageGroup === "senior";
    const travellers = prev.travellers.map((t) =>
      t.id !== travellerId
        ? t
        : {
            ...t,
            managementMode: "assisted" as const,
            responsibleAdultId: managerId,
            managed: true,
            // An adult must accept help; for a dependent the adult confirms responsibility.
            assistAccepted: adult ? prev.activeTravellerId === travellerId : true,
            consentLog: [
              ...(t.consentLog ?? []),
              {
                at: new Date().toISOString(),
                action: adult && prev.activeTravellerId !== travellerId ? ("assigned" as const) : ("accepted" as const),
                by: actorName(prev),
              },
            ],
          },
    );
    return logAudit({ ...prev, travellers }, "Help assigned", `${target.name} — ${actorName(prev, managerId)}`);
  });
}

/** The person being helped accepts the arrangement. */
export function acceptHelp(travellerId: string) {
  setState((prev) => {
    if (prev.activeTravellerId !== travellerId) return prev;
    const travellers = prev.travellers.map((t) =>
      t.id !== travellerId
        ? t
        : {
            ...t,
            assistAccepted: true,
            consentLog: [
              ...(t.consentLog ?? []),
              { at: new Date().toISOString(), action: "accepted" as const, by: actorName(prev) },
            ],
          },
    );
    return logAudit({ ...prev, travellers }, "Help accepted", actorName(prev, travellerId));
  });
}

/** Stop further answers being entered on someone's behalf. Past entries stay on record. */
export function revokeHelp(travellerId: string) {
  setState((prev) => {
    const target = prev.travellers.find((t) => t.id === travellerId);
    if (!target) return prev;
    if (!isOrganiser(prev) && prev.activeTravellerId !== travellerId) return prev;
    const travellers = prev.travellers.map((t) =>
      t.id !== travellerId
        ? t
        : {
            ...t,
            assistAccepted: false,
            managementMode: "self" as const,
            responsibleAdultId: undefined,
            managed: false,
            consentLog: [
              ...(t.consentLog ?? []),
              { at: new Date().toISOString(), action: "revoked" as const, by: actorName(prev) },
            ],
          },
    );
    return logAudit({ ...prev, travellers }, "Help withdrawn", target.name);
  });
}

export function setVotingEligibility(travellerId: string, canVote: boolean) {
  setState((prev) => {
    if (!isOrganiser(prev)) return prev;
    const travellers = prev.travellers.map((t) => (t.id === travellerId ? { ...t, canVote } : t));
    return logAudit(
      { ...prev, travellers },
      canVote ? "Voting enabled" : "Voting turned off",
      actorName(prev, travellerId),
    );
  });
}

/** Record a vote for yourself, or for someone you are helping. */
export function castVote(travellerId: string, attractionId: string, value: VoteValue) {
  setState((prev) => {
    if (!canEditFor(prev, travellerId)) return prev;
    const target = prev.travellers.find((t) => t.id === travellerId);
    if (!target || target.canVote === false) return prev;
    const next = {
      ...prev,
      votes: { ...prev.votes, [travellerId]: { ...(prev.votes[travellerId] ?? {}), [attractionId]: value } },
    };
    if (travellerId === prev.activeTravellerId) return next;
    return logAudit(next, "Vote entered on behalf", proxyLabel(prev, travellerId));
  });
}

/** Add a need for yourself, or for someone you are helping. */
export function addNeedFor(travellerId: string, need: Omit<TravellerConstraint, "id">) {
  setState((prev) => {
    if (!canEditFor(prev, travellerId)) return prev;
    const proxy = travellerId !== prev.activeTravellerId;
    const entry: TravellerConstraint = {
      ...need,
      id: uid(),
      enteredBy: proxy ? actorName(prev) : undefined,
      enteredAt: new Date().toISOString(),
    };
    const travellers = prev.travellers.map((t) =>
      t.id === travellerId ? { ...t, needs: [...(t.needs ?? []), entry] } : t,
    );
    const next = { ...prev, travellers };
    return proxy ? logAudit(next, "Need entered on behalf", `${proxyLabel(prev, travellerId)}: ${need.label}`) : next;
  });
}

/* ---------------- bookings ---------------- */

export function addBooking(input: Omit<Booking, "id" | "createdAt" | "version" | "referenceSharedWith"> & {
  referenceSharedWith?: string[];
}) {
  setState((prev) => {
    if (!isOrganiser(prev) && prev.activeTravellerId !== input.ownerId) return prev;
    const booking: Booking = {
      ...input,
      referenceSharedWith: input.referenceSharedWith ?? [],
      id: `bk-${uid()}`,
      createdAt: new Date().toISOString(),
      version: 1,
    };
    return withNotice(logAudit({ ...prev, bookings: [booking, ...prev.bookings] }, "Booking added", booking.title), {
      text: `${booking.title} was added to the trip's bookings`,
      audience: "all",
    });
  });
}

export function updateBooking(id: string, patch: Partial<Booking>) {
  setState((prev) => {
    const existing = prev.bookings.find((b) => b.id === id);
    if (!existing) return prev;
    if (!isOrganiser(prev) && prev.activeTravellerId !== existing.ownerId) return prev;
    const bookings = prev.bookings.map((b) =>
      b.id === id ? { ...b, ...patch, version: b.version + 1 } : b,
    );
    return logAudit({ ...prev, bookings }, "Booking updated", existing.title);
  });
}

/** Cancelling stops a booking counting as confirmed and flags the plan for review. */
export function cancelBooking(id: string) {
  setState((prev) => {
    const existing = prev.bookings.find((b) => b.id === id);
    if (!existing) return prev;
    if (!isOrganiser(prev) && prev.activeTravellerId !== existing.ownerId) return prev;
    const bookings = prev.bookings.map((b) =>
      b.id === id ? { ...b, status: "cancelled" as const, version: b.version + 1 } : b,
    );
    return withNotice(logAudit({ ...prev, bookings }, "Booking cancelled", existing.title), {
      text: `${existing.title} was cancelled — the plan needs a review`,
      audience: "all",
    });
  });
}

export function deleteBooking(id: string) {
  setState((prev) => {
    const existing = prev.bookings.find((b) => b.id === id);
    if (!existing) return prev;
    if (!isOrganiser(prev) && prev.activeTravellerId !== existing.ownerId) return prev;
    return logAudit({ ...prev, bookings: prev.bookings.filter((b) => b.id !== id) }, "Booking removed", existing.title);
  });
}

/** Share a confirmation reference with named travellers. */
export function shareBookingReference(id: string, travellerIds: string[]) {
  setState((prev) => {
    const existing = prev.bookings.find((b) => b.id === id);
    if (!existing || prev.activeTravellerId !== existing.ownerId) return prev;
    const bookings = prev.bookings.map((b) =>
      b.id === id ? { ...b, referenceSharedWith: travellerIds, version: b.version + 1 } : b,
    );
    return logAudit({ ...prev, bookings }, "Booking reference shared", existing.title);
  });
}

/* ---------------- shared jobs ---------------- */

function taskEvent(prev: KintripState, action: string) {
  return { at: new Date().toISOString(), actorName: actorName(prev), action };
}

export function addTask(input: {
  title: string;
  detail?: string | undefined;
  assigneeId?: string | undefined;
  helperIds?: string[] | undefined;
  deadline?: string | undefined;
  attractionId?: string | undefined;
  visibility?: TripTask["visibility"] | undefined;
}) {
  setState((prev) => {
    const task: TripTask = {
      id: `tk-${uid()}`,
      title: input.title.trim(),
      detail: input.detail,
      assigneeId: input.assigneeId,
      helperIds: input.helperIds ?? [],
      deadline: input.deadline,
      timeZone: prev.trip.timeZone,
      state: input.assigneeId ? "awaiting_acceptance" : "unassigned",
      attractionId: input.attractionId,
      visibility: input.visibility ?? "group",
      version: 1,
      history: [taskEvent(prev, "Created")],
    };
    const next = { ...prev, tasks: [task, ...prev.tasks] };
    return task.assigneeId
      ? withNotice(logAudit(next, "Job assigned", `${task.title} → ${actorName(prev, task.assigneeId)}`), {
          text: `${actorName(prev, task.assigneeId)} was asked to take on "${task.title}"`,
          audience: "all",
        })
      : logAudit(next, "Job added", task.title);
  });
}

export function assignTask(taskId: string, assigneeId: string | undefined) {
  setState((prev) => {
    if (!isOrganiser(prev)) return prev;
    const tasks = prev.tasks.map((t) =>
      t.id !== taskId
        ? t
        : {
            ...t,
            assigneeId,
            state: (assigneeId ? "awaiting_acceptance" : "unassigned") as TripTask["state"],
            version: t.version + 1,
            history: [taskEvent(prev, assigneeId ? "Assigned" : "Unassigned"), ...t.history],
          },
    );
    return logAudit({ ...prev, tasks }, "Job reassigned", taskId);
  });
}

export function respondToTask(taskId: string, accept: boolean) {
  setState((prev) => {
    const task = prev.tasks.find((t) => t.id === taskId);
    if (!task || task.assigneeId !== prev.activeTravellerId) return prev;
    const tasks = prev.tasks.map((t) =>
      t.id !== taskId
        ? t
        : accept
          ? { ...t, state: "accepted" as const, version: t.version + 1, history: [taskEvent(prev, "Accepted"), ...t.history] }
          : {
              ...t,
              assigneeId: undefined,
              state: "unassigned" as const,
              version: t.version + 1,
              history: [taskEvent(prev, "Declined"), ...t.history],
            },
    );
    return logAudit({ ...prev, tasks }, accept ? "Job accepted" : "Job declined", task.title);
  });
}

/** Completion is reversible and always recorded. Never approves spending. */
export function setTaskComplete(taskId: string, complete: boolean) {
  setState((prev) => {
    const task = prev.tasks.find((t) => t.id === taskId);
    if (!task) return prev;
    if (!isOrganiser(prev) && task.assigneeId !== prev.activeTravellerId) return prev;
    const tasks = prev.tasks.map((t) =>
      t.id !== taskId
        ? t
        : {
            ...t,
            state: (complete ? "complete" : t.assigneeId ? "accepted" : "unassigned") as TripTask["state"],
            version: t.version + 1,
            history: [taskEvent(prev, complete ? "Marked done" : "Reopened"), ...t.history],
          },
    );
    return logAudit({ ...prev, tasks }, complete ? "Job done" : "Job reopened", task.title);
  });
}

export function cancelTask(taskId: string) {
  setState((prev) => {
    if (!isOrganiser(prev)) return prev;
    const tasks = prev.tasks.map((t) =>
      t.id !== taskId
        ? t
        : { ...t, state: "cancelled" as const, version: t.version + 1, history: [taskEvent(prev, "Cancelled"), ...t.history] },
    );
    return logAudit({ ...prev, tasks }, "Job cancelled", taskId);
  });
}

/* ---------------- packing ---------------- */

export function addPackingItem(input: {
  label: string;
  scope: PackingItem["scope"];
  travellerId?: string | undefined;
  responsibleId?: string | undefined;
  quantityNeeded?: number | undefined;
  visibility?: PackingItem["visibility"] | undefined;
}) {
  setState((prev) => {
    if (input.scope !== "shared" && input.travellerId && !canEditFor(prev, input.travellerId)) return prev;
    const item: PackingItem = {
      id: `pk-${uid()}`,
      label: input.label.trim(),
      scope: input.scope,
      travellerId: input.travellerId,
      responsibleId: input.responsibleId,
      quantityNeeded: input.scope === "shared" ? (input.quantityNeeded ?? 1) : undefined,
      quantityCommitted: input.scope === "shared" ? 0 : undefined,
      quantityPacked: input.scope === "shared" ? 0 : undefined,
      packed: false,
      visibility: input.visibility ?? (input.scope === "shared" ? "group" : "private"),
      version: 1,
    };
    return { ...prev, packing: [...prev.packing, item] };
  });
}

/**
 * Claim part of a shared item. `expectedVersion` guards against two people
 * quietly claiming the same last one — a mismatch asks for a refresh instead.
 */
export function commitPackingQuantity(itemId: string, amount: number, expectedVersion: number): boolean {
  let ok = true;
  setState((prev) => {
    const item = prev.packing.find((p) => p.id === itemId);
    if (!item) {
      ok = false;
      return prev;
    }
    if (item.version !== expectedVersion) {
      ok = false;
      return prev;
    }
    const needed = item.quantityNeeded ?? 0;
    const committed = Math.max(0, Math.min(needed, (item.quantityCommitted ?? 0) + amount));
    const packing = prev.packing.map((p) =>
      p.id === itemId
        ? { ...p, quantityCommitted: committed, responsibleId: amount > 0 ? prev.activeTravellerId : p.responsibleId, version: p.version + 1 }
        : p,
    );
    return { ...prev, packing };
  });
  return ok;
}

export function setPackingPacked(itemId: string, packed: boolean) {
  setState((prev) => {
    const item = prev.packing.find((p) => p.id === itemId);
    if (!item) return prev;
    if (item.scope !== "shared" && item.travellerId && !canEditFor(prev, item.travellerId)) return prev;
    const packing = prev.packing.map((p) =>
      p.id === itemId
        ? {
            ...p,
            packed,
            quantityPacked: p.scope === "shared" ? (packed ? (p.quantityCommitted ?? 0) : 0) : p.quantityPacked,
            version: p.version + 1,
          }
        : p,
    );
    return { ...prev, packing };
  });
}

export function removePackingItem(itemId: string) {
  setState((prev) => {
    const item = prev.packing.find((p) => p.id === itemId);
    if (!item) return prev;
    if (item.scope === "shared" && !isOrganiser(prev)) return prev;
    if (item.scope !== "shared" && item.travellerId && !canEditFor(prev, item.travellerId)) return prev;
    return { ...prev, packing: prev.packing.filter((p) => p.id !== itemId) };
  });
}

/** Starting lists people can edit — a convenience, never a complete list. */
export const PACKING_TEMPLATES: Record<string, { label: string; scope: PackingItem["scope"]; quantityNeeded?: number }[]> = {
  "Multi-generational trip": [
    { label: "Folding walking stick", scope: "shared", quantityNeeded: 1 },
    { label: "Lightweight stroller", scope: "shared", quantityNeeded: 1 },
    { label: "First aid kit", scope: "shared", quantityNeeded: 1 },
    { label: "Snacks for the day", scope: "shared", quantityNeeded: 2 },
    { label: "Passport and travel documents", scope: "personal" },
    { label: "Comfortable walking shoes", scope: "personal" },
    { label: "Regular medication", scope: "personal" },
  ],
  "Friends trip": [
    { label: "Portable power bank", scope: "shared", quantityNeeded: 2 },
    { label: "Travel adapter", scope: "shared", quantityNeeded: 2 },
    { label: "Card games", scope: "shared", quantityNeeded: 1 },
    { label: "Passport and travel documents", scope: "personal" },
    { label: "Rain jacket", scope: "personal" },
  ],
};

export function applyPackingTemplate(name: keyof typeof PACKING_TEMPLATES) {
  setState((prev) => {
    const rows = PACKING_TEMPLATES[name];
    if (!rows) return prev;
    const existing = new Set(prev.packing.map((p) => `${p.scope}:${p.label.toLowerCase()}`));
    const items: PackingItem[] = [];
    for (const row of rows) {
      const key = `${row.scope}:${row.label.toLowerCase()}`;
      if (existing.has(key)) continue;
      items.push({
        id: `pk-${uid()}`,
        label: row.label,
        scope: row.scope,
        travellerId: row.scope === "personal" ? prev.activeTravellerId : undefined,
        quantityNeeded: row.scope === "shared" ? (row.quantityNeeded ?? 1) : undefined,
        quantityCommitted: row.scope === "shared" ? 0 : undefined,
        quantityPacked: row.scope === "shared" ? 0 : undefined,
        packed: false,
        visibility: row.scope === "shared" ? "group" : "private",
        version: 1,
      });
    }
    if (items.length === 0) return prev;
    return logAudit({ ...prev, packing: [...prev.packing, ...items] }, "Packing template added", String(name));
  });
}

/* ================= v2.2 Phase B — changes, comfort, attendance ================= */

/** Describe, in plain words, how the new plan differs from the published one. */
function diffDays(before: ItineraryDay[], after: ItineraryDay[]): PlanChange[] {
  const changes: PlanChange[] = [];
  for (const day of after) {
    const old = before.find((d) => d.day === day.day);
    if (!old) continue;
    const oldItems = new Map(old.items.map((i) => [i.id, i]));
    const newItems = new Map(day.items.map((i) => [i.id, i]));
    for (const item of day.items) {
      const prevItem = oldItems.get(item.id);
      if (!prevItem) {
        changes.push({ kind: "added", text: `Day ${day.day}: ${item.title} was added at ${item.start}`, dayNumber: day.day, material: true, affected: [] });
      } else if (prevItem.start !== item.start) {
        changes.push({ kind: "moved", text: `Day ${day.day}: ${item.title} moved from ${prevItem.start} to ${item.start}`, dayNumber: day.day, material: true, affected: [] });
      }
    }
    for (const prevItem of old.items) {
      if (!newItems.has(prevItem.id)) {
        changes.push({ kind: "removed", text: `Day ${day.day}: ${prevItem.title} is no longer in the plan`, dayNumber: day.day, material: true, affected: [] });
      }
    }
    const oldSplit = old.split?.id ?? "";
    const newSplit = day.split?.id ?? "";
    if (oldSplit !== newSplit) {
      changes.push({
        kind: "split",
        text: day.split
          ? `Day ${day.day} splits into two groups, meeting at ${day.split.meetingPoint} at ${day.split.meetingTime}`
          : `Day ${day.day} is back together as one group`,
        dayNumber: day.day,
        material: true,
        affected: day.split ? day.split.groups.flatMap((g) => g.memberIds) : [],
      });
    }
  }
  return changes;
}

/** Everyone who still has not said they have seen this version. */
export function unacknowledgedFor(state: KintripState, travellerId: string) {
  return (state.publishedChanges ?? []).filter(
    (c) =>
      !c.acknowledged.includes(travellerId) &&
      c.changes.some(
        (ch) => ch.material && (ch.affected.length === 0 || ch.affected.includes(travellerId)),
      ),
  );
}

export function acknowledgeChange(changeId: string, travellerId?: string) {
  setState((prev) => {
    const who = travellerId ?? prev.activeTravellerId;
    if (!canEditFor(prev, who)) return prev;
    return {
      ...prev,
      publishedChanges: (prev.publishedChanges ?? []).map((c) =>
        c.id === changeId ? { ...c, acknowledged: [...new Set([...c.acknowledged, who])] } : c,
      ),
    };
  });
}

/** Say whether someone is joining a particular stop. */
export function setAttendance(
  travellerId: string,
  itemId: string,
  value: AttendanceState,
  opts: { arriveLate?: string; leaveEarly?: string } = {},
) {
  setState((prev) => {
    if (!canEditFor(prev, travellerId)) return prev;
    const rest = (prev.attendance ?? []).filter((a) => !(a.travellerId === travellerId && a.itemId === itemId));
    const record: AttendanceRecord = {
      travellerId,
      itemId,
      state: value,
      arriveLate: opts.arriveLate,
      leaveEarly: opts.leaveEarly,
      at: new Date().toISOString(),
    };
    return { ...prev, attendance: [...rest, record] };
  });
}

export function attendanceFor(state: KintripState, itemId: string) {
  const records = (state.attendance ?? []).filter((a) => a.itemId === itemId);
  const coming = records.filter((a) => a.state === "coming").length;
  const out = records.filter((a) => a.state === "sitting_out").length;
  const unsure = records.filter((a) => a.state === "unsure").length;
  return { records, coming, out, unsure, unanswered: state.travellers.length - records.length };
}

/** Add a meal or a sit-down break to a day. */
export function addDayItem(
  dayNumber: number,
  input: { kind: "meal" | "rest" | "activity"; title: string; start: string; durationMin: number; note?: string },
) {
  setState((prev) => {
    if (!prev.itinerary || !isOrganiser(prev)) return prev;
    const days = prev.itinerary.days.map((d) =>
      d.day === dayNumber
        ? {
            ...d,
            items: [
              ...d.items,
              {
                id: uid(),
                kind: input.kind,
                title: input.title,
                start: input.start,
                durationMin: input.durationMin,
                note: input.note,
                rigidity: input.kind === "rest" ? ("rest" as const) : ("flex" as const),
              },
            ],
          }
        : d,
    );
    return logAudit(
      { ...prev, itinerary: { ...prev.itinerary, days } },
      input.kind === "meal" ? "Meal break added" : "Break added",
      `Day ${dayNumber}: ${input.title} at ${input.start}`,
    );
  });
}

export function removeDayItem(dayNumber: number, itemId: string) {
  setState((prev) => {
    if (!prev.itinerary || !isOrganiser(prev)) return prev;
    const days = prev.itinerary.days.map((d) =>
      d.day === dayNumber ? { ...d, items: d.items.filter((i) => i.id !== itemId || i.locked) } : d,
    );
    return logAudit({ ...prev, itinerary: { ...prev.itinerary, days } }, "Stop removed", `Day ${dayNumber}`);
  });
}
