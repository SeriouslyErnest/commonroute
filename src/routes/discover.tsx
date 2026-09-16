import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Check, ChevronDown, Clock, Footprints, Loader2, MapPin, Plus, Search, Wallet } from "lucide-react";
import { AppShell } from "@/components/kintrip/AppShell";
import { Button, Card, Chip, LinkButton, inputClass } from "@/components/kintrip/ui";
import { fitNoteFor, mapsUrl, VOTE_LABEL } from "@/lib/kintrip/engine";
import { searchPlaces, type PlaceResult } from "@/lib/kintrip/places.functions";
import { setState, useKintrip } from "@/lib/kintrip/store";
import type { Attraction, VoteValue } from "@/lib/kintrip/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/discover")({
  head: () => ({
    meta: [
      { title: "Discover & vote — Kintrip" },
      {
        name: "description",
        content: "Shortlist attractions together and let every family member vote in one tap.",
      },
      { property: "og:title", content: "Discover & vote — Kintrip" },
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
  const [query, setQuery] = useState("");
  const [city, setCity] = useState<string>("All");
  const [visibleCount, setVisibleCount] = useState(6);
  const [googleResults, setGoogleResults] = useState<PlaceResult[]>([]);
  const [searching, setSearching] = useState(false);
  const me = state.travellers.find((t) => t.id === state.activeTravellerId) ?? state.travellers[0];

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setGoogleResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const timer = setTimeout(() => {
      searchPlaces({ data: { query: q, destination: state.trip.destination } })
        .then((results) => setGoogleResults(results))
        .catch(() => setGoogleResults([]))
        .finally(() => setSearching(false));
    }, 400);
    return () => clearTimeout(timer);
  }, [query, state.trip.destination]);

  if (!me) return null;

  const addPlace = (p: PlaceResult) => {
    const id = `gp-${p.placeId}`;
    const tripCity = state.trip.destination.split(",")[0]!.trim();
    const addressParts = p.address.split(",").map((s) => s.trim());
    const city =
      addressParts.length >= 2
        ? (addressParts[addressParts.length - 2] ?? tripCity)
        : tripCity;
    const attraction: Attraction = {
      id,
      name: p.name,
      city,
      area: addressParts[1] || city,
      category: "From Google Maps",
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
      (city === "All" || a.city === city) &&
      (a.name.toLowerCase().includes(query.toLowerCase()) ||
        a.category.toLowerCase().includes(query.toLowerCase())),
  );

  return (
    <AppShell title="Discover & vote" subtitle={`Voting as ${me.name}`}>
      <Card className="space-y-3 sm:grid sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-3 sm:space-y-0">
        <div className="relative">
          <Search className="absolute left-3 top-3.5 size-5 text-muted-foreground" aria-hidden />
          <input
            className={cn(inputClass, "pl-10")}
            placeholder="Search places or interests"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search places"
          />
        </div>
        <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 sm:flex">
          <div className="flex gap-1 rounded-xl bg-muted p-1">
          {["All", ...new Set(state.attractions.map((a) => a.city))].map((c) => (
            <button
              key={c}
              onClick={() => setCity(c)}
              className={cn(
                "min-h-10 flex-1 rounded-lg px-3 text-sm font-semibold sm:flex-none",
                city === c ? "bg-card text-secondary shadow-sm" : "text-foreground",
              )}
            >
              {c}
            </button>
          ))}
          </div>
          <select
            className="min-h-10 max-w-36 rounded-xl bg-muted px-3 text-sm font-semibold"
            value={state.activeTravellerId}
            onChange={(e) =>
              setState((prev) => ({ ...prev, activeTravellerId: e.target.value }))
            }
            aria-label="Vote as"
          >
            {state.travellers.map((t) => (
              <option key={t.id} value={t.id}>
                Vote as {t.name}
              </option>
            ))}
          </select>
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
            Found on Google Maps
          </h2>
          {!searching && googleResults.length === 0 ? (
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
                      variant={added ? "outline" : "primary"}
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
                         ? "border-primary bg-primary text-primary-foreground shadow-sm ring-2 ring-primary/20"
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
