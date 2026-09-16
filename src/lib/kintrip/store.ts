import { useEffect, useSyncExternalStore } from "react";
import { createEmptyTripState, createSeedState } from "./seed";
import { pullTrip, pushTrip } from "./sync.functions";
import type { KintripState } from "./types";

const KEY_V1 = "kintrip.state.v1";
const KEY = "kintrip.state.v2";
const DEMO_TRIP_ID = "tan-japan-2027";

interface MultiTripState {
  activeTripId: string;
  trips: Record<string, KintripState>;
  demoTripId?: string | undefined;
}

function initialMulti(): MultiTripState {
  return { activeTripId: "", trips: {} };
}

const EMPTY_MULTI: MultiTripState = { activeTripId: "", trips: {} };

/**
 * Neutral state rendered on the server and on the very first client render, so
 * the two always match. Real saved trips arrive after hydrate() runs on mount.
 */
const placeholderTrip: KintripState = (() => {
  const base = createEmptyTripState({
    title: "Your trip",
    destination: "",
    startDate: "",
    endDate: "",
    travellerCount: 0,
  });
  return { ...base, trip: { ...base.trip, id: "placeholder" }, travellers: [] };
})();

let multi: MultiTripState = initialMulti();
let ready = false;
let hydrated = false;

const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function persist() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(multi));
  } catch {
    /* storage full or unavailable — the app keeps working in memory */
  }
}

function touchActive() {
  const active = multi.trips[multi.activeTripId];
  if (active) {
    multi.trips[multi.activeTripId] = { ...active, cachedAt: new Date().toISOString() };
  }
}

function loadFromStorage() {
  const raw = window.localStorage.getItem(KEY);
  if (raw) {
    const parsed = JSON.parse(raw) as MultiTripState;
    const activeTrip = parsed?.trips?.[parsed.activeTripId];
    if (parsed?.trips && (activeTrip?.trip?.id || Object.keys(parsed.trips).length === 0)) {
      const isLegacyJapanSample =
        !parsed.demoTripId &&
        Object.keys(parsed.trips).length === 1 &&
        activeTrip?.trip?.id === DEMO_TRIP_ID;
      if (isLegacyJapanSample) {
        multi = initialMulti();
        window.localStorage.removeItem(KEY_V1);
        return;
      }
      multi = { ...parsed, demoTripId: parsed.demoTripId };
      return;
    }
  }
  // migrate the original single-trip cache
  const rawV1 = window.localStorage.getItem(KEY_V1);
  if (rawV1) {
    const parsed = JSON.parse(rawV1) as KintripState;
    if (parsed?.trip?.id === DEMO_TRIP_ID) {
      window.localStorage.removeItem(KEY_V1);
      multi = initialMulti();
      return;
    }
    if (parsed?.trip?.id) {
      multi = {
        activeTripId: parsed.trip.id,
        trips: { [parsed.trip.id]: { ...createSeedState(), ...parsed } },
      };
    }
  }
}

export function hydrate() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  try {
    loadFromStorage();
  } catch {
    /* ignore corrupt cache and show the start screen */
    multi = initialMulti();
  }
  ready = true;
  persist();
  emit();
}


/** Update the currently active trip. */
export function setState(updater: (prev: KintripState) => KintripState) {
  const active = multi.trips[multi.activeTripId];
  if (!active) return;
  multi = {
    ...multi,
    trips: { ...multi.trips, [multi.activeTripId]: updater(active) },
  };
  touchActive();
  persist();
  emit();
}

export interface NewTripInput {
  title: string;
  destination: string;
  startDate: string;
  endDate: string;
  travellerCount: number;
}

/** Create a brand-new trip and make it active. Returns the new trip id. */
export function createNewTrip(input: NewTripInput): string {
  const state = createEmptyTripState(input);
  multi = {
    ...multi,
    activeTripId: state.trip.id,
    trips: { ...multi.trips, [state.trip.id]: state },
  };
  touchActive();
  persist();
  emit();
  return state.trip.id;
}

/** Load the guided demo trip (Tan Family Japan) and make it active. */
export function startDemoTrip(): string {
  const existingId = multi.demoTripId;
  if (existingId && multi.trips[existingId]) {
    multi = { ...multi, activeTripId: existingId };
    persist();
    emit();
    return existingId;
  }
  const seed = createSeedState();
  multi = {
    activeTripId: seed.trip.id,
    trips: { ...multi.trips, [seed.trip.id]: seed },
    demoTripId: seed.trip.id,
  };
  persist();
  emit();
  return seed.trip.id;
}

