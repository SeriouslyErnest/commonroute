import type {
  AccessLeg,
  AccessProfile,
  Attraction,
  CarStatus,
  EvidenceState,
  LegMode,
  Traveller,
} from "./types";
import { toMinutes, fromMinutes } from "./hours";

export const CAR_STATUS_LABEL: Record<CarStatus, string> = {
  direct: "You can drive to this place",
  park_and_transfer: "Park, then take onward transport",
  restricted: "Cars restricted — conditions apply",
  prohibited: "Private cars are not allowed",
  unknown: "Car access unknown",
};

export const LEG_MODE_LABEL: Record<LegMode, string> = {
  drive: "Drive",
  park: "Park",
  walk: "Walk",
  bus: "Bus",
  shuttle: "Shuttle",
  rail: "Train",
  cable_car: "Cable car",
  ferry: "Ferry",
  taxi: "Taxi",
};

export const EVIDENCE_LABEL: Record<EvidenceState, string> = {
  confirmed: "Confirmed",
  reported: "Reported",
  unsuitable: "Not suitable",
  unknown: "Unknown",
};

/** Default allowance for getting off one service and onto the next. */
export const DEFAULT_TRANSFER_BUFFER_MIN = 15;

export function emptyAccess(): AccessProfile {
  return { carStatus: "unknown", outbound: [], inbound: [] };
}

export function newLeg(mode: LegMode = "walk"): AccessLeg {
  return {
    id: `leg-${Math.random().toString(36).slice(2, 9)}`,
    mode,
    from: "",
    to: "",
    stepFree: "unknown",
    wheelchair: "unknown",
    stroller: "unknown",
    bookingRequired: "unknown",
  };
}

/** "Drive to Sawando, then shuttle" — the one line that goes on an activity card. */
export function accessHeadline(access: AccessProfile | undefined): string | null {
  if (!access) return null;
  if (access.carStatus === "direct") return null;
  const onward = access.outbound.find((l) => l.mode !== "drive" && l.mode !== "park");
  if (access.gatewayName && onward) {
    return `Drive to ${access.gatewayName}, then ${LEG_MODE_LABEL[onward.mode].toLowerCase()}`;
  }
  if (access.gatewayName) return `Drive to ${access.gatewayName}, then onward transport`;
  return CAR_STATUS_LABEL[access.carStatus];
}

export interface AccessIssue {
  id: string;
  text: string;
  severity: "block" | "warn";
}

/**
 * Check the whole excursion, including getting back. Unknowns stay unknown:
 * a missing timetable never certifies a return as workable.
 */
export function reviewAccess(
  place: Attraction,
  finishHHMM?: string,
): AccessIssue[] {
  const access = place.access;
  if (!access) return [];
  const issues: AccessIssue[] = [];
  const buffer = access.transferBufferMin ?? DEFAULT_TRANSFER_BUFFER_MIN;

  if (access.carStatus === "prohibited" && !access.gatewayName) {
    issues.push({
      id: `${place.id}-gateway`,
      text: `Private cars cannot reach ${place.name}, and no parking gateway is recorded yet.`,
      severity: "block",
    });
  }

  const legs = [...access.outbound, ...access.inbound];
  if (legs.some((l) => l.mode !== "walk" && l.mode !== "drive" && l.mode !== "park" && !l.lastDeparture)) {
    issues.push({
      id: `${place.id}-timetable`,
      text: `Transport timetable needs confirmation for ${place.name} — the return cannot be checked yet.`,
      severity: "warn",
    });
  }

  const lastReturn = access.inbound.find((l) => l.lastDeparture)?.lastDeparture ?? access.returnDeadline;
  if (lastReturn && finishHHMM) {
    const walkLeg = access.inbound.find((l) => l.mode === "walk");
    const walkMin = walkLeg?.durationMin ?? 0;
    const mustLeaveBy = toMinutes(lastReturn) - buffer - walkMin;
    if (toMinutes(finishHHMM) > mustLeaveBy) {
      issues.push({
        id: `${place.id}-lastreturn`,
        text: `Last service back is ${lastReturn}; with a ${buffer} minute boarding allowance${
          walkMin ? ` and a ${walkMin} minute walk` : ""
        }, the visit must end by ${fromMinutes(mustLeaveBy)}.`,
        severity: "block",
      });
    }
  }

  if (access.oneWay && !access.carEndsAt) {
    issues.push({
      id: `${place.id}-car`,
      text: `This is a one-way journey — where the car ends up is not recorded, so "drive to the hotel" cannot be assumed.`,
      severity: "block",
    });
  }

  if (legs.some((l) => l.bookingRequired === "yes")) {
    issues.push({
      id: `${place.id}-booking`,
      text: `Part of the journey to ${place.name} must be booked in advance.`,
      severity: "warn",
    });
  }

  return issues;
}

/**
 * Whether an excursion suits one traveller's essential needs.
 * A missing record is reported as unverified, never as accessible.
 */
export function suitabilityFor(
  place: Attraction,
  traveller: Traveller,
): { suitable: boolean; unverified: boolean; reason?: string } {
  const essential = (traveller.needs ?? []).filter((n) => n.severity === "hard_limit");
  if (essential.length === 0) return { suitable: true, unverified: false };
  const legs = [...(place.access?.outbound ?? []), ...(place.access?.inbound ?? [])];
  if (legs.length === 0) return { suitable: true, unverified: true };

  const needsStepFree = essential.some((n) => n.type === "step_free");
  if (needsStepFree) {
    const barrier = legs.find((l) => l.stepFree === "unsuitable");
    if (barrier) {
      return {
        suitable: false,
        unverified: false,
        reason: `The ${LEG_MODE_LABEL[barrier.mode].toLowerCase()} leg has confirmed steps, so this journey does not suit everyone travelling.`,
      };
    }
    if (legs.some((l) => l.stepFree === "unknown")) {
      return {
        suitable: true,
        unverified: true,
        reason: "Step-free access on part of this journey is unverified — check with the operator.",
      };
    }
  }
  return { suitable: true, unverified: false };
}
