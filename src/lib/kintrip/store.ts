import { useEffect, useSyncExternalStore } from "react";
import { createSeedState } from "./seed";
import type { KintripState } from "./types";

const KEY = "kintrip.state.v1";

let state: KintripState = createSeedState();
let hydrated = false;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function persist() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      KEY,
      JSON.stringify({ ...state, cachedAt: new Date().toISOString() }),
    );
  } catch {
    /* storage full or unavailable — the app keeps working in memory */
  }
}

export function hydrate() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as KintripState;
      if (parsed?.trip?.id) {
        state = { ...createSeedState(), ...parsed };
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

export function setState(updater: (prev: KintripState) => KintripState) {
  state = updater(state);
  state = { ...state, cachedAt: new Date().toISOString() };
  persist();
  emit();
}

export function resetState() {
  state = createSeedState();
  persist();
  emit();
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

const getSnapshot = () => state;

export function useKintrip() {
  useEffect(() => {
    hydrate();
  }, []);
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
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
