import { setState } from "./store";
import { actorName, canEditFor, isOrganiser, logAudit, withNotice } from "./governance";
import {
  breakHandlers,
  canManageLogistics,
  checkRoomAssignment,
  checkVehicleAssignment,
  descendantsOf,
  publicBreakLine,
  refLabel,
  SWEEP_CHECKS,
  vehicleOccupants,
  wouldCycle,
} from "./coordination";
import { addTask } from "./actions";
import type {
  BreakRequest,
  BreakType,
  DependencyEdge,
  DependencyRef,
  EmergencyCard,
  KintripState,
  Room,
  TripFeedback,
  Vehicle,
} from "./types";

/**
 * Changes to rooms, vehicles, break requests, dependencies and post-trip
 * answers. Permission and capacity rules are enforced here, so a screen that
 * forgets to hide a control still cannot make an unsafe change.
 *
 * Every function that can refuse returns a plain sentence explaining why,
 * or null when the change went through.
 */

const uid = () => Math.random().toString(36).slice(2, 10);
const now = () => new Date().toISOString();

type Result = string | null;

function guard(
  allowed: (prev: KintripState) => boolean,
  change: (prev: KintripState) => KintripState | string,
): Result {
  const out: { error: string | null } = { error: null };
  setState((prev) => {
    if (!allowed(prev)) {
      out.error = "You do not have permission to make that change.";
      return prev;
    }
    const next = change(prev);
    if (typeof next === "string") {
      out.error = next;
      return prev;
    }
    return next;
  });
  return out.error;
}

/* ---------------- rooms ---------------- */

export function addRoom(input: {
  label: string;
  stayBookingId?: string | undefined;
  fromDate: string;
  toDate: string;
  roomNumber?: string | undefined;
  occupancy?: number | undefined;
  bedCount?: number | undefined;
  note?: string | undefined;
}): Result {
  return guard(canManageLogistics, (prev) => {
    if (!input.label.trim()) return "Give the room a name.";
    if (!(input.fromDate < input.toDate)) return "The checkout date must be after the first night.";
    const room: Room = {
      id: `rm-${uid()}`,
      label: input.label.trim(),
      stayBookingId: input.stayBookingId,
      fromDate: input.fromDate,
      toDate: input.toDate,
      roomNumber: input.roomNumber?.trim() || undefined,
      occupancy: input.occupancy,
      bedCount: input.bedCount,
      bedNotes: [],
      occupantIds: [],
      note: input.note?.trim() || undefined,
      version: 1,
    };
    return logAudit({ ...prev, rooms: [...prev.rooms, room] }, "Room added", room.label);
  });
}

export function removeRoom(roomId: string): Result {
  return guard(canManageLogistics, (prev) => {
    const room = prev.rooms.find((r) => r.id === roomId);
    if (!room) return "That room is no longer here.";
    return logAudit({ ...prev, rooms: prev.rooms.filter((r) => r.id !== roomId) }, "Room removed", room.label);
  });
}

export function assignToRoom(roomId: string, travellerId: string): Result {
  return guard(canManageLogistics, (prev) => {
    const room = prev.rooms.find((r) => r.id === roomId);
    if (!room) return "That room is no longer here.";
    const check = checkRoomAssignment(prev, room, travellerId);
    if (check.error) return check.error;
    const rooms = prev.rooms.map((r) =>
      r.id === roomId
        ? { ...r, occupantIds: [...r.occupantIds, travellerId], version: r.version + 1 }
        : r,
    );
    return logAudit(
      { ...prev, rooms },
      "Room allocation changed",
      `${actorName(prev, travellerId)} → ${room.label}`,
    );
  });
}

export function removeFromRoom(roomId: string, travellerId: string): Result {
  return guard(canManageLogistics, (prev) => {
    const rooms = prev.rooms.map((r) =>
      r.id === roomId
        ? {
            ...r,
            occupantIds: r.occupantIds.filter((id) => id !== travellerId),
            bedNotes: r.bedNotes.map((b) =>
              b.travellerId === travellerId ? { ...b, travellerId: undefined } : b,
            ),
            version: r.version + 1,
          }
        : r,
    );
    return logAudit({ ...prev, rooms }, "Room allocation changed", `${actorName(prev, travellerId)} moved out`);
  });
}

