import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Check, ChevronDown, Clock, Footprints, Loader2, MapPin, Plus, Search, Wallet } from "lucide-react";
import { AppShell } from "@/components/kintrip/AppShell";
import { Button, Card, Chip, LinkButton, inputClass } from "@/components/kintrip/ui";
import { fitNoteFor, mapsUrl, VOTE_LABEL } from "@/lib/kintrip/engine";
import {
  searchPlaces,
  type PlaceProvider,
  type PlaceResult,
} from "@/lib/kintrip/places.functions";
import { setState, useKintrip, useTripSetupStatus } from "@/lib/kintrip/store";
import type { Attraction, VoteValue } from "@/lib/kintrip/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/discover")({
  head: () => ({
    meta: [
      { title: "Discover & vote — CommonRoute" },
      {
        name: "description",
        content: "Shortlist attractions together and let every family member vote in one tap.",
      },
      { property: "og:title", content: "Discover & vote — CommonRoute" },
      {
        property: "og:description",
        content: "Shortlist attractions together and let every family member vote in one tap.",
      },
    ],
  }),
  component: DiscoverTab,
});

const VOTE_ORDER: VoteValue[] = ["MUST_GO", "WOULD_LIKE", "DONT_MIND", "SKIP"];

function DiscoverTab() {
  const state = useKintrip();
  const { demoActive } = useTripSetupStatus();
  const [query, setQuery] = useState("");
  const [visibleCount, setVisibleCount] = useState(6);
  const [googleResults, setGoogleResults] = useState<PlaceResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [provider, setProvider] = useState<PlaceProvider>("free");
  const [searchError, setSearchError] = useState<string | null>(null);
  const me = state.travellers.find((t) => t.id === state.activeTravellerId) ?? state.travellers[0];

  useEffect(() => {
    const saved = localStorage.getItem("kintrip.placeProvider");
    if (saved === "free" || saved === "google") setProvider(saved);
  }, []);

  const chooseProvider = (next: PlaceProvider) => {
    setProvider(next);
    localStorage.setItem("kintrip.placeProvider", next);
  };

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setGoogleResults([]);
      setSearching(false);
      setSearchError(null);
      return;
    }
    setSearching(true);
    setSearchError(null);
    const timer = setTimeout(() => {
      searchPlaces({ data: { query: q, destination: state.trip.destination, provider } })
        .then((results) => setGoogleResults(results))
        .catch(() => {
          setGoogleResults([]);
          setSearchError("Search is unavailable right now. Try the other map source.");
        })
        .finally(() => setSearching(false));
    }, 400);
    return () => clearTimeout(timer);
  }, [query, state.trip.destination, provider]);

  if (!me) return null;

  const addPlace = (p: PlaceResult) => {
    const id = `gp-${p.placeId}`;
    const tripCity = state.trip.destination.split(",")[0]!.trim();
    const addressParts = p.address.split(",").map((s) => s.trim());
    const rawCity =
      addressParts.length >= 2
        ? addressParts[addressParts.length - 2]!.replace(/[\d-]/g, "").trim()
        : "";
    const city = rawCity || tripCity;
    const attraction: Attraction = {
      id,
      name: p.name,
      city,
      area: addressParts[1] || city,
      category: p.provider === "google" ? "From Google Maps" : "From map search",
      description: p.address,
      durationMin: 120,
      walking: "moderate",
      cost: "$",
      indoor: false,
      opens: "09:00",
      closes: "18:00",
      sourceUrl: p.mapsUrl,
    };
    setState((prev) =>
      prev.attractions.some((a) => a.id === id)
        ? prev
        : { ...prev, attractions: [...prev.attractions, attraction] },
    );
  };

  const list = state.attractions.filter(
    (a) =>
      a.name.toLowerCase().includes(query.toLowerCase()) ||
      a.category.toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <AppShell title="Discover & vote" subtitle={`Voting as ${me.name}`}>
      <Card className="space-y-3 sm:grid sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-3 sm:space-y-0">
        <div className="relative">
          <Search className="absolute left-3 top-3.5 size-5 text-muted-foreground" aria-hidden />
          <input
            className={cn(inputClass, "pl-10")}
            placeholder={`Search places in ${state.trip.destination}`}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search places"
          />
        </div>
        {demoActive ? (
          <select
            className="min-h-10 rounded-xl bg-muted px-3 text-sm font-semibold"
            value={state.activeTravellerId}
            onChange={(e) =>
              setState((prev) => ({ ...prev, activeTravellerId: e.target.value }))
            }
            aria-label="Demo: view as"
          >
            {state.travellers.map((t) => (
              <option key={t.id} value={t.id}>
                Demo: view as {t.name}
              </option>
            ))}
          </select>
        ) : (
          <Chip tone="primary">Your votes only · {me.name}</Chip>
        )}
        <div className="sm:col-span-2">
          <div
            role="group"
            aria-label="Place search source"
            className="inline-flex rounded-full bg-muted p-1 text-sm font-semibold"
          >
            {(
              [
                ["free", "Free map search"],
                ["google", "Google Maps"],
              ] as Array<[PlaceProvider, string]>
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => chooseProvider(value)}
                aria-pressed={provider === value}
                className={cn(
                  "min-h-9 rounded-full px-3",
                  provider === value
                       ? "bg-card text-primary shadow-sm"
                    : "text-muted-foreground",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {query.trim().length >= 2 ? (
        <Card className="space-y-2">
          <h2 className="flex items-center gap-2 text-lg">
            {searching ? (
              <Loader2 className="size-5 animate-spin text-secondary" aria-hidden />
            ) : (
              <MapPin className="size-5 text-secondary" aria-hidden />
            )}
            {provider === "google" ? "Found on Google Maps" : "Found on free map search"}
          </h2>
          {searchError ? (
            <p className="text-sm text-muted-foreground">{searchError}</p>
          ) : !searching && googleResults.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No places found for “{query.trim()}” in {state.trip.destination}. Try a different name.
            </p>
          ) : (
            <ul className="space-y-2">
              {googleResults.map((p) => {
                const added = state.attractions.some((a) => a.id === `gp-${p.placeId}`);
                return (
                  <li
                    key={p.placeId}
                    className="flex flex-wrap items-center gap-2 rounded-xl bg-muted px-3 py-2"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{p.name}</span>
                      <span className="block truncate text-sm text-muted-foreground">
                        {p.address}
                      </span>
                    </span>
                    <a
                      href={p.mapsUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex min-h-10 items-center gap-1 rounded-full bg-card px-3 text-sm font-semibold text-secondary"
                    >
                      <MapPin className="size-4" aria-hidden /> View
                    </a>
                    <Button
                       variant={added ? "outline" : "collaborative"}
                      disabled={added}
                      onClick={() => addPlace(p)}
                      className="min-h-10 px-3 text-sm"
                    >
                      {added ? (
                        <>
                          <Check className="size-4" aria-hidden /> Added
                        </>
                      ) : (
                        <>
                          <Plus className="size-4" aria-hidden /> Add to shortlist
                        </>
                      )}
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        {list.slice(0, visibleCount).map((a) => {
          const myVote = state.votes[me.id]?.[a.id];
          return (
            <Card key={a.id} className="space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="text-lg">{a.name}</h2>
                  <p className="text-sm text-muted-foreground">
                    {a.area}, {a.city} · {a.category}
                  </p>
                </div>
                <Chip tone="primary">{fitNoteFor(state, a)}</Chip>
              </div>
              <p className="text-sm">{a.description}</p>
              <a
                href={mapsUrl(a)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-muted px-4 text-sm font-semibold text-secondary"
              >
                <MapPin className="size-4" aria-hidden /> View on Google Maps
              </a>
              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <Clock className="size-4" aria-hidden /> {Math.round(a.durationMin / 30) / 2}–
                  {Math.round(a.durationMin / 30) / 2 + 0.5} hours
                </span>
                <span className="inline-flex items-center gap-1">
                  <Footprints className="size-4" aria-hidden /> {a.walking} walking
                </span>
                <span className="inline-flex items-center gap-1">
                  <Wallet className="size-4" aria-hidden /> {a.cost}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {VOTE_ORDER.map((v) => (
                  <button
                    key={v}
                    onClick={() =>
                      setState((prev) => ({
                        ...prev,
                        votes: {
                          ...prev.votes,
                          [me.id]: { ...(prev.votes[me.id] ?? {}), [a.id]: v },
                        },
                      }))
                    }
                    className={cn(
                      "min-h-12 rounded-xl border text-sm font-semibold",
                      myVote === v
                         ? "border-collaboration bg-collaboration text-collaboration-foreground shadow-sm ring-2 ring-collaboration/20"
                        : "border-border bg-card text-foreground",
                    )}
                    aria-pressed={myVote === v}
                  >
                    {myVote === v ? <Check className="size-4" aria-hidden /> : null}
                    {VOTE_LABEL[v]}
                  </button>
                ))}
              </div>
            </Card>
          );
        })}
      </div>

      {visibleCount < list.length ? (
        <div className="flex justify-center">
          <Button variant="outline" onClick={() => setVisibleCount((count) => count + 6)}>
            Show more places <ChevronDown className="size-5" aria-hidden />
          </Button>
        </div>
      ) : null}

      <div className="grid gap-2 pb-4 sm:flex sm:justify-center">
        <LinkButton to="/consensus">See family summary</LinkButton>
        <Button
          variant="outline"
          onClick={() =>
            setState((prev) => ({
              ...prev,
              travellers: prev.travellers.map((t) =>
                t.id === me.id ? { ...t, prefStatus: "complete" } : t,
              ),
            }))
          }
        >
          Finish voting
        </Button>
      </div>
    </AppShell>
  );
}
