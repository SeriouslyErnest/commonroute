import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AlarmClock, CalendarClock, CheckCircle2, CircleAlert, Plus, Trash2 } from "lucide-react";
import { AppShell } from "@/components/kintrip/AppShell";
import { Button, Card, Chip, Field, LinkButton, inputClass } from "@/components/kintrip/ui";
import { useKintrip } from "@/lib/kintrip/store";
import { isOrganiser } from "@/lib/kintrip/governance";
import { addMilestone, milestoneBuckets, removeMilestone, toggleMilestone } from "@/lib/kintrip/planning";
import { trackEvent } from "@/lib/kintrip/commerce.functions";
import type { KintripState, MilestoneKind } from "@/lib/kintrip/types";

/**
 * Booking readiness (P03) and deadlines (P04).
 * Remixed from the original Kintrip project.
 *
 * Every line is derived from what the group has actually recorded. Nothing is
 * assumed: what is unknown is shown as unknown.
 */

const title = "Readiness and deadlines — CommonRoute";
const description = "See what is booked, what is missing and what is due soon.";

export const Route = createFileRoute("/readiness")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ReadinessScreen,
});

interface Check {
  id: string;
  label: string;
  state: "ready" | "missing" | "unknown";
  detail: string;
  to?: string;
}

function buildChecks(state: KintripState): Check[] {
  const bookings = state.bookings.filter((b) => b.status !== "cancelled");
  const stays = bookings.filter((b) => b.type === "stay");
  const transport = bookings.filter((b) => b.type === "transport");
  const openTasks = state.tasks.filter((t) => t.state !== "complete" && t.state !== "cancelled");
  const notJoined = state.travellers.filter((t) => !t.joined);
  const noPrefs = state.travellers.filter((t) => t.prefStatus !== "complete");
  const unconfirmed = bookings.filter((b) => b.status !== "confirmed");

  return [
    {
      id: "dates",
      label: "Trip dates agreed",
      state: state.trip.startDate && state.trip.endDate ? "ready" : "missing",
      detail:
        state.trip.startDate && state.trip.endDate
          ? `${state.trip.startDate} to ${state.trip.endDate}`
          : "Set the dates so deadlines and passes can be worked out.",
      to: "/polls",
    },
    {
      id: "people",
      label: "Everyone has joined",
      state: notJoined.length === 0 ? "ready" : "missing",
      detail:
        notJoined.length === 0
          ? `${state.travellers.length} travellers in the group`
          : `Waiting on ${notJoined.map((t) => t.name).join(", ")}`,
      to: "/family",
    },
    {
      id: "prefs",
      label: "Preferences collected",
      state: noPrefs.length === 0 ? "ready" : "missing",
      detail:
        noPrefs.length === 0
          ? "Everyone has shared what they want"
          : `${noPrefs.length} still to share what they want`,
      to: "/preferences",
    },
    {
      id: "plan",
      label: "Plan published",
      state: state.itinerary?.published ? "ready" : "missing",
      detail: state.itinerary?.published
        ? `Version ${state.itinerary.version} shared with the group`
        : "The group cannot rely on a plan until it is published.",
      to: "/itinerary",
    },
    {
      id: "stay",
      label: "Somewhere to stay recorded",
      state: stays.length > 0 ? "ready" : "unknown",
      detail:
        stays.length > 0
          ? `${stays.length} stay record${stays.length === 1 ? "" : "s"}`
          : "No stay recorded. If it is booked elsewhere, add it so the group can see it.",
      to: "/bookings",
    },
    {
      id: "transport",
      label: "Getting there recorded",
      state: transport.length > 0 ? "ready" : "unknown",
      detail:
        transport.length > 0
          ? `${transport.length} transport record${transport.length === 1 ? "" : "s"}`
          : "No flights or trains recorded yet.",
      to: "/bookings",
    },
    {
      id: "confirmed",
      label: "Bookings confirmed",
      state: unconfirmed.length === 0 && bookings.length > 0 ? "ready" : "missing",
      detail:
        bookings.length === 0
          ? "Nothing recorded yet."
          : unconfirmed.length === 0
            ? "All recorded bookings are confirmed"
            : `${unconfirmed.length} still marked as planned`,
      to: "/bookings",
    },
    {
      id: "tasks",
      label: "Jobs taken care of",
      state: openTasks.length === 0 ? "ready" : "missing",
      detail:
        openTasks.length === 0 ? "No open jobs" : `${openTasks.length} job${openTasks.length === 1 ? "" : "s"} still open`,
      to: "/getting-ready",
    },
  ];
}

const kindLabels: { value: MilestoneKind; label: string }[] = [
  { value: "booking", label: "Booking" },
  { value: "payment", label: "Payment" },
  { value: "document", label: "Document" },
  { value: "other", label: "Other" },
];

