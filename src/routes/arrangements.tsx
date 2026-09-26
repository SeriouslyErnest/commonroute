import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { CalendarClock, Lock } from "lucide-react";
import { AppShell } from "@/components/kintrip/AppShell";
import { Button, Card, Chip, Field, inputClass } from "@/components/kintrip/ui";
import { useKintrip } from "@/lib/kintrip/store";
import { trackProduct } from "@/lib/kintrip/track";
import { actorName, canEditFor, isOrganiser } from "@/lib/kintrip/governance";
import {
  ARRANGEMENT_LABEL,
  ARRANGEMENT_STATUS_LABEL,
  arrangementStatus,
  currentResponses,
  maySeeArrangementReason,
} from "@/lib/kintrip/enhancements";
import {
  applyArrangement,
  createArrangement,
  respondToArrangement,
  withdrawArrangement,
} from "@/lib/kintrip/enhancements.actions";
import { ARRANGEMENTS_ENABLED } from "@/lib/kintrip/features";
import type { ArrangementKind } from "@/lib/kintrip/types";

export const Route = createFileRoute("/arrangements")({
  head: () => ({
    meta: [
      { title: "Temporary arrangements — CommonRoute" },
      { name: "description", content: "Propose a later start, a taxi for one leg or a rest for part of the group, then add it to the draft plan." },
      { property: "og:title", content: "Temporary arrangements — CommonRoute" },
      { property: "og:description", content: "Small, dated changes to the plan — reviewed before the group sees them." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ArrangementsScreen,
});

const KINDS: ArrangementKind[] = ["later_start", "taxi_leg", "subgroup_rest"];

function ArrangementsScreen() {
  const state = useKintrip();
  const me = state.activeTravellerId;
  const organiser = isOrganiser(state);
  const days = state.itinerary?.days ?? [];
  const [kind, setKind] = useState<ArrangementKind>("later_start");
  const [dayNumber, setDayNumber] = useState(days[0]?.day ?? 1);
  const [who, setWho] = useState<string[]>([me]);
  const [detail, setDetail] = useState("");
  const [minutes, setMinutes] = useState(60);
  const [restStart, setRestStart] = useState("14:00");
  const [itemId, setItemId] = useState("");
  const [reason, setReason] = useState("");
  const [endDate, setEndDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const day = days.find((d) => d.day === dayNumber);
  const pickable = organiser ? state.travellers : state.travellers.filter((t) => canEditFor(state, t.id));

  if (!ARRANGEMENTS_ENABLED) {
    return (
      <AppShell title="Temporary arrangements">
        <Card><p className="text-sm">This feature is switched off on this deployment. Your plan is unaffected.</p></Card>
      </AppShell>
    );
  }

  const propose = () => {
    setError(null);
    setOk(null);
    const err = createArrangement({
      kind,
      travellerIds: who,
      dayNumber,
      itemId: kind === "taxi_leg" ? itemId || undefined : undefined,
      detail,
      minutes: kind === "later_start" ? minutes : undefined,
      restStart: kind === "subgroup_rest" ? restStart : undefined,
      reason: reason || undefined,
      endDate: endDate || undefined,
    });
    if (err) setError(err);
    else {
      setOk("Proposed. Organisers will see it; the people affected can answer.");
      trackProduct(state, "arrangement_proposed", { kind });
      setDetail("");
      setReason("");
    }
  };

  const run = (fn: () => string | null, done?: string) => {
    const e = fn();
    setError(e);
    setOk(e ? null : done ?? null);
  };

  return (
    <AppShell title="Temporary arrangements" subtitle="A later start, a taxi, a rest — for a day, not forever">
      {!state.itinerary ? (
        <Card><p className="text-sm">Build the itinerary first — arrangements change a plan that exists.</p></Card>
      ) : (
        <Card className="space-y-3">
          <h2 className="text-lg">Propose a change</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Kind of change">
              <select className={inputClass} value={kind} onChange={(e) => setKind(e.target.value as ArrangementKind)}>
                {KINDS.map((k) => <option key={k} value={k}>{ARRANGEMENT_LABEL[k]}</option>)}
              </select>
            </Field>
            <Field label="Day">
              <select className={inputClass} value={dayNumber} onChange={(e) => setDayNumber(Number(e.target.value))}>
                {days.map((d) => <option key={d.day} value={d.day}>Day {d.day} — {d.areaLabel}</option>)}
              </select>
            </Field>
            {kind === "later_start" ? (
              <Field label="How much later">
                <select className={inputClass} value={minutes} onChange={(e) => setMinutes(Number(e.target.value))}>
                  {[30, 60, 90, 120].map((m) => <option key={m} value={m}>{m} minutes</option>)}
                </select>
              </Field>
            ) : null}
            {kind === "subgroup_rest" ? (
              <Field label="Rest starts">
                <input type="time" className={inputClass} value={restStart} onChange={(e) => setRestStart(e.target.value)} />
              </Field>
            ) : null}
            {kind === "taxi_leg" ? (
              <Field label="Taxi to">
                <select className={inputClass} value={itemId} onChange={(e) => setItemId(e.target.value)}>
                  <option value="">Choose a stop…</option>
                  {day?.items.filter((i) => i.kind !== "travel").map((i) => <option key={i.id} value={i.id}>{i.start} {i.title}</option>)}
                </select>
              </Field>
            ) : null}
            <Field label="Ends after (optional)">
              <input type="date" className={inputClass} value={endDate} min={state.trip.startDate} max={state.trip.endDate} onChange={(e) => setEndDate(e.target.value)} />
            </Field>
          </div>
          <Field label="What the group will read">
            <input className={inputClass} value={detail} maxLength={200} onChange={(e) => setDetail(e.target.value)} placeholder="e.g. Start at 10:30 instead of 09:00" />
          </Field>
          <fieldset>
            <legend className="text-sm font-semibold">Who this affects</legend>
            <div className="mt-1 flex flex-wrap gap-2">
              {pickable.map((t) => (
                <label key={t.id} className="flex min-h-11 items-center gap-2 rounded-full bg-muted px-3 text-sm">
                  <input type="checkbox" className="size-5" checked={who.includes(t.id)} onChange={(e) => setWho((w) => (e.target.checked ? [...w, t.id] : w.filter((x) => x !== t.id)))} />
                  {t.name}
                </label>
              ))}
            </div>
          </fieldset>
          <Field label="Private reason (optional — organisers and the people affected only)">
            <textarea className={inputClass} rows={2} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} />
          </Field>
          {error ? <p role="alert" className="rounded-xl bg-sunny-soft px-3 py-2 text-sm">{error}</p> : null}
          {ok ? <p role="status" className="text-sm">{ok}</p> : null}
          <Button type="button" onClick={propose}>Propose</Button>
          <p className="text-xs text-muted-foreground">
            Answers are optional and nobody is scored. Adding a change to the plan is an organiser decision, not a vote; the plan then goes back to draft so hours, bookings, needs and funding are checked before it is shared.
          </p>
        </Card>
      )}

      <Card className="space-y-3">
        <h2 className="text-lg">Changes</h2>
        {state.arrangements.length === 0 ? <p className="text-sm text-muted-foreground">None yet.</p> : null}
        <ul className="space-y-2">
          {state.arrangements.map((a) => {
            const status = arrangementStatus(a);
            const responses = currentResponses(a);
            return (
              <li key={a.id} className="rounded-xl bg-muted px-3 py-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold"><CalendarClock className="mr-1 inline size-4" aria-hidden />Day {a.dayNumber} · {ARRANGEMENT_LABEL[a.kind]}: {a.detail}</p>
                  <Chip tone={status === "applied" ? "lime" : status === "proposed" ? "primary" : "sunny"}>{ARRANGEMENT_STATUS_LABEL[status]}</Chip>
                </div>
                <p className="text-xs text-muted-foreground">
                  Proposed by {actorName(state, a.createdBy)}{a.endDate ? ` · ends after ${a.endDate}` : ""} · version {a.version}
                </p>
                {a.reason && maySeeArrangementReason(state, a) ? (
                  <p className="mt-1 text-sm"><Lock className="mr-1 inline size-3" aria-hidden />{a.reason}</p>
                ) : null}
                <ul className="mt-1 flex flex-wrap gap-1 text-xs">
                  {responses.map((r) => (
                    <li key={r.travellerId} className="rounded-full bg-card px-2 py-1">
                      {actorName(state, r.travellerId)}: {r.state === "pending" ? "no answer yet" : r.state}
                      {r.proxy ? ` (answered by ${actorName(state, r.byId)})` : ""}
                    </li>
                  ))}
                </ul>
                {status === "proposed" ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {responses.filter((r) => canEditFor(state, r.travellerId)).map((r) => (
                      <span key={r.travellerId} className="flex flex-wrap gap-2">
                        <Button type="button" variant="outline" onClick={() => run(() => respondToArrangement(a.id, r.travellerId, "confirmed"))}>
                          {r.travellerId === me ? "Works for me" : `Works for ${actorName(state, r.travellerId)}`}
                        </Button>
                        <Button type="button" variant="outline" onClick={() => run(() => respondToArrangement(a.id, r.travellerId, "declined"))}>
                          {r.travellerId === me ? "Not for me" : `Not for ${actorName(state, r.travellerId)}`}
                        </Button>
                      </span>
                    ))}
                    {organiser ? (
                      <Button type="button" onClick={() => run(() => { const e = applyArrangement(a.id); if (!e) trackProduct(state, "arrangement_applied", { kind: a.kind }); return e; }, "Added to the draft plan. Review and publish it from the itinerary.")}>Add to draft plan</Button>
                    ) : null}
                    {organiser || a.createdBy === me ? (
                      <Button type="button" variant="outline" onClick={() => run(() => withdrawArrangement(a.id))}>Withdraw</Button>
                    ) : null}
                  </div>
                ) : null}
                {status === "applied" ? (
                  <Link to="/itinerary" className="mt-1 inline-block text-sm font-semibold underline">Open the itinerary to review and publish</Link>
                ) : null}
              </li>
            );
          })}
        </ul>
      </Card>
    </AppShell>
  );
}