/** Note which bed a person is using — helpful for older travellers. */
export function setBedFor(roomId: string, bedId: string, travellerId: string | undefined): Result {
  return guard(canManageLogistics, (prev) => {
    const rooms = prev.rooms.map((r) =>
      r.id !== roomId
        ? r
        : {
            ...r,
            bedNotes: r.bedNotes.map((b) =>
              b.id === bedId
                ? { ...b, travellerId }
                : b.travellerId && b.travellerId === travellerId
                  ? { ...b, travellerId: undefined }
                  : b,
            ),
            version: r.version + 1,
          },
    );
    return { ...prev, rooms };
  });
}

export function addBedNote(roomId: string, label: string): Result {
  return guard(canManageLogistics, (prev) => {
    if (!label.trim()) return "Describe the bed first.";
    const rooms = prev.rooms.map((r) =>
      r.id === roomId
        ? { ...r, bedNotes: [...r.bedNotes, { id: `bd-${uid()}`, label: label.trim() }] }
        : r,
    );
    return { ...prev, rooms };
  });
}

/* ---------------- vehicles ---------------- */

export function addVehicle(input: {
  label: string;
  segmentId: string;
  fromDate?: string | undefined;
  toDate?: string | undefined;
  driverId?: string | undefined;
  seats?: number | undefined;
  childSeats?: number | undefined;
  luggageNote?: string | undefined;
}): Result {
  return guard(canManageLogistics, (prev) => {
    if (!input.label.trim()) return "Give the vehicle a name.";
    if (!input.segmentId.trim()) return "Say which journey this vehicle is for.";
    const vehicle: Vehicle = {
      id: `vh-${uid()}`,
      label: input.label.trim(),
      segmentId: input.segmentId.trim(),
      fromDate: input.fromDate,
      toDate: input.toDate,
      driverId: input.driverId,
      seats: input.seats,
      childSeats: input.childSeats ?? 0,
      luggageNote: input.luggageNote?.trim() || undefined,
      passengerIds: input.driverId ? [input.driverId] : [],
      version: 1,
    };
    return logAudit({ ...prev, vehicles: [...prev.vehicles, vehicle] }, "Vehicle added", vehicle.label);
  });
}

export function removeVehicle(vehicleId: string): Result {
  return guard(canManageLogistics, (prev) => {
    const v = prev.vehicles.find((x) => x.id === vehicleId);
    if (!v) return "That vehicle is no longer here.";
    return logAudit(
      { ...prev, vehicles: prev.vehicles.filter((x) => x.id !== vehicleId) },
      "Vehicle removed",
      v.label,
    );
  });
}

export function assignToVehicle(vehicleId: string, travellerId: string): Result {
  return guard(canManageLogistics, (prev) => {
    const vehicle = prev.vehicles.find((v) => v.id === vehicleId);
    if (!vehicle) return "That vehicle is no longer here.";
    const check = checkVehicleAssignment(prev, vehicle, travellerId);
    if (check.error) return check.error;
    const vehicles = prev.vehicles.map((v) =>
      v.id === vehicleId
        ? { ...v, passengerIds: [...v.passengerIds, travellerId], version: v.version + 1 }
        : v,
    );
    return logAudit(
      { ...prev, vehicles },
      "Vehicle allocation changed",
      `${actorName(prev, travellerId)} → ${vehicle.label}`,
    );
  });
}

export function removeFromVehicle(vehicleId: string, travellerId: string): Result {
  return guard(canManageLogistics, (prev) => {
    const vehicles = prev.vehicles.map((v) =>
      v.id === vehicleId
        ? {
            ...v,
            passengerIds: v.passengerIds.filter((id) => id !== travellerId),
            driverId: v.driverId === travellerId ? undefined : v.driverId,
            version: v.version + 1,
          }
        : v,
    );
    return { ...prev, vehicles };
  });
}

export function setDriver(vehicleId: string, travellerId: string | undefined): Result {
  return guard(canManageLogistics, (prev) => {
    const vehicle = prev.vehicles.find((v) => v.id === vehicleId);
    if (!vehicle) return "That vehicle is no longer here.";
    if (
      travellerId &&
      typeof vehicle.seats === "number" &&
      !vehicleOccupants(vehicle).includes(travellerId) &&
      vehicleOccupants(vehicle).length + 1 > vehicle.seats
    ) {
      return "There is no free seat for the driver. Free a seat first.";
    }
    const vehicles = prev.vehicles.map((v) =>
      v.id === vehicleId
        ? {
            ...v,
            driverId: travellerId,
            passengerIds:
              travellerId && !v.passengerIds.includes(travellerId)
                ? [...v.passengerIds, travellerId]
                : v.passengerIds,
            version: v.version + 1,
          }
        : v,
    );
    return logAudit({ ...prev, vehicles }, "Driver changed", vehicle.label);
  });
}

