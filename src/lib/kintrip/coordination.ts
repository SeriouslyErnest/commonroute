import { isOrganiser, isOwner, managerOf } from "./governance";
import type {
  BreakRequest,
  DependencyEdge,
  DependencyRef,
  EmergencyCard,
  KintripState,
  Room,
  Vehicle,
} from "./types";

/**
 * Rooms, vehicles, private break requests and booking dependencies.
 *
 * Pure reading and checking only — every rule here is also applied in the
 * action layer, so hiding a control in a screen is never the protection.
 * Nothing is inferred: unknown capacity stays unknown rather than guessed,
 * and a person's location is never deduced from a break request.
 */

/* ---------------- dates ---------------- */

/** Ranges are end-exclusive: a room freed on the 24th is free on the 24th. */
export function rangesOverlap(aFrom: string, aTo: string, bFrom: string, bTo: string) {
  return aFrom < bTo && bFrom < aTo;
}

/* ---------------- people and permissions ---------------- */

export function canManageLogistics(state: KintripState) {
  return isOrganiser(state) || isOwner(state);
}

/** Rooms and vehicles a person may see in full: their own and their dependants'. */
export function seesOwnAllocation(state: KintripState, travellerId: string) {
  const me = state.activeTravellerId;
  if (travellerId === me) return true;
  const manager = managerOf(state, travellerId);
  return manager?.id === me;
}

/** Exact room numbers are for occupants, their carers and organisers only. */
export function maySeeRoomNumber(state: KintripState, room: Room) {
  if (canManageLogistics(state)) return true;
  return room.occupantIds.some((id) => seesOwnAllocation(state, id));
}

/** A dependant must travel with the named adult — never assumed from age. */
export function accompanyingAdultId(state: KintripState, travellerId: string) {
  const t = state.travellers.find((x) => x.id === travellerId);
  if (!t?.responsibleAdultId) return undefined;
  return t.responsibleAdultId;
}

/* ---------------- room checks ---------------- */

export interface AllocationCheck {
  /** Blocks the change. */
  error?: string | undefined;
  /** Allowed, but the group should know. */
  warnings: string[];
}

export function checkRoomAssignment(
  state: KintripState,
  room: Room,
  travellerId: string,
): AllocationCheck {
  const warnings: string[] = [];
  if (room.occupantIds.includes(travellerId)) {
    return { error: "That person is already in this room.", warnings };
  }
  if (typeof room.occupancy === "number") {
    if (room.occupantIds.length + 1 > room.occupancy) {
      return {
        error: `This room is allowed ${room.occupancy} ${
          room.occupancy === 1 ? "person" : "people"
        }. Free a place first or change the permitted number.`,
        warnings,
      };
    }
  } else {
    warnings.push("The permitted number of people in this room has not been confirmed.");
  }

  const clash = state.rooms.find(
    (r) =>
      r.id !== room.id &&
      r.occupantIds.includes(travellerId) &&
      rangesOverlap(r.fromDate, r.toDate, room.fromDate, room.toDate),
  );
  if (clash) {
    return {
      error: `That person is already in "${clash.label}" for overlapping nights.`,
      warnings,
    };
  }

  const adultId = accompanyingAdultId(state, travellerId);
  if (adultId && !room.occupantIds.includes(adultId)) {
    const adult = state.travellers.find((t) => t.id === adultId);
    return {
      error: `${
        state.travellers.find((t) => t.id === travellerId)?.name ?? "This traveller"
      } must share a room with ${adult?.name ?? "their named adult"}. Put that adult in the room first.`,
      warnings,
    };
  }

  if (typeof room.bedCount === "number" && room.occupantIds.length + 1 > room.bedCount) {
    warnings.push("There are more people than beds — someone needs an extra bed or futon.");
  }
  return { warnings };
}

/* ---------------- vehicle checks ---------------- */

export function vehicleOccupants(vehicle: Vehicle) {
  const ids = [...vehicle.passengerIds];
  if (vehicle.driverId && !ids.includes(vehicle.driverId)) ids.push(vehicle.driverId);
  return ids;
}

