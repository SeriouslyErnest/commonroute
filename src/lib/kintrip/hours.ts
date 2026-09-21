import type { Attraction, HoursException, HoursRecord, HoursInterval } from "./types";

export const WEEKDAY_LABEL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export const toMinutes = (hhmm: string) => {
  const [h, m] = (hhmm || "0:0").split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};

export const fromMinutes = (mins: number) => {
  const m = ((mins % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
};

/** Weekday of a YYYY-MM-DD date, read as a plain calendar date (no zone shift). */
export function weekdayOf(isoDate: string): number {
  return new Date(`${isoDate}T00:00:00Z`).getUTCDay();
}

export interface OpenWindow {
  /** Minutes from midnight on the visit date; `end` may exceed 1440 when it runs overnight. */
  start: number;
  end: number;
  label?: undefined | string;
}

export type HoursOutcome =
  | "unknown"
  | "needs_check"
  | "closed"
  | "open"
  | "exceeds_closing"
  | "last_admission_missed";

export interface HoursResolution {
  outcome: HoursOutcome;
  windows: OpenWindow[];
  /** Latest minute a visit may still begin, once last admission is applied. */
  latestStart: number | null;
  message: string;
  sourceName?: undefined | string;
  sourceUrl?: undefined | string;
  checkedAt?: undefined | string;
  exception?: undefined | HoursException;
}

function windowsFor(record: HoursRecord, isoDate: string): { windows: OpenWindow[]; exception?: HoursException } {
  const exception = record.exceptions.find((e) => e.date === isoDate);
  if (exception) {
    // A dated, authoritative exception always beats the weekly pattern.
    if (exception.closed || !exception.open || !exception.close) {
      return { windows: [], exception };
    }
    const start = toMinutes(exception.open);
    let end = toMinutes(exception.close);
    if (end <= start) end += 1440;
    return { windows: [{ start, end, label: exception.label }], exception };
  }
  const day = weekdayOf(isoDate);
  const windows = record.intervals
    .filter((i: HoursInterval) => i.weekday === day)
    .map((i) => {
      const start = toMinutes(i.open);
      let end = toMinutes(i.close);
      if (end <= start) end += 1440; // runs past midnight
      return { start, end };
    })
    .sort((a, b) => a.start - b.start);
  return { windows };
}

function withinValidity(record: HoursRecord, isoDate: string): boolean {
  if (record.validFrom && isoDate < record.validFrom) return false;
  if (record.validTo && isoDate > record.validTo) return false;
  return true;
}

/**
 * Resolve a place's hours against the real visit date and planned visit.
 * Missing information stays missing — it never becomes a green "open".
 */
export function resolveHours(
  place: Attraction,
  isoDate: string,
  startHHMM?: string,
  durationMin?: number,
): HoursResolution {
  const record = place.hours;
  if (!record || (record.intervals.length === 0 && record.exceptions.length === 0)) {
    return {
      outcome: "unknown",
      windows: [],
      latestStart: null,
      message: "Opening hours unknown — check with the venue before planning around it.",
    };
  }

  const meta = {
    sourceName: record.sourceName,
    sourceUrl: record.sourceUrl,
    checkedAt: record.checkedAt,
  };

  const { windows, exception } = windowsFor(record, isoDate);
  const stale = !withinValidity(record, isoDate) || record.verification === "needs_check";

  if (windows.length === 0) {
    if (stale && !exception) {
      return {
        outcome: "needs_check",
        windows: [],
        latestStart: null,
        message: "Hours need checking for this date — the record we have does not cover it.",
        ...meta,
      };
    }
    return {
      outcome: "closed",
      windows: [],
      latestStart: null,
      message: exception?.label
        ? `Closed on this date — ${exception.label}.`
        : `Closed on ${WEEKDAY_LABEL[weekdayOf(isoDate)]}s.`,
      exception,
      ...meta,
    };
  }

  const lastAdmission = record.lastAdmissionMin ?? 0;
  const latestStart = Math.max(
    ...windows.map((w) => w.end - lastAdmission - (durationMin ?? 0)),
  );

  if (stale) {
    return {
      outcome: "needs_check",
      windows,
      latestStart,
      message: "Hours need checking for this date — the record we have may be out of season.",
      exception,
      ...meta,
    };
  }

  if (startHHMM == null) {
    return {
      outcome: "open",
      windows,
      latestStart,
      message: `Open ${windows.map((w) => `${fromMinutes(w.start)}–${fromMinutes(w.end)}`).join(", ")}.`,
      exception,
      ...meta,
    };
  }

  const start = toMinutes(startHHMM);
  const finish = start + (durationMin ?? 0);
  const window = windows.find((w) => start >= w.start && start <= w.end);

  if (!window) {
    return {
      outcome: "closed",
      windows,
      latestStart,
      message: `Not open at ${startHHMM} — open ${windows
        .map((w) => `${fromMinutes(w.start)}–${fromMinutes(w.end)}`)
        .join(", ")}.`,
      exception,
      ...meta,
    };
  }

  if (lastAdmission > 0 && start > window.end - lastAdmission) {
    return {
      outcome: "last_admission_missed",
      windows,
      latestStart,
      message: `Last admission is ${fromMinutes(window.end - lastAdmission)} — a ${startHHMM} start is too late.`,
      exception,
      ...meta,
    };
  }

  if (finish > window.end) {
    return {
      outcome: "exceeds_closing",
      windows,
      latestStart,
      message: `The visit runs past closing at ${fromMinutes(window.end)}.`,
      exception,
      ...meta,
    };
  }

  return {
    outcome: "open",
    windows,
    latestStart,
    message: `Open for this visit (until ${fromMinutes(window.end)}).`,
    exception,
    ...meta,
  };
}

export const HOURS_OUTCOME_LABEL: Record<HoursOutcome, string> = {
  open: "Open for your visit",
  closed: "Closed on this date",
  exceeds_closing: "Visit runs past closing",
  last_admission_missed: "Last admission missed",
  needs_check: "Hours need checking",
  unknown: "Hours unknown",
};

/** Colour-independent severity so pins and chips never rely on colour alone. */
export function hoursSeverity(outcome: HoursOutcome): "ok" | "warn" | "block" {
  if (outcome === "open") return "ok";
  if (outcome === "unknown" || outcome === "needs_check") return "warn";
  return "block";
}

export function emptyHours(): HoursRecord {
  return { intervals: [], exceptions: [], verification: "unknown" };
}

/** A plain weekly summary, grouping days that share the same hours. */
export function weeklySummary(record: HoursRecord): string[] {
  const byDay = new Map<number, string>();
  for (let d = 0; d < 7; d += 1) {
    const iv = record.intervals.filter((i) => i.weekday === d);
    byDay.set(
      d,
      iv.length === 0 ? "Closed" : iv.map((i) => `${i.open}–${i.close}`).join(", "),
    );
  }
  return [...byDay.entries()].map(([d, text]) => `${WEEKDAY_LABEL[d]}: ${text}`);
}