/** Add the end-of-stay sweep jobs so nothing is left behind in a room. */
export function addSweepJobs(roomId: string): Result {
  const out: { error: string | null } = { error: null };
  let label = "";
  setState((prev) => {
    if (!canManageLogistics(prev)) {
      out.error = "Only an organiser can add these jobs.";
      return prev;
    }
    const room = prev.rooms.find((r) => r.id === roomId);
    if (!room) {
      out.error = "That room is no longer here.";
      return prev;
    }
    label = room.label;
    return prev;
  });
  if (out.error) return out.error;
  addTask({
    title: `Last look round ${label}`,
    detail: SWEEP_CHECKS.join(" · "),
    visibility: "group",
  });
  return null;
}

/* ---------------- private break requests ---------------- */

export function submitBreakRequest(input: {
  travellerId: string;
  type: BreakType;
  note?: string | undefined;
  rejoinPoint?: string | undefined;
  rejoinTime?: string | undefined;
}): Result {
  return guard(
    (prev) => canEditFor(prev, input.travellerId),
    (prev) => {
      const handlerIds = breakHandlers(prev, input.travellerId);
      if (handlerIds.length === 0) return "There is nobody to send this to yet.";
      const request: BreakRequest = {
        id: `br-${uid()}`,
        travellerId: input.travellerId,
        actorId: prev.activeTravellerId,
        type: input.type,
        note: input.note?.trim() || undefined,
        rejoinPoint: input.rejoinPoint?.trim() || undefined,
        rejoinTime: input.rejoinTime || undefined,
        handlerIds,
        status: "submitted",
        createdAt: now(),
        history: [
          {
            at: now(),
            actorName: actorName(prev, prev.activeTravellerId),
            action:
              prev.activeTravellerId === input.travellerId
                ? "Sent"
                : `Sent for ${actorName(prev, input.travellerId)}`,
          },
        ],
      };
      // Only the handlers are told, and the reason is never repeated.
      return withNotice(
        logAudit(
          { ...prev, breakRequests: [request, ...prev.breakRequests] },
          "Break request sent",
          actorName(prev, input.travellerId),
        ),
        {
          text: `${actorName(prev, input.travellerId)} asked for a change to today. Open Breaks to reply.`,
          audience: "organisers",
        },
      );
    },
  );
}

function updateRequest(
  requestId: string,
  action: string,
  change: (r: BreakRequest, prev: KintripState) => BreakRequest | string,
  handlerOnly = true,
): Result {
  return guard(
    () => true,
    (prev) => {
      const request = prev.breakRequests.find((r) => r.id === requestId);
      if (!request) return "That request is no longer here.";
      const me = prev.activeTravellerId;
      const mayHandle = request.handlerIds.includes(me) || isOrganiser(prev);
      const mine = me === request.travellerId || me === request.actorId;
      if (handlerOnly ? !mayHandle : !(mine || mayHandle)) {
        return "That request is not yours to change.";
      }
      const next = change(request, prev);
      if (typeof next === "string") return next;
      const updated: BreakRequest = {
        ...next,
        history: [...request.history, { at: now(), actorName: actorName(prev, me), action }],
      };
      return logAudit(
        {
          ...prev,
          breakRequests: prev.breakRequests.map((r) => (r.id === requestId ? updated : r)),
        },
        `Break request: ${action.toLowerCase()}`,
        actorName(prev, request.travellerId),
      );
    },
  );
}

export function acknowledgeBreakRequest(requestId: string): Result {
  return updateRequest(requestId, "Acknowledged", (r) =>
    r.status === "cancelled" ? "That request was withdrawn." : { ...r, status: "acknowledged" },
  );
}

export function proposeBreakArrangement(
  requestId: string,
  input: { text: string; checks: string[]; unverified: string[] },
): Result {
  return updateRequest(requestId, "Arrangement suggested", (r, prev) => {
    if (!input.text.trim()) return "Describe the arrangement first.";
    if (r.status === "cancelled") return "That request was withdrawn.";
    return {
      ...r,
      status: "arrangement_proposed",
      proposal: {
        text: input.text.trim(),
        checks: input.checks,
        unverified: input.unverified,
        at: now(),
        by: actorName(prev, prev.activeTravellerId),
        acknowledged: false,
      },
    };
  });
}

