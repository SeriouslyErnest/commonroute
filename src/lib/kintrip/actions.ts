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
} from "./governance";
import type {
  DeclineReasonCode,
  DecisionSettings,
  SponsorApproval,
  SponsorDecision,
  SuggestionCost,
  SuggestionStatus,
  TravellerConstraint,
  TripRole,
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
    return withNotice(logAudit({ ...prev, itinerary }, "Itinerary published", `Version ${itinerary.version}`), {
      text: "The group plan has been published",
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

export function markNotificationsRead() {
  setState((prev) => ({ ...prev, notifications: prev.notifications.map((n) => ({ ...n, read: true })) }));
}
