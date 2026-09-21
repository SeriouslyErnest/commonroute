import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Loader2, Map as MapIcon, Route as RouteIcon, Utensils, Landmark } from "lucide-react";
import { AppShell } from "@/components/kintrip/AppShell";
import { Button, Card, Chip, inputClass } from "@/components/kintrip/ui";
import { PlaceMap, type MapPlace } from "@/components/kintrip/PlaceMap";
import { CLUSTER_ALGORITHM, clusterPlaces, clusterSpreadM, formatDistance, hasCoords } from "@/lib/kintrip/geo";
import { routeDriving, type DrivingRouteResult } from "@/lib/kintrip/routing.functions";
import { setState, useKintrip } from "@/lib/kintrip/store";
import type { Attraction, PlaceCluster, PlaceKind } from "@/lib/kintrip/types";
import { mapsUrl } from "@/lib/kintrip/engine";

export const Route = createFileRoute("/places")({
  head: () => ({
    meta: [
      { title: "Map & nearby groups — CommonRoute" },
      {
        name: "description",
        content: "See your shortlisted places on a map and group the ones that sit close together.",
      },
      { property: "og:title", content: "Map & nearby groups — CommonRoute" },
      {
        property: "og:description",
        content: "Group nearby places by straight-line distance and check driving times between them.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  ssr: false,
  component: PlacesScreen,
});

type Filter = "all" | PlaceKind;

const kindOf = (place: Attraction): PlaceKind =>
  place.kind ?? (/food|restaurant|eat|cafe|dining/i.test(place.category) ? "eatery" : "attraction");

function PlacesScreen() {
  const state = useKintrip();
  const [filter, setFilter] = useState<Filter>("all");
  const [thresholdKm, setThresholdKm] = useState(2);
  const [groups, setGroups] = useState<PlaceCluster[] | null>(state.clusters ?? null);
  const [routes, setRoutes] = useState<Record<string, DrivingRouteResult | "loading">>({});

  const shown = useMemo(
    () => state.attractions.filter((a) => (filter === "all" ? true : kindOf(a) === filter)),
    [state.attractions, filter],
  );

  const byId = useMemo(() => new Map(state.attractions.map((a) => [a.id, a] as const)), [state.attractions]);
  const located = shown.filter(hasCoords);
  const missing = shown.filter((a) => !hasCoords(a));

  const mapPlaces: MapPlace[] = shown.map((place) => {
    const kind = kindOf(place);
    return {
      place,
      glyph: kind === "eatery" ? "E" : "A",
      tone: kind === "eatery" ? "#20A7A0" : "#3178C6",
      label: kind === "eatery" ? "Somewhere to eat" : "Attraction",
    };
  });

  function regroup() {
    const result = clusterPlaces(shown, Math.round(thresholdKm * 1000));
    // Keep any groups the organiser edited by hand; only rebuild the rest.
    const manual = (groups ?? []).filter((g) => g.manual);
    const claimed = new Set(manual.flatMap((g) => g.placeIds));
    const fresh = result.clusters
      .map((g) => ({ ...g, placeIds: g.placeIds.filter((id) => !claimed.has(id)) }))
      .filter((g) => g.placeIds.length > 0);
    const next = [...manual, ...fresh];
    setGroups(next);
    setState((prev) => ({ ...prev, clusters: next }));
  }

  function renameGroup(id: string, label: string) {
    setGroups((prev) => {
      const next = (prev ?? []).map((g) => (g.id === id ? { ...g, label, manual: true, revision: g.revision + 1 } : g));
      setState((s) => ({ ...s, clusters: next }));
      return next;
    });
  }

  function movePlace(placeId: string, toGroupId: string) {
    setGroups((prev) => {
      const next = (prev ?? []).map((g) => ({
        ...g,
        placeIds: g.placeIds.filter((id) => id !== placeId),
        manual: g.manual || g.placeIds.includes(placeId),
      }));
      const target = next.find((g) => g.id === toGroupId);
      if (target) {
        target.placeIds = [...target.placeIds, placeId];
        target.manual = true;
        target.revision += 1;
      }
      const cleaned = next.filter((g) => g.placeIds.length > 0);
      setState((s) => ({ ...s, clusters: cleaned }));
      return cleaned;
    });
  }

  function resetGroups() {
    setGroups(null);
    setState((prev) => ({ ...prev, clusters: [] }));
    setRoutes({});
  }

  async function checkDriving(group: PlaceCluster) {
    const points = group.placeIds
      .map((id) => byId.get(id))
      .filter((p): p is Attraction => !!p && hasCoords(p))
      .map((p) => ({ latitude: p.latitude!, longitude: p.longitude! }));
    if (points.length < 2) return;
    setRoutes((r) => ({ ...r, [group.id]: "loading" }));
    const result = await routeDriving({ data: { points: points.slice(0, 12) } });
    setRoutes((r) => ({ ...r, [group.id]: result }));
  }

  return (
    <AppShell title="Map & nearby groups" back={{ to: "/discover", label: "Back to discover" }}>
      <Card>
        <div className="flex flex-wrap items-center gap-2">
          {(["all", "attraction", "eatery"] as Filter[]).map((f) => (
            <Button
              key={f}
              variant={filter === f ? "primary" : "outline"}
              onClick={() => setFilter(f)}
              aria-pressed={filter === f}
            >
              {f === "all" ? "Everything" : f === "attraction" ? "Attractions" : "Places to eat"}
            </Button>
          ))}
        </div>
        <p className="mt-3 text-sm text-muted-foreground">
          {shown.length} place{shown.length === 1 ? "" : "s"} shown
          {missing.length > 0 ? `, ${missing.length} without a saved location` : ""}.
        </p>
        <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Landmark className="h-4 w-4" aria-hidden /> A = attraction
          </span>
          <span className="inline-flex items-center gap-1">
            <Utensils className="h-4 w-4" aria-hidden /> E = somewhere to eat
          </span>
        </div>
      </Card>

      <Card>
        <h2 className="mb-3 flex items-center gap-2 text-base font-semibold">
          <MapIcon className="h-5 w-5" aria-hidden /> On the map
        </h2>
        <PlaceMap places={mapPlaces} />
      </Card>

      <Card>
        <h2 className="text-base font-semibold">Group nearby</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Groups only the places shown above, using straight-line distance. A group is a planning aid —
          it is never turned into a day on its own.
        </p>
        <label className="mt-4 block text-sm font-medium" htmlFor="threshold">
          Largest gap inside a group: {thresholdKm.toFixed(1)} km (straight-line distance)
        </label>
        <input
          id="threshold"
          type="range"
          min={0.5}
          max={10}
          step={0.5}
          value={thresholdKm}
          onChange={(e) => setThresholdKm(Number(e.target.value))}
          className="mt-2 w-full"
        />
        <div className="mt-3 flex flex-wrap gap-2">
          <Button onClick={regroup} disabled={located.length === 0}>
            Group nearby
          </Button>
          {groups ? (
            <Button variant="outline" onClick={resetGroups}>
              Clear groups
            </Button>
          ) : null}
        </div>
        {located.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            None of these places has a saved location yet, so they cannot be grouped.
          </p>
        ) : null}
      </Card>

      {(groups ?? []).map((group) => {
        const members = group.placeIds.map((id) => byId.get(id)).filter((p): p is Attraction => !!p);
        const spread = clusterSpreadM(members);
        const overThreshold = spread > group.thresholdM;
        const route = routes[group.id];
        return (
          <Card key={group.id}>
            <div className="flex flex-wrap items-center gap-2">
              <input
                className={inputClass}
                style={{ maxWidth: 240 }}
                value={group.label}
                aria-label="Group name"
                onChange={(e) => renameGroup(group.id, e.target.value)}
              />
              <Chip>{members.length} place{members.length === 1 ? "" : "s"}</Chip>
              <Chip tone={overThreshold ? "coral" : "neutral"}>
                spread {formatDistance(spread)} straight-line
              </Chip>
              {group.manual ? <Chip tone="secondary">edited by hand</Chip> : null}
            </div>
            {overThreshold ? (
              <p className="mt-2 text-sm text-foreground">
                This group is wider than the {(group.thresholdM / 1000).toFixed(1)} km setting because it was
                edited by hand.
              </p>
            ) : null}
            <ul className="mt-3 space-y-2">
              {members.map((place) => (
                <li key={place.id} className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-medium">{place.name}</span>
                  <span className="text-muted-foreground">{place.category}</span>
                  <a className="underline" href={mapsUrl(place)} target="_blank" rel="noreferrer">
                    map
                  </a>
                  <select
                    className="ml-auto min-h-11 rounded-lg border border-border bg-background px-2 text-sm"
                    aria-label={`Move ${place.name} to another group`}
                    value={group.id}
                    onChange={(e) => movePlace(place.id, e.target.value)}
                  >
                    {(groups ?? []).map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.label}
                      </option>
                    ))}
                  </select>
                </li>
              ))}
            </ul>
            <div className="mt-3">
              <Button variant="outline" onClick={() => void checkDriving(group)} disabled={route === "loading"}>
                {route === "loading" ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <RouteIcon className="h-4 w-4" aria-hidden />
                )}
                Driving times between these
              </Button>
              {route && route !== "loading" ? (
                <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                  {route.legs.map((leg) => {
                    const from = members.filter(hasCoords)[leg.fromIndex];
                    const to = members.filter(hasCoords)[leg.toIndex];
                    return (
                      <li key={`${group.id}-${leg.fromIndex}`}>
                        {from?.name} → {to?.name}:{" "}
                        {leg.unavailable
                          ? "Driving route unavailable"
                          : `${formatDistance(leg.metres)}, about ${Math.round((leg.seconds ?? 0) / 60)} min by car`}
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </div>
          </Card>
        );
      })}

      {groups && missing.length > 0 ? (
        <Card>
          <h2 className="text-base font-semibold">Ungrouped</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            These places have no saved location, so we cannot place them — we never guess one.
          </p>
          <ul className="mt-3 space-y-2 text-sm">
            {missing.map((place) => (
              <li key={place.id} className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{place.name}</span>
                <Link className="underline" to="/fit/$attractionId" params={{ attractionId: place.id }}>
                  Set its location
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <p className="px-1 text-xs text-muted-foreground">
        Grouping uses {CLUSTER_ALGORITHM.replace(/-/g, " ")}. Straight-line distance ignores water, hills and
        roads, so nearby places can still be slow to travel between.
      </p>
    </AppShell>
  );
}