export function checkVehicleAssignment(
  state: KintripState,
  vehicle: Vehicle,
  travellerId: string,
): AllocationCheck {
  const warnings: string[] = [];
  const current = vehicleOccupants(vehicle);
  if (current.includes(travellerId)) {
    return { error: "That person is already in this vehicle.", warnings };
  }
  if (typeof vehicle.seats === "number") {
    if (current.length + 1 > vehicle.seats) {
      return {
        error: `This vehicle has ${vehicle.seats} seats including the driver. Free a seat first.`,
        warnings,
      };
    }
  } else {
    warnings.push("The number of seats has not been confirmed.");
  }

  const clash = state.vehicles.find(
    (v) =>
      v.id !== vehicle.id &&
      v.segmentId === vehicle.segmentId &&
      vehicleOccupants(v).includes(travellerId),
  );
  if (clash) {
    return { error: `That person is already in "${clash.label}" for this journey.`, warnings };
  }

  const adultId = accompanyingAdultId(state, travellerId);
  if (adultId && !current.includes(adultId)) {
    const adult = state.travellers.find((t) => t.id === adultId);
    return {
      error: `${
        state.travellers.find((t) => t.id === travellerId)?.name ?? "This traveller"
      } must travel with ${adult?.name ?? "their named adult"}. Put that adult in the vehicle first.`,
      warnings,
    };
  }
  return { warnings };
}

/** Things the group should know before relying on a vehicle. */
export function vehicleWarnings(state: KintripState, vehicle: Vehicle) {
  const out: string[] = [];
  if (!vehicle.driverId) out.push("No driver has been named for this vehicle.");
  if (typeof vehicle.seats !== "number") out.push("The number of seats has not been confirmed.");
  const needChildSeat = vehicleOccupants(vehicle).filter((id) => {
    const t = state.travellers.find((x) => x.id === id);
    return t?.ageGroup === "child" || t?.ageGroup === "toddler";
  }).length;
  if (needChildSeat > vehicle.childSeats) {
    out.push(
      `${needChildSeat} ${needChildSeat === 1 ? "child needs" : "children need"} a child seat and ${
        vehicle.childSeats
      } ${vehicle.childSeats === 1 ? "is" : "are"} recorded.`,
    );
  }
  return out;
}

/** Anyone in the trip who is not in a room for the nights that room covers. */
export function unhousedTravellers(state: KintripState) {
  const housed = new Set(state.rooms.flatMap((r) => r.occupantIds));
  return state.rooms.length === 0 ? [] : state.travellers.filter((t) => !housed.has(t.id));
}

/* ---------------- private break requests ---------------- */

/** Who will see a break request: organisers, plus the traveller's named adult. */
export function breakHandlers(state: KintripState, travellerId: string) {
  const ids = new Set<string>();
  state.travellers.forEach((t) => {
    if (t.role === "organiser" || (t.roles ?? []).includes("organiser")) ids.add(t.id);
  });
  const adult = accompanyingAdultId(state, travellerId);
  if (adult) ids.add(adult);
  ids.delete(travellerId);
  return [...ids];
}

/** The private note is for the requester, their carer and the named handlers only. */
export function maySeeBreakNote(state: KintripState, request: BreakRequest) {
  const me = state.activeTravellerId;
  if (me === request.travellerId || me === request.actorId) return true;
  if (request.handlerIds.includes(me)) return true;
  return managerOf(state, request.travellerId)?.id === me;
}

export function visibleBreakRequests(state: KintripState) {
  return state.breakRequests.filter((r) => maySeeBreakNote(state, r));
}

export const BREAK_LABEL: Record<BreakRequest["type"], string> = {
  rest: "Needs a rest",
  skip_next: "Would rather skip the next stop",
  join_later: "Will join the group later",
};

export const BREAK_STATUS_LABEL: Record<BreakRequest["status"], string> = {
  submitted: "Sent",
  acknowledged: "Seen by an organiser",
  arrangement_proposed: "Arrangement suggested",
  resolved: "Sorted",
  cancelled: "Withdrawn",
};

/**
 * What the rest of the group is told: the logistics only, never the reason.
 */
