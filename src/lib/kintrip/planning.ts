import { setState } from "./store";
import { logAudit, isOrganiser, canEditFor, actorName } from "./governance";
import type {
  KintripState,
  Milestone,
  MilestoneKind,
  Poll,
  PollAnswer,
  PollKind,
  PollOption,
  Scenario,
  StayOption,
} from "./types";

/**
 * Early decisions, deadlines and comparison records.
 * Remixed from the original Kintrip project.
 *
 * Permissions are enforced here, not just hidden in the screens: organisers
 * open and close group questions, and everyone else answers only for
 * themselves or for a traveller who has accepted their help.
 */

const uid = () => Math.random().toString(36).slice(2, 10);

/* ---------------- group questions (polls) ---------------- */

export function createPoll(input: {
  kind: PollKind;
  question: string;
  options: { label: string; detail?: string; start?: string; end?: string }[];
  closesAt?: string;
}) {
  setState((prev) => {
    if (!isOrganiser(prev)) return prev;
    const options: PollOption[] = input.options
      .filter((o) => o.label.trim().length > 0)
      .slice(0, 8)
      .map((o) => ({
        id: uid(),
        label: o.label.trim().slice(0, 120),
        detail: o.detail?.trim() || undefined,
        start: o.start || undefined,
        end: o.end || undefined,
      }));
    if (options.length < 2) return prev;
    const poll: Poll = {
      id: uid(),
      kind: input.kind,
      question: input.question.trim().slice(0, 160) || "What works for everyone?",
      options,
      responses: {},
      closesAt: input.closesAt || undefined,
      closed: false,
      createdBy: prev.activeTravellerId,
      createdAt: new Date().toISOString(),
    };
    return logAudit({ ...prev, polls: [poll, ...prev.polls] }, "Group question asked", poll.question);
  });
}

export function answerPoll(
  pollId: string,
  optionId: string,
  answer: PollAnswer,
  travellerId?: string,
) {
  setState((prev) => {
    const who = travellerId ?? prev.activeTravellerId;
    if (!canEditFor(prev, who)) return prev;
    const polls = prev.polls.map((p) => {
      if (p.id !== pollId || p.closed) return p;
      const existing = p.responses[who] ?? {};
      return { ...p, responses: { ...p.responses, [who]: { ...existing, [optionId]: answer } } };
    });
    return { ...prev, polls };
  });
}

export function closePoll(pollId: string, decidedOptionId?: string) {
  setState((prev) => {
    if (!isOrganiser(prev)) return prev;
    const polls = prev.polls.map((p) =>
      p.id === pollId ? { ...p, closed: true, decidedOptionId: decidedOptionId || undefined } : p,
    );
    const poll = polls.find((p) => p.id === pollId);
    const chosen = poll?.options.find((o) => o.id === decidedOptionId);
    return logAudit(
      { ...prev, polls },
      "Group question closed",
      chosen ? `${poll?.question} → ${chosen.label}` : (poll?.question ?? ""),
    );
  });
}

export function reopenPoll(pollId: string) {
  setState((prev) => {
    if (!isOrganiser(prev)) return prev;
    return {
      ...prev,
      polls: prev.polls.map((p) =>
        p.id === pollId ? { ...p, closed: false, decidedOptionId: undefined } : p,
      ),
    };
  });
}

export function removePoll(pollId: string) {
  setState((prev) =>
    isOrganiser(prev) ? { ...prev, polls: prev.polls.filter((p) => p.id !== pollId) } : prev,
  );
}

export interface PollTally {
  optionId: string;
  label: string;
  yes: number;
  maybe: number;
  no: number;
  score: number;
}

/** Counts answers. Only people who can vote are counted, once each. */
export function tallyPoll(state: KintripState, poll: Poll): PollTally[] {
  const eligible = new Set(
    state.travellers.filter((t) => t.canVote !== false).map((t) => t.id),
  );
  return poll.options.map((o) => {
    let yes = 0;
    let maybe = 0;
    let no = 0;
    for (const [travellerId, answers] of Object.entries(poll.responses)) {
      if (!eligible.has(travellerId)) continue;
      const a = answers[o.id];
      if (a === "yes") yes += 1;
      else if (a === "maybe") maybe += 1;
      else if (a === "no") no += 1;
    }
    return { optionId: o.id, label: o.label, yes, maybe, no, score: yes * 2 + maybe - no * 2 };
  });
}

/** Who has not answered a single option yet. */
export function pollNonResponders(state: KintripState, poll: Poll) {
  return state.travellers.filter(
    (t) => t.canVote !== false && Object.keys(poll.responses[t.id] ?? {}).length === 0,
  );
}

