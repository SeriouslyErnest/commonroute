import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button, Card, Chip, Field, inputClass } from "@/components/kintrip/ui";
import {
  CAR_STATUS_LABEL,
  EVIDENCE_LABEL,
  LEG_MODE_LABEL,
  accessHeadline,
  emptyAccess,
  newLeg,
  reviewAccess,
} from "@/lib/kintrip/access";
import {
  HOURS_OUTCOME_LABEL,
  WEEKDAY_LABEL,
  emptyHours,
  hoursSeverity,
  resolveHours,
} from "@/lib/kintrip/hours";
import { setState } from "@/lib/kintrip/store";
import type {
  AccessLeg,
  AccessProfile,
  Attraction,
  CarStatus,
  EvidenceState,
  HoursRecord,
  LegMode,
} from "@/lib/kintrip/types";

function update(id: string, change: (place: Attraction) => Attraction) {
  setState((prev) => ({
    ...prev,
    attractions: prev.attractions.map((a) => (a.id === id ? change(a) : a)),
  }));
}

/* ---------------- where it is ---------------- */

export function LocationPanel({ place }: { place: Attraction }) {
  const [lat, setLat] = useState(place.latitude != null ? String(place.latitude) : "");
  const [lng, setLng] = useState(place.longitude != null ? String(place.longitude) : "");
  const [zone, setZone] = useState(place.timeZone ?? "");

  return (
    <Card className="space-y-3">
      <h2 className="text-lg">Where it is</h2>
      <p className="text-sm text-muted-foreground">
        A location is only ever entered by someone — we never guess one from the address.
      </p>
      <div className="grid gap-2 sm:grid-cols-3">
        <Field label="Latitude">
          <input className={inputClass} value={lat} onChange={(e) => setLat(e.target.value)} inputMode="decimal" />
        </Field>
        <Field label="Longitude">
          <input className={inputClass} value={lng} onChange={(e) => setLng(e.target.value)} inputMode="decimal" />
        </Field>
        <Field label="Time zone (IANA)">
          <input
            className={inputClass}
            value={zone}
            placeholder="Asia/Tokyo"
            onChange={(e) => setZone(e.target.value)}
          />
        </Field>
      </div>
      <Button
        onClick={() => {
          const la = Number(lat);
          const lo = Number(lng);
          update(place.id, (a) => ({
            ...a,
            latitude: Number.isFinite(la) && lat.trim() !== "" ? la : undefined,
            longitude: Number.isFinite(lo) && lng.trim() !== "" ? lo : undefined,
            timeZone: zone.trim() || undefined,
          }));
        }}
      >
        Save location
      </Button>
    </Card>
  );
}

/* ---------------- opening hours ---------------- */