export function publicBreakLine(state: KintripState, request: BreakRequest) {
  const name = state.travellers.find((t) => t.id === request.travellerId)?.name ?? "Someone";
  if (request.rejoinPoint && request.rejoinTime) {
    return `${name} rejoins the group at ${request.rejoinPoint} at ${request.rejoinTime}.`;
  }
  if (request.type === "skip_next") return `${name} is not joining the next stop.`;
  return `${name} is taking a break from the group.`;
}

/* ---------------- booking and job dependencies ---------------- */

export function refLabel(state: KintripState, ref: DependencyRef) {
  if (ref.kind === "booking") {
    return state.bookings.find((b) => b.id === ref.id)?.title ?? "Removed booking";
  }
  return state.tasks.find((t) => t.id === ref.id)?.title ?? "Removed job";
}

export function refSatisfied(state: KintripState, edge: DependencyEdge) {
  if (edge.waivedBy) return true;
  const { prerequisite } = edge;
  if (prerequisite.kind === "booking") {
    const b = state.bookings.find((x) => x.id === prerequisite.id);
    if (!b) return false;
    return b.status === "confirmed";
  }
  const t = state.tasks.find((x) => x.id === prerequisite.id);
  if (!t) return false;
  return t.state === "complete";
}

export type DependencyState = "ready" | "blocked" | "at_risk";

/**
 * A dependent item is blocked while an unmet prerequisite remains and the
 * item itself is not yet booked; once it is confirmed it becomes "at risk",
 * because nothing is ever cancelled automatically.
 */
export function dependencyStateFor(state: KintripState, ref: DependencyRef): {
  state: DependencyState;
  unmet: DependencyEdge[];
} {
  const edges = state.dependencies.filter(
    (e) => e.dependent.kind === ref.kind && e.dependent.id === ref.id,
  );
  const unmet = edges.filter((e) => !refSatisfied(state, e));
  if (unmet.length === 0) return { state: "ready", unmet };
  const confirmed =
    ref.kind === "booking"
      ? state.bookings.find((b) => b.id === ref.id)?.status === "confirmed"
      : state.tasks.find((t) => t.id === ref.id)?.state === "complete";
  return { state: confirmed ? "at_risk" : "blocked", unmet };
}

const sameRef = (a: DependencyRef, b: DependencyRef) => a.kind === b.kind && a.id === b.id;

/** A new link is refused if it would let an item wait on itself, directly or not. */
export function wouldCycle(
  edges: DependencyEdge[],
  prerequisite: DependencyRef,
  dependent: DependencyRef,
) {
  if (sameRef(prerequisite, dependent)) return true;
  const seen: DependencyRef[] = [];
  const walk = (node: DependencyRef): boolean => {
    if (sameRef(node, dependent)) return true;
    if (seen.some((s) => sameRef(s, node))) return false;
    seen.push(node);
    return edges
      .filter((e) => sameRef(e.dependent, node))
      .some((e) => walk(e.prerequisite));
  };
  return walk(prerequisite);
}

/** Everything that waits, directly or indirectly, on this item. */
export function descendantsOf(state: KintripState, ref: DependencyRef): DependencyRef[] {
  const out: DependencyRef[] = [];
  const walk = (node: DependencyRef) => {
    state.dependencies
      .filter((e) => sameRef(e.prerequisite, node))
      .forEach((e) => {
        if (out.some((r) => sameRef(r, e.dependent))) return;
        out.push(e.dependent);
        walk(e.dependent);
      });
  };
  walk(ref);
  return out;
}

/* ---------------- contact cards ---------------- */

export function visibleEmergencyCards(state: KintripState): EmergencyCard[] {
  return state.emergencyCards.filter(
    (c) =>
      c.visibility === "group" ||
      canManageLogistics(state) ||
      seesOwnAllocation(state, c.travellerId),
  );
}

/* ---------------- end-of-stay sweep ---------------- */

export const SWEEP_CHECKS = [
  "Look under every bed and behind the curtains",
  "Empty the safe and the fridge",
  "Collect chargers from every socket",
  "Check the bathroom shelf and the back of the door",
];
