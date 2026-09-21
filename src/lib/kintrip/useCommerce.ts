import { useCallback, useEffect, useState } from "react";
import { useKintrip } from "./store";
import {
  getTripCommerce,
  reserveAdvancedJob,
  finishAdvancedJob,
  type TripCommerce,
} from "./commerce.functions";
import type { FeatureCode } from "./offers";

/**
 * Entitlement state for the active trip. Remixed from the original Kintrip
 * project.
 *
 * The Japan demo is local-only, so it never asks the server anything: advanced
 * tools run there as a showcase with no allowance and no account link.
 */

const DEMO_TRIP_ID = "tan-japan-2027";

export const DEMO_COMMERCE: TripCommerce = {
  offerCode: "demo",
  features: ["compare_bases", "scenarios", "cost_replan"],
  expiresAt: null,
  jobsUsed: 0,
  jobQuota: 0,
  pagesUsed: 0,
  pageQuota: 0,
  previewAvailable: false,
  checkoutAvailable: false,
};

const FREE_COMMERCE: TripCommerce = {
  offerCode: "free",
  features: [],
  expiresAt: null,
  jobsUsed: 0,
  jobQuota: 0,
  pagesUsed: 0,
  pageQuota: 0,
  previewAvailable: true,
  checkoutAvailable: false,
};

export function useCommerce() {
  const state = useKintrip();
  const tripId = state.trip.id;
  const isDemo = tripId === DEMO_TRIP_ID;
  const [commerce, setCommerce] = useState<TripCommerce>(isDemo ? DEMO_COMMERCE : FREE_COMMERCE);
  const [loading, setLoading] = useState(!isDemo);

  const refresh = useCallback(async () => {
    if (isDemo || !tripId) {
      setCommerce(isDemo ? DEMO_COMMERCE : FREE_COMMERCE);
      setLoading(false);
      return;
    }
    try {
      const result = await getTripCommerce({ data: { tripId } });
      setCommerce(result);
    } catch {
      // Not signed in, offline, or not a synced trip: treat as free.
      setCommerce(FREE_COMMERCE);
    } finally {
      setLoading(false);
    }
  }, [tripId, isDemo]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const has = useCallback(
    (feature: FeatureCode) => commerce.features.includes(feature),
    [commerce.features],
  );

  const jobsLeft = Math.max(0, commerce.jobQuota - commerce.jobsUsed);

  /**
   * Runs an advanced job through the shared allowance: reserve, run, settle.
   * A failure releases the reservation so nothing is charged for it.
   */
  const runJob = useCallback(
    async <T,>(
      feature: FeatureCode,
      inputsHash: string,
      work: () => Promise<T> | T,
    ): Promise<{ ok: true; result: T } | { ok: false; reason: "locked" | "exhausted" | "error" }> => {
      if (isDemo) {
        return { ok: true, result: await work() };
      }
      let reserved: { ok: boolean; jobId?: string; reason?: string };
      try {
        reserved = await reserveAdvancedJob({
          data: {
            tripId,
            feature,
            inputsHash,
            revision: state.itinerary?.version ?? 1,
            tripEnd: state.trip.endDate,
          },
        });
      } catch {
        return { ok: false, reason: "error" };
      }
      if (!reserved.ok || !reserved.jobId) {
        return { ok: false, reason: (reserved.reason as "locked" | "exhausted") ?? "error" };
      }
      try {
        const result = await work();
        await finishAdvancedJob({ data: { tripId, jobId: reserved.jobId, ok: true } });
        void refresh();
        return { ok: true, result };
      } catch {
        await finishAdvancedJob({ data: { tripId, jobId: reserved.jobId, ok: false } });
        void refresh();
        return { ok: false, reason: "error" };
      }
    },
    [isDemo, tripId, state.itinerary?.version, state.trip.endDate, refresh],
  );

  return { commerce, loading, isDemo, has, jobsLeft, refresh, runJob };
}
