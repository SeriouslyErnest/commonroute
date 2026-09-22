import { maySeeRoomNumber, visibleEmergencyCards } from "./coordination";
import type { KintripState } from "./types";

/**
 * Saving a couple of days to this device so they open without a connection.
 *
 * The pack is device-local: nothing about it is sent anywhere, and no record
 * is kept of who saved what. Saving is only reported as done after the stored
 * bytes are read back and checked, not merely because writing did not throw.
 * Private break notes, hidden notes and room numbers the viewer may not see
 * are never written into the pack.
 */

const KEY = "commonroute.offlinePack.v1";

export type ItemState = "saved" | "missing" | "not_available";

export interface ManifestItem {
  id: string;
  label: string;
  state: ItemState;
  detail?: string | undefined;
}

export interface OfflinePack {
  tripId: string;
  tripName: string;
  planVersion: number;
  savedAt: string;
  dates: string[];
  days: unknown[];
  stays: unknown[];
  rooms: unknown[];
  vehicles: unknown[];
  contacts: unknown[];
  notices: unknown[];
  manifest: ManifestItem[];
  checksum: string;
}

function checksum(input: string) {
  let h = 5381;
  for (let i = 0; i < input.length; i += 1) h = ((h << 5) + h + input.charCodeAt(i)) | 0;
  return (h >>> 0).toString(16);
}

/** The next two days of the published plan, by default. */
export function defaultDates(state: KintripState) {
  const days = state.itinerary?.days ?? [];
  const todayKey = new Date().toISOString().slice(0, 10);
  const from = days.findIndex((d) => d.date >= todayKey);
  const start = from === -1 ? 0 : from;
  return days.slice(start, start + 2).map((d) => d.date);
}

export function buildPack(state: KintripState, dates: string[]): OfflinePack {
  const published = state.itinerary?.published ? state.itinerary : null;
  const days = (published?.days ?? []).filter((d) => dates.includes(d.date));

  const stays = state.bookings
    .filter((b) => b.type === "stay" && b.status !== "cancelled")
    .map((b) => ({
      title: b.title,
      location: b.location,
      addressLocal: b.addressLocal,
      addressTranslated: b.addressTranslated,
      contact: b.contact,
    }));

  const rooms = state.rooms.map((r) => ({
    label: r.label,
    fromDate: r.fromDate,
    toDate: r.toDate,
    // Exact room numbers only travel into the pack when this device may see them.
    roomNumber: maySeeRoomNumber(state, r) ? r.roomNumber : undefined,
    occupants: r.occupantIds.map((id) => state.travellers.find((t) => t.id === id)?.name ?? ""),
  }));

  const vehicles = state.vehicles.map((v) => ({
    label: v.label,
    segmentId: v.segmentId,
    driver: state.travellers.find((t) => t.id === v.driverId)?.name,
    passengers: v.passengerIds.map((id) => state.travellers.find((t) => t.id === id)?.name ?? ""),
  }));

  const contacts = visibleEmergencyCards(state).map((c) => ({
    traveller: state.travellers.find((t) => t.id === c.travellerId)?.name ?? "",
    contactName: c.contactName,
    contactPhone: c.contactPhone,
    allergyNote: c.allergyNote,
  }));

  const notices = state.dayNotices
    .filter((n) => days.some((d) => d.day === n.dayNumber))
    .map((n) => ({ dayNumber: n.dayNumber, text: n.text, author: n.author }));

  const manifest: ManifestItem[] = [
    {
      id: "plan",
      label: "The plan for the days you chose",
      state: days.length > 0 ? "saved" : published ? "missing" : "not_available",
      detail: published ? undefined : "The plan has not been shared with the group yet.",
    },
    {
      id: "stay",
      label: "Where you are staying, with the address in local script",
      state: stays.length > 0 ? "saved" : "missing",
    },
    { id: "rooms", label: "Rooms and vehicles", state: rooms.length + vehicles.length > 0 ? "saved" : "missing" },
    { id: "contacts", label: "Contact cards", state: contacts.length > 0 ? "saved" : "missing" },
    {
      id: "documents",
      label: "Booking documents and tickets",
      state: "not_available",
      detail: "CommonRoute does not store documents. Save them in your own files app.",
    },
    {
      id: "maps",
      label: "Maps and directions",
      state: "not_available",
      detail: "Map links need a connection. Save the area in your maps app as well.",
    },
  ];

  const pack: OfflinePack = {
    tripId: state.trip.id,
    tripName: state.trip.title,
    planVersion: published?.version ?? 0,
    savedAt: new Date().toISOString(),
    dates,
    days,
    stays,
    rooms,
    vehicles,
    contacts,
    notices,
    manifest,
    checksum: "",
  };
  pack.checksum = checksum(JSON.stringify({ ...pack, checksum: "" }));
  return pack;
}

export interface SaveResult {
  ok: boolean;
  pack?: OfflinePack | undefined;
  error?: string | undefined;
}

/** Write the pack, then read it back and check it before calling it saved. */
export function savePack(pack: OfflinePack): SaveResult {
  if (typeof window === "undefined") return { ok: false, error: "This only works in a browser." };
  try {
    window.localStorage.setItem(KEY, JSON.stringify(pack));
  } catch {
    return {
      ok: false,
      error: "This device would not store the days. Free some space and try again.",
    };
  }
  const raw = window.localStorage.getItem(KEY);
  if (!raw) return { ok: false, error: "Nothing was stored. Nothing is saved on this device." };
  let parsed: OfflinePack;
  try {
    parsed = JSON.parse(raw) as OfflinePack;
  } catch {
    return { ok: false, error: "What was stored could not be read back. Nothing is saved." };
  }
  const check = checksum(JSON.stringify({ ...parsed, checksum: "" }));
  if (check !== parsed.checksum) {
    window.localStorage.removeItem(KEY);
    return { ok: false, error: "The saved copy did not match. Nothing is saved on this device." };
  }
  return { ok: true, pack: parsed };
}

export function loadPack(): OfflinePack | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as OfflinePack;
    const check = checksum(JSON.stringify({ ...parsed, checksum: "" }));
    return check === parsed.checksum ? parsed : null;
  } catch {
    return null;
  }
}

export function removePack() {
  if (typeof window !== "undefined") window.localStorage.removeItem(KEY);
}

/** Roughly how much space the saved days take, for the person's reassurance. */
export function packSizeKb(pack: OfflinePack) {
  return Math.max(1, Math.round(JSON.stringify(pack).length / 1024));
}
