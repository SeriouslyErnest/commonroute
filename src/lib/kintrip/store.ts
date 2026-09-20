import { useEffect, useSyncExternalStore } from "react";
import { createEmptyTripState, createSeedState } from "./seed";
import { pullTrip, pushTrip } from "./sync.functions";
import { normalizeState } from "./governance";
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
  return normalizeState({ ...base, trip: { ...base.trip, id: "placeholder" }, travellers: [] });
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
      const trips: Record<string, KintripState> = {};
      for (const [id, trip] of Object.entries(parsed.trips)) trips[id] = normalizeState(trip);
      multi = { ...parsed, trips, demoTripId: parsed.demoTripId };
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
        trips: { [parsed.trip.id]: normalizeState({ ...createSeedState(), ...parsed }) },
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
  schedulePush(multi.activeTripId);
}

/* ---------------- shared backend sync ---------------- */

export type SyncStatus = "off" | "synced" | "saving" | "offline" | "error";

let syncStatus: SyncStatus = "off";
let pushTimer: ReturnType<typeof setTimeout> | null = null;

function setSyncStatus(next: SyncStatus) {
  if (syncStatus === next) return;
  syncStatus = next;
  emit();
}

/**
 * The invite code is the only secret protecting a shared trip, so it must be
 * unguessable: 10 characters from a 32-symbol alphabet (~50 bits) drawn from
 * the platform CSPRNG rather than Math.random().
 */
function makeShareCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const length = 10;
  const bytes = new Uint8Array(length);
  const cryptoObj = typeof globalThis !== "undefined" ? globalThis.crypto : undefined;
  if (cryptoObj?.getRandomValues) {
    cryptoObj.getRandomValues(bytes);
  } else {
    for (let i = 0; i < length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  }
  let out = "";
  for (let i = 0; i < length; i += 1) out += alphabet[bytes[i]! % alphabet.length];
  return out;
}

/** Trips synced to the shared backend: everything except the local demo trip. */
function syncableTrip(tripId: string): KintripState | null {
  if (!tripId || tripId === multi.demoTripId) return null;
  const state = multi.trips[tripId];
  if (!state?.trip?.shareCode) return null;
  return state;
}

function schedulePush(tripId: string) {
  if (typeof window === "undefined") return;
  if (!syncableTrip(tripId)) return;
  if (pushTimer) clearTimeout(pushTimer);
  setSyncStatus("saving");
  pushTimer = setTimeout(() => {
    void pushNow(tripId);
  }, 900);
}

async function pushNow(tripId: string) {
  const state = syncableTrip(tripId);
  if (!state) return;
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    setSyncStatus("offline");
    return;
  }
  try {
    await pushTrip({
      data: { tripId, shareCode: state.trip.shareCode!, state },
    });
    setSyncStatus("synced");
  } catch {
    setSyncStatus("error");
  }
}

/** Pull the latest version of a trip saved by another family member. */
export async function pullActiveTrip() {
  const tripId = multi.activeTripId;
  const state = syncableTrip(tripId);
  if (!state) return;
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    setSyncStatus("offline");
    return;
  }
  try {
    const remote = await pullTrip({ data: { shareCode: state.trip.shareCode! } });
    if (!remote) {
      await pushNow(tripId);
      return;
    }
    const local = multi.trips[tripId];
    const remoteAt = remote.state?.cachedAt ?? "";
    const localAt = local?.cachedAt ?? "";
    if (local && remoteAt && remoteAt > localAt) {
      multi = { ...multi, trips: { ...multi.trips, [tripId]: normalizeState(remote.state) } };
      persist();
      emit();
    } else if (local && localAt > remoteAt) {
      await pushNow(tripId);
    }
    setSyncStatus("synced");
  } catch {
    setSyncStatus("error");
  }
}

/** Open a trip shared by an organiser's invite link. */
export async function joinTripByCode(code: string): Promise<string | null> {
  hydrate();
  const remote = await pullTrip({ data: { shareCode: code.trim().toUpperCase() } });
  if (!remote) return null;
  multi = {
    ...multi,
    activeTripId: remote.tripId,
    trips: { ...multi.trips, [remote.tripId]: normalizeState(remote.state) },
  };
  persist();
  emit();
  setSyncStatus("synced");
  void registerTripMembership(remote.tripId);
  return remote.tripId;
}

/* ---------------- account-linked trips ---------------- */

function membershipPayload(tripId: string) {
  const state = syncableTrip(tripId);
  if (!state) return null;
  return {
    tripId,
    shareCode: state.trip.shareCode!,
    title: state.trip.title,
    destination: state.trip.destination,
  };
}

async function signedIn(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  const { supabase } = await import("@/integrations/supabase/client");
  const { data } = await supabase.auth.getSession();
  return !!data.session;
}

/** Remember a trip against the signed-in account, if there is one. */
export async function registerTripMembership(tripId: string) {
  const payload = membershipPayload(tripId);
  if (!payload) return;
  try {
    if (!(await signedIn())) return;
    const { saveMemberships } = await import("./account.functions");
    await saveMemberships({ data: { trips: [payload] } });
  } catch {
    /* membership is a convenience — never block planning on it */
  }
}

/**
 * Called when someone signs in: uploads the trips already on this device and
 * brings down any trips saved against their account from other devices.
 */
export async function linkAccountTrips() {
  hydrate();
  try {
    const local = Object.keys(multi.trips)
      .map(membershipPayload)
      .filter((t): t is NonNullable<ReturnType<typeof membershipPayload>> => !!t);
    const { saveMemberships, listMemberships } = await import("./account.functions");
    if (local.length) await saveMemberships({ data: { trips: local } });
    const rows = await listMemberships();
    let added = false;
    for (const row of rows) {
      if (multi.trips[row.tripId]) continue;
      const remote = await pullTrip({ data: { shareCode: row.shareCode } });
      if (!remote) continue;
      multi = {
        ...multi,
        trips: { ...multi.trips, [remote.tripId]: normalizeState(remote.state) },
      };
      if (!multi.activeTripId) multi = { ...multi, activeTripId: remote.tripId };
      added = true;
    }
    if (added) {
      persist();
      emit();
    }
  } catch {
    /* offline or not signed in — local trips keep working */
  }
}

/** Live sync for the active trip: pushes local edits, polls for family updates. */
export function useTripSync() {
  useEffect(() => {
    hydrate();
    void pullActiveTrip();
    const id = setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
      void pullActiveTrip();
    }, 8000);
    const onFocus = () => void pullActiveTrip();
    window.addEventListener("focus", onFocus);
    window.addEventListener("online", onFocus);
    return () => {
      clearInterval(id);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("online", onFocus);
    };
  }, []);
  return useSyncExternalStore(
    subscribe,
    () => syncStatus,
    () => "off" as SyncStatus,
  );
}

/** The invite code for the active trip, if it is shared online. */
export function useShareCode(): string | null {
  const state = useKintrip();
  return state.trip.shareCode ?? null;
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
  const base = createEmptyTripState(input);
  const state: KintripState = {
    ...base,
    trip: { ...base.trip, shareCode: makeShareCode() },
    cachedAt: new Date().toISOString(),
  };
  multi = {
    ...multi,
    activeTripId: state.trip.id,
    trips: { ...multi.trips, [state.trip.id]: state },
  };
  touchActive();
  persist();
  emit();
  void pushNow(state.trip.id);
  void registerTripMembership(state.trip.id);
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