/* ---------------- deadlines ---------------- */

export function addMilestone(input: {
  title: string;
  dueDate: string;
  kind: MilestoneKind;
  ownerId?: string | undefined;
  bookingId?: string | undefined;
}) {
  setState((prev) => {
    if (!isOrganiser(prev)) return prev;
    const milestone: Milestone = {
      id: uid(),
      title: input.title.trim().slice(0, 140) || "Deadline",
      dueDate: input.dueDate,
      kind: input.kind,
      ownerId: input.ownerId || undefined,
      bookingId: input.bookingId || undefined,
      done: false,
      createdAt: new Date().toISOString(),
    };
    return logAudit(
      { ...prev, milestones: [...prev.milestones, milestone] },
      "Deadline added",
      `${milestone.title} — due ${milestone.dueDate}`,
    );
  });
}

export function toggleMilestone(id: string) {
  setState((prev) => {
    const target = prev.milestones.find((m) => m.id === id);
    if (!target) return prev;
    const mayChange = isOrganiser(prev) || (target.ownerId ? canEditFor(prev, target.ownerId) : false);
    if (!mayChange) return prev;
    return logAudit(
      {
        ...prev,
        milestones: prev.milestones.map((m) => (m.id === id ? { ...m, done: !m.done } : m)),
      },
      target.done ? "Deadline reopened" : "Deadline marked done",
      `${target.title} — by ${actorName(prev)}`,
    );
  });
}

export function removeMilestone(id: string) {
  setState((prev) =>
    isOrganiser(prev) ? { ...prev, milestones: prev.milestones.filter((m) => m.id !== id) } : prev,
  );
}

/** Deadlines grouped by how soon they are, newest first within each group. */
export function milestoneBuckets(state: KintripState, today = new Date()) {
  const day = 24 * 3600 * 1000;
  const start = Date.parse(`${today.toISOString().slice(0, 10)}T00:00:00Z`);
  const open = state.milestones.filter((m) => !m.done);
  const at = (m: Milestone) => Date.parse(`${m.dueDate}T00:00:00Z`);
  return {
    overdue: open.filter((m) => at(m) < start).sort((a, b) => at(a) - at(b)),
    soon: open.filter((m) => at(m) >= start && at(m) <= start + 7 * day).sort((a, b) => at(a) - at(b)),
    later: open.filter((m) => at(m) > start + 7 * day).sort((a, b) => at(a) - at(b)),
    done: state.milestones.filter((m) => m.done),
  };
}

/* ---------------- places to stay (comparison inputs) ---------------- */

export function addStayOption(input: {
  name: string;
  nightlyCostMinor?: number;
  lat?: number;
  lon?: number;
  link?: string;
  note?: string;
}) {
  setState((prev) => {
    if (!isOrganiser(prev)) return prev;
    if (prev.stayOptions.length >= 5) return prev;
    const option: StayOption = {
      id: uid(),
      name: input.name.trim().slice(0, 120) || "Place to stay",
      nightlyCostMinor: Number.isFinite(input.nightlyCostMinor) ? input.nightlyCostMinor : undefined,
      currency: prev.decisions.currency,
      lat: Number.isFinite(input.lat) ? input.lat : undefined,
      lon: Number.isFinite(input.lon) ? input.lon : undefined,
      link: input.link?.trim() || undefined,
      note: input.note?.trim() || undefined,
    };
    return { ...prev, stayOptions: [...prev.stayOptions, option] };
  });
}

export function removeStayOption(id: string) {
  setState((prev) =>
    isOrganiser(prev) ? { ...prev, stayOptions: prev.stayOptions.filter((s) => s.id !== id) } : prev,
  );
}

export function recordStayResults(results: Record<string, StayOption["result"]>) {
  setState((prev) => ({
    ...prev,
    stayOptions: prev.stayOptions.map((s) => (results[s.id] ? { ...s, result: results[s.id] } : s)),
  }));
}

/* ---------------- plan alternatives ---------------- */

export function saveScenarios(scenarios: Scenario[]) {
  setState((prev) => ({ ...prev, scenarios: [...scenarios, ...prev.scenarios].slice(0, 12) }));
}

/** Marks stored alternatives as outdated once the plan itself moves on. */
export function markScenariosOutdated(revision: number) {
  setState((prev) => ({
    ...prev,
    scenarios: prev.scenarios.map((s) =>
      s.baselineRevision === revision ? s : { ...s, outdated: true },
    ),
  }));
}

export function removeScenario(id: string) {
  setState((prev) =>
    isOrganiser(prev) ? { ...prev, scenarios: prev.scenarios.filter((s) => s.id !== id) } : prev,
  );
}