/** Remove the demo trip and return to the user's own trips. */
export function exitDemoTrip() {
  const demoId = multi.demoTripId;
  if (!demoId) return;
  const trips = { ...multi.trips };
  delete trips[demoId];
  const activeTripId = multi.activeTripId === demoId ? (Object.keys(trips)[0] ?? "") : multi.activeTripId;
  multi = { activeTripId, trips, demoTripId: undefined };
  if (typeof window !== "undefined") window.localStorage.removeItem(KEY_V1);
  persist();
  emit();
}

/** Reset the demo trip back to its original sample data. */
export function resetDemoTrip() {
  const demoId = multi.demoTripId;
  if (!demoId) return;
  const seed = createSeedState();
  const trips = { ...multi.trips };
  delete trips[demoId];
  multi = {
    activeTripId: seed.trip.id,
    trips: { ...trips, [seed.trip.id]: seed },
    demoTripId: seed.trip.id,
  };
  persist();
  emit();
}

export function switchTrip(tripId: string) {
  if (!multi.trips[tripId] || tripId === multi.activeTripId) return;
  multi = { ...multi, activeTripId: tripId };
  persist();
  emit();
}

export function deleteTrip(tripId: string) {
  if (!multi.trips[tripId]) return;
  const trips = { ...multi.trips };
  delete trips[tripId];
  let activeTripId = multi.activeTripId;
  if (activeTripId === tripId) activeTripId = Object.keys(trips)[0] ?? "";
  multi = {
    activeTripId,
    trips,
    demoTripId: multi.demoTripId === tripId ? undefined : multi.demoTripId,
  };
  persist();
  emit();
}

export function resetState() {
  multi = { activeTripId: "", trips: {} };
  persist();
  emit();
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

const getActiveSnapshot = (): KintripState =>
  ready ? (multi.trips[multi.activeTripId] ?? placeholderTrip) : placeholderTrip;
const getServerActiveSnapshot = (): KintripState => placeholderTrip;
const getMultiSnapshot = (): MultiTripState => (ready ? multi : EMPTY_MULTI);
const getServerMultiSnapshot = (): MultiTripState => EMPTY_MULTI;

/** The active trip's full state. */
export function useKintrip() {
  useEffect(() => {
    hydrate();
  }, []);
  return useSyncExternalStore(subscribe, getActiveSnapshot, getServerActiveSnapshot);
}


export interface TripSummary {
  id: string;
  title: string;
  destination: string;
  startDate: string;
  endDate: string;
  status: KintripState["trip"]["status"];
  travellerCount: number;
  joined: number;
  hasItinerary: boolean;
  active: boolean;
  isDemo: boolean;
}

export function useTripSetupStatus() {
  useEffect(() => {
    hydrate();
  }, []);
  const m = useSyncExternalStore(subscribe, getMultiSnapshot, getServerMultiSnapshot);
  return {
    hasTrips: Object.keys(m.trips).length > 0,
    demoActive: !!m.demoTripId && m.demoTripId === m.activeTripId,
    hasDemo: !!m.demoTripId && !!m.trips[m.demoTripId],
  };
}

/** Summaries of every trip on this device, for the My Trips screen. */
export function useTripList(): TripSummary[] {
  useEffect(() => {
    hydrate();
  }, []);
  const m = useSyncExternalStore(subscribe, getMultiSnapshot, getServerMultiSnapshot);
  return Object.values(m.trips).map((s) => ({
    id: s.trip.id,
    title: s.trip.title,
    destination: s.trip.destination,
    startDate: s.trip.startDate,
    endDate: s.trip.endDate,
    status: s.trip.status,
    travellerCount: s.trip.travellerCount,
    joined: s.travellers.filter((t) => t.joined).length,
    hasItinerary: s.itinerary !== null,
    active: s.trip.id === m.activeTripId,
    isDemo: s.trip.id === m.demoTripId,
  }));
}

export function useOnline() {
  return useSyncExternalStore(
    (cb) => {
      window.addEventListener("online", cb);
      window.addEventListener("offline", cb);
      return () => {
        window.removeEventListener("online", cb);
        window.removeEventListener("offline", cb);
      };
    },
    () => (typeof navigator === "undefined" ? true : navigator.onLine),
    () => true,
  );
}