export function HoursPanel({ place, visitDate }: { place: Attraction; visitDate?: string }) {
  const record: HoursRecord = place.hours ?? emptyHours();
  const today = new Date().toISOString().slice(0, 10);
  const checkDate = visitDate ?? today;
  const resolution = resolveHours(place, checkDate);
  const severity = hoursSeverity(resolution.outcome);
  const [exDate, setExDate] = useState("");
  const [exLabel, setExLabel] = useState("");

  const save = (next: Partial<HoursRecord>) =>
    update(place.id, (a) => ({ ...a, hours: { ...record, ...next } }));

  const setDay = (weekday: number, field: "open" | "close", value: string) => {
    const others = record.intervals.filter((i) => i.weekday !== weekday);
    const mine = record.intervals.find((i) => i.weekday === weekday) ?? {
      weekday,
      open: "",
      close: "",
    };
    const merged = { ...mine, [field]: value };
    const intervals = merged.open && merged.close ? [...others, merged] : others;
    save({ intervals: intervals.sort((a, b) => a.weekday - b.weekday) });
  };

  return (
    <Card className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-lg">Opening hours</h2>
        <Chip tone={severity === "ok" ? "lime" : severity === "warn" ? "sunny" : "coral"}>
          {HOURS_OUTCOME_LABEL[resolution.outcome]}
        </Chip>
      </div>
      <p className="text-sm text-muted-foreground">
        Hours for {checkDate}: {resolution.message}
      </p>

      <div className="space-y-2">
        {WEEKDAY_LABEL.map((label, weekday) => {
          const interval = record.intervals.find((i) => i.weekday === weekday);
          return (
            <div key={label} className="flex flex-wrap items-center gap-2">
              <span className="w-24 text-sm">{label}</span>
              <input
                type="time"
                aria-label={`${label} opening time`}
                className={inputClass}
                style={{ maxWidth: 140 }}
                value={interval?.open ?? ""}
                onChange={(e) => setDay(weekday, "open", e.target.value)}
              />
              <input
                type="time"
                aria-label={`${label} closing time`}
                className={inputClass}
                style={{ maxWidth: 140 }}
                value={interval?.close ?? ""}
                onChange={(e) => setDay(weekday, "close", e.target.value)}
              />
              {!interval ? <span className="text-sm text-muted-foreground">Closed</span> : null}
            </div>
          );
        })}
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <Field label="Last admission (minutes before closing)">
          <input
            className={inputClass}
            inputMode="numeric"
            value={record.lastAdmissionMin ?? ""}
            onChange={(e) => save({ lastAdmissionMin: e.target.value ? Number(e.target.value) : undefined })}
          />
        </Field>
        <Field label="Last food order (minutes before closing)">
          <input
            className={inputClass}
            inputMode="numeric"
            value={record.lastOrderMin ?? ""}
            onChange={(e) => save({ lastOrderMin: e.target.value ? Number(e.target.value) : undefined })}
          />
        </Field>
        <Field label="Where this came from">
          <input
            className={inputClass}
            value={record.sourceName ?? ""}
            placeholder="Venue website"
            onChange={(e) => save({ sourceName: e.target.value || undefined })}
          />
        </Field>
        <Field label="Source link">
          <input
            className={inputClass}
            value={record.sourceUrl ?? ""}
            onChange={(e) => save({ sourceUrl: e.target.value || undefined })}
          />
        </Field>
        <Field label="Known good from">
          <input
            type="date"
            className={inputClass}
            value={record.validFrom ?? ""}
            onChange={(e) => save({ validFrom: e.target.value || undefined })}
          />
        </Field>
        <Field label="Known good until">
          <input
            type="date"
            className={inputClass}
            value={record.validTo ?? ""}
            onChange={(e) => save({ validTo: e.target.value || undefined })}
          />
        </Field>
        <Field label="How sure are we?">
          <select
            className={inputClass}
            value={record.verification}
            onChange={(e) =>
              save({
                verification: e.target.value as HoursRecord["verification"],
                checkedAt: new Date().toISOString(),
              })
            }
          >
            <option value="unknown">Unknown</option>
            <option value="reported">Reported by someone</option>
            <option value="confirmed">Confirmed with the venue</option>
            <option value="needs_check">Needs checking</option>
          </select>
        </Field>
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-semibold">Closures and special dates</h3>
        {record.exceptions.length === 0 ? (
          <p className="text-sm text-muted-foreground">None recorded.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {record.exceptions.map((ex) => (
              <li key={ex.date} className="flex items-center gap-2">
                <span>
                  {ex.date}: {ex.closed ? "Closed" : `${ex.open}–${ex.close}`}
                  {ex.label ? ` — ${ex.label}` : ""}
                </span>
                <button
                  type="button"
                  aria-label={`Remove the entry for ${ex.date}`}
                  className="ml-auto min-h-11 px-2"
                  onClick={() => save({ exceptions: record.exceptions.filter((e) => e.date !== ex.date) })}
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex flex-wrap items-end gap-2">
          <Field label="Date">
            <input type="date" className={inputClass} value={exDate} onChange={(e) => setExDate(e.target.value)} />
          </Field>
          <Field label="Reason">
            <input
              className={inputClass}
              value={exLabel}
              placeholder="Public holiday"
              onChange={(e) => setExLabel(e.target.value)}
            />
          </Field>
          <Button
            variant="outline"
            disabled={!exDate}
            onClick={() => {
              save({
                exceptions: [
                  ...record.exceptions.filter((e) => e.date !== exDate),
                  { date: exDate, closed: true, label: exLabel || undefined },
                ].sort((a, b) => a.date.localeCompare(b.date)),
              });
              setExDate("");
              setExLabel("");
            }}
          >
            <Plus className="h-4 w-4" aria-hidden /> Mark closed
          </Button>
        </div>
      </div>
    </Card>
  );
}

/* ---------------- getting there ---------------- */

const MODES: LegMode[] = ["drive", "park", "walk", "bus", "shuttle", "rail", "cable_car", "ferry", "taxi"];
const EVIDENCE: EvidenceState[] = ["unknown", "reported", "confirmed", "unsuitable"];

export function AccessPanel({ place, finishTime }: { place: Attraction; finishTime?: string }) {
  const access: AccessProfile = place.access ?? emptyAccess();
  const issues = reviewAccess({ ...place, access }, finishTime);
  const headline = accessHeadline(access);

  const save = (next: Partial<AccessProfile>) =>
    update(place.id, (a) => ({ ...a, access: { ...access, ...next } }));

  const editLeg = (direction: "outbound" | "inbound", id: string, change: Partial<AccessLeg>) =>
    save({ [direction]: access[direction].map((l) => (l.id === id ? { ...l, ...change } : l)) } as Partial<AccessProfile>);

  const legList = (direction: "outbound" | "inbound") => (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-semibold">{direction === "outbound" ? "Getting there" : "Getting back"}</h3>
        <Button
          variant="outline"
          className="ml-auto"
          onClick={() => save({ [direction]: [...access[direction], newLeg()] } as Partial<AccessProfile>)}
        >
          <Plus className="h-4 w-4" aria-hidden /> Add a leg
        </Button>
      </div>
      {access[direction].length === 0 ? (
        <p className="text-sm text-muted-foreground">No legs recorded.</p>
      ) : null}
      {access[direction].map((leg, index) => (
        <div key={leg.id} className="space-y-2 rounded-xl border border-border p-3">
          <div className="flex flex-wrap items-center gap-2">
            <Chip>Leg {index + 1}</Chip>
            <select
              className={inputClass}
              style={{ maxWidth: 160 }}
              aria-label="Type of travel"
              value={leg.mode}
              onChange={(e) => editLeg(direction, leg.id, { mode: e.target.value as LegMode })}
            >
              {MODES.map((m) => (
                <option key={m} value={m}>
                  {LEG_MODE_LABEL[m]}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="ml-auto min-h-11 px-2"
              aria-label={`Remove leg ${index + 1}`}
              onClick={() =>
                save({ [direction]: access[direction].filter((l) => l.id !== leg.id) } as Partial<AccessProfile>)
              }
            >
              <Trash2 className="h-4 w-4" aria-hidden />
            </button>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <Field label="From">
              <input
                className={inputClass}
                value={leg.from}
                onChange={(e) => editLeg(direction, leg.id, { from: e.target.value })}
              />
            </Field>
            <Field label="To">
              <input
                className={inputClass}
                value={leg.to}
                onChange={(e) => editLeg(direction, leg.id, { to: e.target.value })}
              />
            </Field>
            <Field label="Minutes">
              <input
                className={inputClass}
                inputMode="numeric"
                value={leg.durationMin ?? ""}
                onChange={(e) =>
                  editLeg(direction, leg.id, {
                    durationMin: e.target.value ? Number(e.target.value) : undefined,
                  })
                }
              />
            </Field>
            <Field label="Last service of the day">
              <input
                type="time"
                className={inputClass}
                value={leg.lastDeparture ?? ""}
                onChange={(e) => editLeg(direction, leg.id, { lastDeparture: e.target.value || undefined })}
              />
            </Field>
            <Field label="Needs booking?">
              <select
                className={inputClass}
                value={leg.bookingRequired ?? "unknown"}
                onChange={(e) =>
                  editLeg(direction, leg.id, {
                    bookingRequired: e.target.value as AccessLeg["bookingRequired"],
                  })
                }
              >
                <option value="unknown">Unknown</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </Field>
            <Field label="Step-free">
              <select
                className={inputClass}
                value={leg.stepFree}
                onChange={(e) => editLeg(direction, leg.id, { stepFree: e.target.value as EvidenceState })}
              >
                {EVIDENCE.map((e) => (
                  <option key={e} value={e}>
                    {EVIDENCE_LABEL[e]}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <Card className="space-y-3">
      <h2 className="text-lg">Getting there and back</h2>
      {headline ? <p className="text-sm font-semibold">{headline}</p> : null}
      <div className="grid gap-2 sm:grid-cols-2">
        <Field label="Can you drive to it?">
          <select
            className={inputClass}
            value={access.carStatus}
            onChange={(e) => save({ carStatus: e.target.value as CarStatus })}
          >
            {(Object.keys(CAR_STATUS_LABEL) as CarStatus[]).map((s) => (
              <option key={s} value={s}>
                {CAR_STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Where the car stops (gateway)">
          <input
            className={inputClass}
            value={access.gatewayName ?? ""}
            onChange={(e) => save({ gatewayName: e.target.value || undefined })}
          />
        </Field>
        <Field label="Head back by">
          <input
            type="time"
            className={inputClass}
            value={access.returnDeadline ?? ""}
            onChange={(e) => save({ returnDeadline: e.target.value || undefined })}
          />
        </Field>
        <Field label="Boarding allowance (minutes)">
          <input
            className={inputClass}
            inputMode="numeric"
            value={access.transferBufferMin ?? ""}
            placeholder="15"
            onChange={(e) =>
              save({ transferBufferMin: e.target.value ? Number(e.target.value) : undefined })
            }
          />
        </Field>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={access.oneWay ?? false}
          onChange={(e) => save({ oneWay: e.target.checked })}
        />
        This is a one-way crossing — you do not come back to the car
      </label>
      {access.oneWay ? (
        <Field label="Where the car ends up">
          <input
            className={inputClass}
            value={access.carEndsAt ?? ""}
            onChange={(e) => save({ carEndsAt: e.target.value || undefined })}
          />
        </Field>
      ) : null}

      {legList("outbound")}
      {legList("inbound")}

      {issues.length > 0 ? (
        <ul className="space-y-1 text-sm">
          {issues.map((issue) => (
            <li key={issue.id}>
              <Chip tone={issue.severity === "block" ? "coral" : "sunny"}>
                {issue.severity === "block" ? "Blocks the day" : "Needs checking"}
              </Chip>{" "}
              {issue.text}
            </li>
          ))}
        </ul>
      ) : null}
      <p className="text-xs text-muted-foreground">
        Whether a car can get there is a different question from whether the journey suits everyone travelling.
        Neither is assumed from the other.
      </p>
    </Card>
  );
}