/** The traveller (or their carer) confirms the suggested arrangement. */
export function acceptBreakArrangement(requestId: string): Result {
  return updateRequest(
    requestId,
    "Arrangement accepted",
    (r) => {
      if (!r.proposal) return "There is no arrangement to accept yet.";
      return { ...r, proposal: { ...r.proposal, acknowledged: true } };
    },
    false,
  );
}

/** Closing a request publishes only the logistics — never the reason. */
export function resolveBreakRequest(requestId: string, outcome: string, announce: boolean): Result {
  const out: { error: string | null } = { error: null };
  setState((prev) => {
    const request = prev.breakRequests.find((r) => r.id === requestId);
    if (!request) {
      out.error = "That request is no longer here.";
      return prev;
    }
    if (!(request.handlerIds.includes(prev.activeTravellerId) || isOrganiser(prev))) {
      out.error = "Only the people handling this request can close it.";
      return prev;
    }
    const updated: BreakRequest = {
      ...request,
      status: "resolved",
      outcome: outcome.trim() || undefined,
      history: [
        ...request.history,
        { at: now(), actorName: actorName(prev, prev.activeTravellerId), action: "Sorted" },
      ],
    };
    const next = logAudit(
      { ...prev, breakRequests: prev.breakRequests.map((r) => (r.id === requestId ? updated : r)) },
      "Break request sorted",
      actorName(prev, request.travellerId),
    );
    return announce
      ? withNotice(next, { text: publicBreakLine(prev, request), audience: "all" })
      : next;
  });
  return out.error;
}

export function cancelBreakRequest(requestId: string): Result {
  return updateRequest(requestId, "Withdrawn", (r) => ({ ...r, status: "cancelled" }), false);
}

/* ---------------- booking and job dependencies ---------------- */

export function addDependency(input: {
  prerequisite: DependencyRef;
  dependent: DependencyRef;
}): Result {
  return guard(canManageLogistics, (prev) => {
    const { prerequisite, dependent } = input;
    if (prerequisite.kind === dependent.kind && prerequisite.id === dependent.id) {
      return "Something cannot wait for itself.";
    }
    const exists = prev.dependencies.some(
      (e) =>
        e.prerequisite.kind === prerequisite.kind &&
        e.prerequisite.id === prerequisite.id &&
        e.dependent.kind === dependent.kind &&
        e.dependent.id === dependent.id,
    );
    if (exists) return "That link is already recorded.";
    if (wouldCycle(prev.dependencies, prerequisite, dependent)) {
      return "That would make two things wait for each other. Remove the other link first.";
    }
    const edge: DependencyEdge = {
      id: `dp-${uid()}`,
      prerequisite,
      dependent,
      requiredState: prerequisite.kind === "booking" ? "confirmed" : "complete",
      createdAt: now(),
    };
    return logAudit(
      { ...prev, dependencies: [...prev.dependencies, edge] },
      "Dependency added",
      `${refLabel(prev, dependent)} waits for ${refLabel(prev, prerequisite)}`,
    );
  });
}

export function removeDependency(edgeId: string): Result {
  return guard(canManageLogistics, (prev) =>
    logAudit(
      { ...prev, dependencies: prev.dependencies.filter((e) => e.id !== edgeId) },
      "Dependency removed",
      "Link removed",
    ),
  );
}

/** Going ahead anyway is allowed, but it is recorded with a reason. */
export function waiveDependency(edgeId: string, reason: string): Result {
  return guard(canManageLogistics, (prev) => {
    if (!reason.trim()) return "Say why you are going ahead without it.";
    const dependencies = prev.dependencies.map((e) =>
      e.id === edgeId
        ? {
            ...e,
            waivedBy: actorName(prev, prev.activeTravellerId),
            waivedReason: reason.trim(),
            waivedAt: now(),
          }
        : e,
    );
    const edge = prev.dependencies.find((e) => e.id === edgeId);
    return withNotice(
      logAudit(
        { ...prev, dependencies },
        "Dependency waived",
        edge ? `${refLabel(prev, edge.dependent)}: ${reason.trim()}` : reason.trim(),
      ),
      {
        text: edge
          ? `${refLabel(prev, edge.dependent)} is going ahead before ${refLabel(
              prev,
              edge.prerequisite,
            )} is settled.`
          : "A booking is going ahead early.",
        audience: "organisers",
      },
    );
  });
}

