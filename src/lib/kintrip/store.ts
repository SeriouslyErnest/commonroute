import { useEffect, useSyncExternalStore } from "react";
import { createEmptyTripState, createSeedState } from "./seed";
import type { KintripState } from "./types";

const KEY_V1 = "kintrip.state.v1";
const KEY = "kintrip.state.v2";
const SETUP_BACKUP_KEY = "kintrip.setup-test.backup.v1";

interface MultiTripState {
  activeTripId: string;
  trips: Record<string, KintripState>;
  setupTestActive?: boolean;
}

function initialMulti(): MultiTripState {
  const seed = createSeedState();
  return { activeTripId: seed.trip.id, trips: { [seed.trip.id]: seed } };
}

let multi: MultiTripState = initialMulti();
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

export function hydrate() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as MultiTripState;
      const activeTrip = parsed?.trips?.[parsed.activeTripId];
      if (parsed?.trips && (activeTrip?.trip?.id || Object.keys(parsed.trips).length === 0)) {
        multi = { ...parsed, setupTestActive: parsed.setupTestActive ?? false };
        emit();
        return;
      }
    }
    // migrate the original single-trip cache
    const rawV1 = window.localStorage.getItem(KEY_V1);
    if (rawV1) {
      const parsed = JSON.parse(rawV1) as KintripState;
      if (parsed?.trip?.id) {
        multi = {
          activeTripId: parsed.trip.id,
          trips: { [parsed.trip.id]: { ...createSeedState(), ...parsed } },
        };
        persist();
        emit();
        return;
      }
    }
  } catch {
    /* ignore corrupt cache and fall back to the sample trip */
  }
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
  let existingTrips = multi.trips;
  if (multi.setupTestActive && typeof window !== "undefined") {
    try {
      const raw = window.localStorage.getItem(SETUP_BACKUP_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as MultiTripState;
        existingTrips = saved.trips ?? existingTrips;
        window.localStorage.removeItem(SETUP_BACKUP_KEY);
      }
    } catch {
      /* keep the new trip when a test backup cannot be read */
    }
  }
  multi = {
    activeTripId: state.trip.id,
    trips: { ...existingTrips, [state.trip.id]: state },
    setupTestActive: false,
  };
  touchActive();
  persist();
  emit();
  return state.trip.id;
}

/** Temporarily put saved trips aside so the first-time setup can be tested safely. */
export function startFirstTimeSetupTest() {
  if (typeof window === "undefined" || Object.keys(multi.trips).length === 0) return;
  try {
    window.localStorage.setItem(SETUP_BACKUP_KEY, JSON.stringify(multi));
  } catch {
    return;
  }
  multi = { activeTripId: "", trips: {}, setupTestActive: true };
  persist();
  emit();
}

export function restoreTripsAfterSetupTest(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = window.localStorage.getItem(SETUP_BACKUP_KEY);
    if (!raw) return false;
    const saved = JSON.parse(raw) as MultiTripState;
    const active = saved.trips?.[saved.activeTripId];
    if (!active?.trip?.id) return false;
    multi = { ...saved, setupTestActive: false };
    window.localStorage.removeItem(SETUP_BACKUP_KEY);
    persist();
    emit();
    return true;
  } catch {
    return false;
  }
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
  if (activeTripId === tripId) {
    activeTripId = Object.keys(trips)[0] ?? "";
    if (!activeTripId) {
      // never leave the app empty — fall back to the sample trip
      return;
    }
  }
  multi = { activeTripId, trips };
  persist();
  emit();
}

export function resetState() {
  const seed = createSeedState();
  multi = { activeTripId: seed.trip.id, trips: { [seed.trip.id]: seed } };
  persist();
  emit();
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

const getActiveSnapshot = () => multi.trips[multi.activeTripId]!;
const getMultiSnapshot = () => multi;

/** The active trip's full state. */
export function useKintrip() {
  useEffect(() => {
    hydrate();
  }, []);
  return useSyncExternalStore(subscribe, getActiveSnapshot, getActiveSnapshot);
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
}

export function useTripSetupStatus() {
  useEffect(() => {
    hydrate();
  }, []);
  const m = useSyncExternalStore(subscribe, getMultiSnapshot, getMultiSnapshot);
  return {
    hasTrips: Object.keys(m.trips).length > 0,
    setupTestActive: m.setupTestActive === true,
  };
}

/** Summaries of every trip on this device, for the My Trips screen. */
export function useTripList(): TripSummary[] {
  useEffect(() => {
    hydrate();
  }, []);
  const m = useSyncExternalStore(subscribe, getMultiSnapshot, getMultiSnapshot);
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
