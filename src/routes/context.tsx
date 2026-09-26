import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { BadgeCheck, History, UserRound } from "lucide-react";
import { AppShell } from "@/components/kintrip/AppShell";
import { Button, Card, Chip, Field, inputClass } from "@/components/kintrip/ui";
import { useKintrip } from "@/lib/kintrip/store";
import { actorName, canEditFor, isOrganiser } from "@/lib/kintrip/governance";
import {
  CONFIRM_LABEL,
  FIELD_LABEL,
  SOURCE_LABEL,
  effectiveValue,
  isConfirmed,
  preferenceConflicts,
  visiblePreferences,
} from "@/lib/kintrip/enhancements";
import {
  confirmPreference,
  deletePreference,
  editPreference,
  recordPreference,
  rejectPreference,
  rememberPreference,
} from "@/lib/kintrip/enhancements.actions";
import type { PrefField, PreferenceRecord } from "@/lib/kintrip/types";

export const Route = createFileRoute("/context")({
  head: () => ({
    meta: [
      { title: "Traveller settings — CommonRoute" },
      { name: "description", content: "Trip-only preferences with who said them, for how long, and who confirmed them." },
      { property: "og:title", content: "Traveller settings — CommonRoute" },
      { property: "og:description", content: "Keep a slower Kyoto day separate from someone's usual pace — and know who said so." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ContextScreen,
});

const FIELDS: PrefField[] = ["pace", "walking", "earliestStart", "latestFinish", "restWindow", "note"];
const CHOICES: Partial<Record<PrefField, string[]>> = {
  pace: ["relaxed", "balanced", "packed"],
  walking: ["low", "moderate", "high"],
};

function ContextScreen() {
  const state = useKintrip();
  const me = state.activeTravellerId;
  const organiser = isOrganiser(state);
  const subjects = state.travellers.filter((t) => canEditFor(state, t.id) || organiser);
  const [subjectId, setSubjectId] = useState(me);
  const [field, setField] = useState<PrefField>("pace");
  const [value, setValue] = useState("relaxed");
  const [fromDay, setFromDay] = useState("");
  const [toDay, setToDay] = useState("");
  const [general, setGeneral] = useState(false);
  const [visibility, setVisibility] = useState<PreferenceRecord["visibility"]>("organisers");
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const days = state.itinerary?.days.length ?? Math.max(1, Math.round((Date.parse(state.trip.endDate) - Date.parse(state.trip.startDate)) / 86400000) + 1);

  const self = subjectId === me;
  const proxy = !self && canEditFor(state, subjectId);
  const sourceText = self ? "You, for yourself" : proxy ? `You, as ${actorName(state, subjectId)}'s authorised helper` : "An organiser's observation — it will need their confirmation";

  const save = () => {
    setError(null);
    setNote(null);
    const err = recordPreference({
      subjectId,
      field,
      value,
      scope: general ? "general" : "trip",
      fromDay: !general && fromDay ? Number(fromDay) : undefined,
      toDay: !general && toDay ? Number(toDay) : !general && fromDay ? Number(fromDay) : undefined,
      visibility,
    });
    if (err) setError(err);
    else setNote("Saved.");
  };

  const records = visiblePreferences(state);
  const conflicts = preferenceConflicts(state);
  const run = (fn: () => string | null) => {
    const e = fn();
    setError(e);
  };

  return (
    <AppShell title="Traveller settings" subtitle="Who said it, for how long, and who confirmed it">
      <Card className="space-y-3">
        <h2 className="text-lg">Add a setting</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="For">
            <select className={inputClass} value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
              {subjects.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.id === me ? `${t.name} (you)` : t.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Setting">
            <select
              className={inputClass}
              value={field}
              onChange={(e) => {
                const f = e.target.value as PrefField;
                setField(f);
                setValue(CHOICES[f]?.[0] ?? "");
              }}
            >
              {FIELDS.map((f) => (
                <option key={f} value={f}>
                  {FIELD_LABEL[f]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Value">
            {CHOICES[field] ? (
              <select className={inputClass} value={value} onChange={(e) => setValue(e.target.value)}>
                {CHOICES[field]!.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            ) : field === "earliestStart" || field === "latestFinish" ? (
              <input type="time" className={inputClass} value={value} onChange={(e) => setValue(e.target.value)} />
            ) : (
              <input className={inputClass} value={value} maxLength={200} onChange={(e) => setValue(e.target.value)} placeholder={field === "restWindow" ? "13:00-14:30" : ""} />
            )}
          </Field>
          <Field label="Who can see it">
            <select className={inputClass} value={visibility} onChange={(e) => setVisibility(e.target.value as PreferenceRecord["visibility"])}>
              <option value="private">Only them and their helper</option>
              <option value="organisers">Organisers too</option>
              <option value="group">The whole group</option>
            </select>
          </Field>
        </div>
        {!general ? (
          <div className="grid grid-cols-2 gap-3">
            <Field label="From day (optional)">
              <select className={inputClass} value={fromDay} onChange={(e) => setFromDay(e.target.value)}>
                <option value="">Whole trip</option>
                {Array.from({ length: days }, (_, i) => (
                  <option key={i + 1} value={i + 1}>
                    Day {i + 1}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="To day">
              <select className={inputClass} value={toDay} onChange={(e) => setToDay(e.target.value)} disabled={!fromDay}>
                <option value="">Same day</option>
                {Array.from({ length: days }, (_, i) => (
                  <option key={i + 1} value={i + 1}>
                    Day {i + 1}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        ) : null}
        {self || proxy ? (
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input type="checkbox" className="size-5" checked={general} onChange={(e) => setGeneral(e.target.checked)} />
            Remember for future trips (otherwise it stays with this trip)
          </label>
        ) : null}
        <p className="text-xs text-muted-foreground">Recorded as: {sourceText}.</p>
        {error ? <p role="alert" className="rounded-xl bg-sunny-soft px-3 py-2 text-sm">{error}</p> : null}
        {note ? <p role="status" className="text-sm">{note}</p> : null}
        <Button type="button" onClick={save}>Save setting</Button>
      </Card>

      {conflicts.length > 0 ? (
        <Card className="space-y-2 border-secondary/40">
          <h2 className="text-lg">To settle</h2>
          {conflicts.map((c) => (
            <p key={c.ids.join()} className="text-sm">
              {actorName(state, c.subjectId)} — two confirmed {FIELD_LABEL[c.field].toLowerCase()} values disagree. The planner keeps the usual value until one is changed or marked not right.
            </p>
          ))}
        </Card>
      ) : null}

      <Card className="space-y-3">
        <h2 className="text-lg">Settings you can see</h2>
        {records.length === 0 ? <p className="text-sm text-muted-foreground">Nothing yet. Older answers from the preferences screen still apply.</p> : null}
        <ul className="space-y-2">
          {records.map((r) => (
            <PrefRow key={r.id} r={r} onRun={run} />
          ))}
        </ul>
        <p className="text-xs text-muted-foreground">
          Planner uses: confirmed values for that day → confirmed for this trip → usual profile. A temporary setting can make walking gentler, never harder.
          {" "}Effective pace for you today: {effectiveValue(state, me, "pace", state.currentDay).value ?? "unknown"}.
        </p>
      </Card>
    </AppShell>
  );
}

function PrefRow({ r, onRun }: { r: PreferenceRecord; onRun: (fn: () => string | null) => void }) {
  const state = useKintrip();
  const mine = canEditFor(state, r.subjectId);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(r.value);
  const [showHistory, setShowHistory] = useState(false);
  const range = r.scope === "general" ? "Future trips too" : r.fromDay ? (r.toDay && r.toDay !== r.fromDay ? `Days ${r.fromDay}–${r.toDay}` : `Day ${r.fromDay}`) : "This trip";
  return (
    <li className="rounded-xl bg-muted px-3 py-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-semibold">
          <UserRound className="mr-1 inline size-4" aria-hidden />
          {actorName(state, r.subjectId)} · {FIELD_LABEL[r.field]}: {r.value}
        </p>
        <span className="flex flex-wrap gap-1">
          <Chip tone="primary">{range}</Chip>
          <Chip tone={isConfirmed(r) ? "lime" : "sunny"}>
            {isConfirmed(r) ? <BadgeCheck className="size-3" aria-hidden /> : null} {CONFIRM_LABEL[r.confirmation]}
          </Chip>
        </span>
      </div>
      <p className="text-xs text-muted-foreground">
        {SOURCE_LABEL[r.sourceKind]} · recorded by {r.recordedByName} · version {r.version}
      </p>
      {editing ? (
        <div className="mt-2 flex gap-2">
          <input className={inputClass} value={draft} onChange={(e) => setDraft(e.target.value)} aria-label="New value" />
          <Button type="button" onClick={() => { onRun(() => editPreference(r.id, draft, r.version)); setEditing(false); }}>Save</Button>
        </div>
      ) : null}
      <div className="mt-2 flex flex-wrap gap-2">
        {mine && !isConfirmed(r) && r.confirmation !== "rejected" ? (
          <>
            <Button type="button" onClick={() => onRun(() => confirmPreference(r.id))}>That's right</Button>
            <Button type="button" variant="outline" onClick={() => onRun(() => rejectPreference(r.id))}>Not right</Button>
          </>
        ) : null}
        {mine || (isOrganiser(state) && r.sourceKind === "organiser_observation") ? (
          <Button type="button" variant="outline" onClick={() => setEditing((v) => !v)}>Correct it</Button>
        ) : null}
        {mine && r.scope === "trip" && isConfirmed(r) && r.sourceKind !== "organiser_observation" ? (
          <Button type="button" variant="outline" onClick={() => onRun(() => rememberPreference(r.id))}>Remember for future trips</Button>
        ) : null}
        <Button type="button" variant="outline" onClick={() => setShowHistory((v) => !v)}>
          <History className="size-4" aria-hidden /> History
        </Button>
        {mine || r.recordedBy === state.activeTravellerId ? (
          <Button type="button" variant="outline" onClick={() => onRun(() => deletePreference(r.id))}>Delete</Button>
        ) : null}
      </div>
      {showHistory ? (
        <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
          {r.history.map((h, i) => (
            <li key={i}>v{h.version} · {h.action} “{h.value}” by {h.by}</li>
          ))}
        </ul>
      ) : null}
    </li>
  );
}
