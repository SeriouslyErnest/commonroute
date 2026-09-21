import type { Attraction, PlaceCluster } from "./types";

/** Straight-line (geodesic) distance in metres. Handles longitude wrap-around. */
export function metresBetween(
  a: { latitude?: undefined | number; longitude?: undefined | number },
  b: { latitude?: undefined | number; longitude?: undefined | number },
): number | null {
  if (a.latitude == null || a.longitude == null || b.latitude == null || b.longitude == null) {
    return null;
  }
  const toRad = (d: number) => (d * Math.PI) / 180;
  // Wrap the longitude difference into -180…180 so a pair either side of the
  // date line is treated as close, not half a world apart.
  let dLonDeg = b.longitude - a.longitude;
  while (dLonDeg > 180) dLonDeg -= 360;
  while (dLonDeg < -180) dLonDeg += 360;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(dLonDeg);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 6371008.8 * 2 * Math.asin(Math.min(1, Math.sqrt(h)));
}

export const hasCoords = (a: Attraction) => a.latitude != null && a.longitude != null;

export interface ClusterResult {
  clusters: PlaceCluster[];
  /** Places with no usable location: never guessed, never dropped silently. */
  ungrouped: Attraction[];
}

export const CLUSTER_ALGORITHM = "complete-linkage-haversine-v1";

/**
 * Deterministic complete-linkage clustering: two groups only merge when *every*
 * pair across them is inside the threshold, so a chain of near neighbours can
 * never form one very wide group. Ties break on the stable place id.
 */
export function clusterPlaces(places: Attraction[], thresholdM: number): ClusterResult {
  const located = places.filter(hasCoords).sort((a, b) => a.id.localeCompare(b.id));
  const ungrouped = places.filter((p) => !hasCoords(p));

  let groups: Attraction[][] = located.map((p) => [p]);

  for (;;) {
    let bestI = -1;
    let bestJ = -1;
    let bestMax = Infinity;
    for (let i = 0; i < groups.length; i += 1) {
      for (let j = i + 1; j < groups.length; j += 1) {
        let max = 0;
        let ok = true;
        for (const a of groups[i]!) {
          for (const b of groups[j]!) {
            const d = metresBetween(a, b);
            if (d == null || d > thresholdM) {
              ok = false;
              break;
            }
            if (d > max) max = d;
          }
          if (!ok) break;
        }
        if (!ok) continue;
        if (max < bestMax) {
          bestMax = max;
          bestI = i;
          bestJ = j;
        }
      }
    }
    if (bestI === -1) break;
    groups[bestI] = [...groups[bestI]!, ...groups[bestJ]!].sort((a, b) => a.id.localeCompare(b.id));
    groups = groups.filter((_, idx) => idx !== bestJ);
  }

  groups.sort((a, b) => b.length - a.length || a[0]!.id.localeCompare(b[0]!.id));

  const clusters: PlaceCluster[] = groups.map((members, idx) => ({
    id: `cl-${thresholdM}-${members[0]!.id}`,
    label: suggestLabel(members, idx),
    placeIds: members.map((m) => m.id),
    thresholdM,
    algorithm: CLUSTER_ALGORITHM,
    manual: false,
    revision: 1,
  }));

  return { clusters, ungrouped };
}

function suggestLabel(members: Attraction[], idx: number): string {
  const areas = members.map((m) => m.area).filter(Boolean);
  const counted = new Map<string, number>();
  for (const a of areas) counted.set(a, (counted.get(a) ?? 0) + 1);
  const top = [...counted.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
  if (top) return top[0];
  return members[0]?.city || `Group ${idx + 1}`;
}

/** Widest straight-line gap inside a group, in metres. */
export function clusterSpreadM(places: Attraction[]): number {
  let max = 0;
  for (let i = 0; i < places.length; i += 1) {
    for (let j = i + 1; j < places.length; j += 1) {
      const d = metresBetween(places[i]!, places[j]!);
      if (d != null && d > max) max = d;
    }
  }
  return Math.round(max);
}

export function formatDistance(metres: number | null): string {
  if (metres == null) return "distance unknown";
  if (metres < 950) return `${Math.round(metres / 10) * 10} m`;
  return `${(metres / 1000).toFixed(1)} km`;
}

/** Average position of a set of places, for centring a map. */
export function centreOf(places: Attraction[]): { lat: number; lng: number } | null {
  const located = places.filter(hasCoords);
  if (located.length === 0) return null;
  const lat = located.reduce((s, p) => s + p.latitude!, 0) / located.length;
  const lng = located.reduce((s, p) => s + p.longitude!, 0) / located.length;
  return { lat, lng };
}