/** Warn the group when something other bookings rely on slips. */
export function warnAboutDescendants(ref: DependencyRef): Result {
  return guard(canManageLogistics, (prev) => {
    const affected = descendantsOf(prev, ref);
    if (affected.length === 0) return "Nothing else depends on that.";
    return withNotice(prev, {
      text: `${refLabel(prev, ref)} changed. Check: ${affected
        .map((r) => refLabel(prev, r))
        .join(", ")}.`,
      audience: "organisers",
    });
  });
}

/* ---------------- day notice ---------------- */

export function setDayNotice(dayNumber: number, text: string): Result {
  return guard(canManageLogistics, (prev) => {
    const trimmed = text.trim();
    const others = prev.dayNotices.filter((n) => n.dayNumber !== dayNumber);
    if (!trimmed) return { ...prev, dayNotices: others };
    return logAudit(
      {
        ...prev,
        dayNotices: [
          ...others,
          {
            id: `dn-${uid()}`,
            dayNumber,
            text: trimmed,
            author: actorName(prev, prev.activeTravellerId),
            at: now(),
          },
        ],
      },
      "Day note updated",
      `Day ${dayNumber}`,
    );
  });
}

/* ---------------- contact cards ---------------- */

export function saveEmergencyCard(input: {
  travellerId: string;
  contactName: string;
  contactPhone: string;
  allergyNote?: string | undefined;
  visibility: EmergencyCard["visibility"];
}): Result {
  return guard(
    (prev) => canEditFor(prev, input.travellerId) || canManageLogistics(prev),
    (prev) => {
      if (!input.contactName.trim() || !input.contactPhone.trim()) {
        return "A card needs one name and one phone number.";
      }
      const card: EmergencyCard = {
        travellerId: input.travellerId,
        contactName: input.contactName.trim(),
        contactPhone: input.contactPhone.trim(),
        allergyNote: input.allergyNote?.trim() || undefined,
        visibility: input.visibility,
        updatedAt: now(),
      };
      return logAudit(
        {
          ...prev,
          emergencyCards: [
            ...prev.emergencyCards.filter((c) => c.travellerId !== input.travellerId),
            card,
          ],
        },
        "Contact card saved",
        actorName(prev, input.travellerId),
      );
    },
  );
}

export function removeEmergencyCard(travellerId: string): Result {
  return guard(
    (prev) => canEditFor(prev, travellerId) || canManageLogistics(prev),
    (prev) => ({
      ...prev,
      emergencyCards: prev.emergencyCards.filter((c) => c.travellerId !== travellerId),
    }),
  );
}

/* ---------------- after the trip ---------------- */

export function saveFeedback(input: {
  travellerId: string;
  pace?: TripFeedback["pace"];
  downtime?: TripFeedback["downtime"];
  revisit?: string | undefined;
  sharedWithOrganisers: boolean;
  preferenceApplied: boolean;
}): Result {
  return guard(
    (prev) => canEditFor(prev, input.travellerId),
    (prev) => {
      const entry: TripFeedback = {
        id: `fb-${uid()}`,
        travellerId: input.travellerId,
        authorId: prev.activeTravellerId,
        at: now(),
        pace: input.pace,
        downtime: input.downtime,
        revisit: input.revisit?.trim() || undefined,
        sharedWithOrganisers: input.sharedWithOrganisers,
        preferenceApplied: input.preferenceApplied,
      };
      let travellers = prev.travellers;
      // Only a plain, stated mapping, and only with explicit permission.
      if (input.preferenceApplied && input.pace === "too_much") {
        travellers = prev.travellers.map((t) =>
          t.id === input.travellerId
            ? { ...t, preferences: { ...t.preferences, pace: "relaxed" as const, walking: "low" as const } }
            : t,
        );
      }
      return logAudit(
        {
          ...prev,
          travellers,
          feedback: [
            ...prev.feedback.filter((f) => f.travellerId !== input.travellerId),
            entry,
          ],
        },
        "Trip answers saved",
        actorName(prev, input.travellerId),
      );
    },
  );
}

export function deleteFeedback(travellerId: string): Result {
  return guard(
    (prev) => canEditFor(prev, travellerId),
    (prev) => ({ ...prev, feedback: prev.feedback.filter((f) => f.travellerId !== travellerId) }),
  );
}