function ReadinessScreen() {
  const state = useKintrip();
  const organiser = isOrganiser(state);
  const checks = useMemo(() => buildChecks(state), [state]);
  const ready = checks.filter((c) => c.state === "ready").length;
  const buckets = useMemo(() => milestoneBuckets(state), [state]);
  const [showNew, setShowNew] = useState(false);
  const [mTitle, setMTitle] = useState("");
  const [due, setDue] = useState("");
  const [kind, setKind] = useState<MilestoneKind>("booking");
  const [owner, setOwner] = useState("");

  useEffect(() => {
    void trackEvent({
      data: { name: "readiness_opened", tripId: state.trip.id, props: { count: ready } },
    }).catch(() => {});
  }, [state.trip.id, ready]);

  return (
    <AppShell title="Readiness and deadlines" subtitle="What is sorted, what is missing, and what is due soon.">
      <Card className="p-5">
        <p className="text-sm font-bold text-secondary">Ready to travel</p>
        <p className="mt-1 text-3xl font-extrabold">
          {ready} of {checks.length}
        </p>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary"
            style={{ width: `${Math.round((ready / checks.length) * 100)}%` }}
          />
        </div>
      </Card>

      <div className="space-y-3">
        {checks.map((c) => (
          <Card key={c.id} className="flex items-start gap-3 p-4">
            {c.state === "ready" ? (
              <CheckCircle2 className="mt-0.5 size-6 shrink-0 text-primary" aria-hidden />
            ) : (
              <CircleAlert
                className={`mt-0.5 size-6 shrink-0 ${c.state === "missing" ? "text-secondary" : "text-muted-foreground"}`}
                aria-hidden
              />
            )}
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{c.label}</p>
              <p className="text-sm text-muted-foreground">{c.detail}</p>
            </div>
            {c.to && c.state !== "ready" ? (
              <LinkButton to={c.to} variant="outline">
                Open
              </LinkButton>
            ) : null}
          </Card>
        ))}
      </div>

      <Card className="p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg">Deadlines</h2>
          {organiser ? (
            <Button variant="outline" onClick={() => setShowNew((v) => !v)}>
              <Plus className="size-5" aria-hidden /> Add
            </Button>
          ) : null}
        </div>

        {showNew ? (
          <div className="mt-4 space-y-3">
            <Field label="What is due?">
              <input
                className={inputClass}
                value={mTitle}
                onChange={(e) => setMTitle(e.target.value)}
                placeholder="Free cancellation ends for the hotel"
              />
            </Field>
            <Field label="Due date">
              <input type="date" className={inputClass} value={due} onChange={(e) => setDue(e.target.value)} />
            </Field>
            <Field label="Type">
              <select
                className={inputClass}
                value={kind}
                onChange={(e) => setKind(e.target.value as MilestoneKind)}
              >
                {kindLabels.map((k) => (
                  <option key={k.value} value={k.value}>
                    {k.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Who is looking after it?">
              <select className={inputClass} value={owner} onChange={(e) => setOwner(e.target.value)}>
                <option value="">Nobody yet</option>
                {state.travellers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </Field>
            <Button
              disabled={!mTitle.trim() || !due}
              onClick={() => {
                addMilestone({ title: mTitle, dueDate: due, kind, ownerId: owner || undefined });
                setMTitle("");
                setDue("");
                setOwner("");
                setShowNew(false);
              }}
            >
              Save deadline
            </Button>
          </div>
        ) : null}

        {state.milestones.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            No deadlines recorded. Cancellation cut-offs and payment dates are the usual ones.
          </p>
        ) : null}

        {(
          [
            ["Overdue", buckets.overdue, "coral"],
            ["Next 7 days", buckets.soon, "sunny"],
            ["Later", buckets.later, "neutral"],
            ["Done", buckets.done, "lime"],
          ] as const
        ).map(([label, rows, tone]) =>
          rows.length ? (
            <div key={label} className="mt-4">
              <Chip tone={tone}>
                {label === "Overdue" ? (
                  <AlarmClock className="size-4" aria-hidden />
                ) : (
                  <CalendarClock className="size-4" aria-hidden />
                )}
                {label}
              </Chip>
              <ul className="mt-2 space-y-2">
                {rows.map((m) => (
                  <li key={m.id} className="flex items-center gap-3 rounded-2xl border border-border p-3">
                    <input
                      type="checkbox"
                      className="size-5"
                      checked={m.done}
                      aria-label={`Mark ${m.title} done`}
                      onChange={() => toggleMilestone(m.id)}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold">{m.title}</span>
                      <span className="block text-sm text-muted-foreground">
                        Due {m.dueDate}
                        {m.ownerId
                          ? ` · ${state.travellers.find((t) => t.id === m.ownerId)?.name ?? "someone"}`
                          : ""}
                      </span>
                    </span>
                    {organiser ? (
                      <button
                        type="button"
                        aria-label={`Remove ${m.title}`}
                        onClick={() => removeMilestone(m.id)}
                        className="text-muted-foreground"
                      >
                        <Trash2 className="size-5" aria-hidden />
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null,
        )}
      </Card>
    </AppShell>
  );
}
