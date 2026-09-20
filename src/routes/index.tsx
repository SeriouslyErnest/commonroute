import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  MapPin,
  Navigation,
  Plus,
  RefreshCw,
  Sparkles,
  StickyNote,
  Train,
} from "lucide-react";
import { AppShell } from "@/components/kintrip/AppShell";
import { Button, Card, Chip, LinkButton } from "@/components/kintrip/ui";
import { StartTripCard } from "@/components/kintrip/StartTripForm";
import tokyoHero from "@/assets/kintrip-tokyo.jpg";
import { formatDate, pretty, toMin } from "@/lib/kintrip/engine";
import { setState, useKintrip, useTripSetupStatus } from "@/lib/kintrip/store";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "CommonRoute — Collaborative trip planning for everyone" },
      {
        name: "description",
        content:
          "CommonRoute turns different preferences and practical needs into one realistic group itinerary — and helps you re-plan when things change.",
      },
      { property: "og:title", content: "CommonRoute — Collaborative trip planning for everyone" },
      {
        property: "og:description",
        content:
          "Plan together. Share preferences, vote on places and build one practical itinerary for the whole group.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TripTab,
});

function TripTab() {
  const { hasTrips } = useTripSetupStatus();
  if (!hasTrips) return <NoTrips />;
  return <ActiveTrip />;
}

function NoTrips() {
  return (
    <main className="min-h-screen bg-background sm:px-6 sm:py-8">
      <StartTripCard />
    </main>
  );
}

function DemoBanner() {
  const { demoActive } = useTripSetupStatus();
  if (!demoActive) return null;
  return (
    <div className="flex items-center gap-2 rounded-xl bg-sunny-soft px-4 py-3 text-sm">
        <span className="inline-flex items-center gap-2 font-semibold">
          <Sparkles className="size-4" aria-hidden /> Demo trip — sample group and sample places
      </span>
    </div>
  );
}

function ActiveTrip() {
  const state = useKintrip();
  const { demoActive } = useTripSetupStatus();
  const { trip, itinerary } = state;
  const joined = state.travellers.filter((t) => t.joined).length;
  const withPrefs = state.travellers.filter((t) => t.prefStatus === "complete").length;
  const voted = Object.values(state.votes).filter((v) => Object.keys(v).length > 0).length;


  if (!itinerary) {
    const steps = [
      { label: "Invite your group", done: joined > 1, to: "/invite", hint: `${joined} joined` },
      {
        label: "Collect preferences",
        done: withPrefs >= joined,
        to: "/preferences",
        hint: `${withPrefs} of ${joined} shared`,
      },
      { label: "Vote on places", done: voted >= joined, to: "/discover", hint: `${voted} voted` },
      { label: "Review together", done: false, to: "/consensus", hint: "Consensus & considerations" },
    ];
    return (
      <AppShell>
        <section className="kin-rise relative -mx-4 -mt-5 min-h-[280px] overflow-hidden sm:mx-0 sm:mt-0 sm:min-h-[340px] sm:rounded-3xl">
          <img src={tokyoHero} alt="Tokyo skyline at dusk" width={1200} height={900} className="absolute inset-0 size-full object-cover" />
          <div className="absolute inset-0 bg-foreground/45" />
          <div className="absolute inset-0 bg-linear-to-t from-foreground/90 via-transparent to-transparent" />
          <div className="absolute inset-x-0 bottom-0 p-5 text-card sm:p-8">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              {demoActive ? <Chip tone="sunny">Demo journey</Chip> : null}
               <span className="text-sm font-bold text-card">{formatDate(trip.startDate)} – {formatDate(trip.endDate)}</span>

            </div>
            <h1 className="text-3xl leading-tight sm:text-4xl">{trip.title}</h1>
             <p className="mt-1 text-base font-bold text-card">{trip.destination} · {joined} travellers</p>
          </div>
        </section>
        <DemoBanner />
        <div className="grid gap-4 lg:grid-cols-[1.15fr_.85fr]">
          <Card className="bg-primary-soft p-5 sm:p-6">
            <Chip tone="primary">Next step</Chip>
            <h2 className="mt-3 text-2xl">Turn everyone’s choices into one plan</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">Everyone has shared their preferences and votes. See the group picture before building the itinerary.</p>
            <LinkButton to="/consensus" className="mt-5 w-full sm:w-auto">Review group choices <ArrowRight className="size-5" /></LinkButton>
          </Card>
          <Card className="p-5">
            <p className="text-sm font-bold text-secondary">Planning progress</p>
            <p className="mt-1 text-3xl font-extrabold">3 of 4</p>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full w-3/4 rounded-full bg-primary" /></div>
            <p className="mt-3 text-sm text-muted-foreground">One quick review, then your group itinerary is ready.</p>
          </Card>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {steps.map((s) => (
            <Link key={s.label} to={s.to} className="kin-card flex items-center gap-3 p-4">
               <CheckCircle2
                 className={s.done ? "size-6 text-primary" : "size-6 text-secondary"}
                aria-hidden
              />
              <span className="min-w-0 flex-1">
                 <span className="block font-semibold">{s.label}</span>
                <span className="block text-sm text-muted-foreground">{s.hint}</span>
              </span>
               {s.done ? (
                 <span className="text-xs font-bold text-muted-foreground">Done</span>
               ) : (
                 <ArrowRight className="size-5 text-secondary" aria-hidden />
               )}
            </Link>
          ))}
        </div>

        <div className="flex justify-center">
          <LinkButton to="/create" variant="outline">
            <Plus className="size-5" aria-hidden /> Plan another trip
          </LinkButton>
        </div>

        <Notes />
      </AppShell>
    );
  }

  const day = itinerary.days.find((d) => d.day === state.currentDay) ?? itinerary.days[0]!;
  const nowMin = toMin("13:00");
  const next =
    day.items.find((i) => i.kind !== "travel" && toMin(i.start) + i.durationMin > nowMin) ??
    day.items[0]!;
  const minsToNext = toMin(next.start) - nowMin;

  return (
    <AppShell
      title={`Day ${day.day} — ${day.areaLabel}`}
      subtitle={`${formatDate(day.date)} · today's plan`}
    >
      <DemoBanner />
      <Card className="border-primary/40 bg-primary-soft">
        <div className="flex items-center justify-between">
          <Chip tone="primary">Next activity</Chip>
          {minsToNext > 0 ? (
            <span className="text-sm font-semibold">Leave in {Math.max(0, minsToNext - 20)} min</span>
          ) : (
            <span className="text-sm font-semibold">Happening now</span>
          )}
        </div>
        <h2 className="mt-2 text-2xl">{next.title}</h2>
        <p className="mt-1 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Clock className="size-4" aria-hidden /> {pretty(next.start)}
          </span>
          {next.address ? (
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-4" aria-hidden /> {next.address}
            </span>
          ) : null}
          <span className="inline-flex items-center gap-1">
            <Train className="size-4" aria-hidden /> Train + 8 min walk
          </span>
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <a
            className="inline-flex min-h-12 items-center gap-2 rounded-full bg-primary px-5 font-semibold text-primary-foreground"
            href={`https://www.google.com/maps/search/${encodeURIComponent(next.title)}`}
            target="_blank"
            rel="noreferrer"
          >
            <Navigation className="size-5" aria-hidden /> Navigate
          </a>
          <Button
            variant="outline"
            onClick={() =>
              setState((prev) => ({
                ...prev,
                itinerary: prev.itinerary
                  ? {
                      ...prev.itinerary,
                      days: prev.itinerary.days.map((d) =>
                        d.day === day.day
                          ? { ...d, items: d.items.filter((i) => i.id !== next.id) }
                          : d,
                      ),
                    }
                  : prev.itinerary,
              }))
            }
          >
            Skip
          </Button>
          <LinkButton to="/replan" variant="secondary">
            <RefreshCw className="size-5" aria-hidden /> Re-plan
          </LinkButton>
        </div>
      </Card>

      <Card>
        <h2 className="text-lg">Today's timeline</h2>
        <ol className="mt-3 space-y-3">
          {day.items.map((item) => (
            <li key={item.id} className="flex gap-3">
              <span className="w-16 shrink-0 pt-0.5 text-sm font-semibold text-muted-foreground">
                {pretty(item.start)}
              </span>
              <span className="flex-1 border-l border-border pl-3">
                <span className="block font-semibold">{item.title}</span>
                <span className="block text-sm text-muted-foreground">
                  {item.kind === "travel"
                    ? `${item.durationMin} min · ${item.transport}`
                    : `${item.durationMin} min${item.address ? ` · ${item.address}` : ""}`}
                </span>
                {item.note ? (
                  <span className="mt-1 block text-sm text-muted-foreground">{item.note}</span>
                ) : null}
              </span>
            </li>
          ))}
        </ol>
      </Card>

      <div className="flex flex-wrap gap-2">
        <LinkButton to="/itinerary" variant="outline">
          Full itinerary
        </LinkButton>
        <LinkButton to="/replan" variant="secondary">
          Re-plan my day
        </LinkButton>
        <LinkButton to="/create" variant="ghost">
          <Plus className="size-5" aria-hidden /> Plan another trip
        </LinkButton>
      </div>

      <Notes />
    </AppShell>
  );
}

function Notes() {
  const state = useKintrip();
  return (
    <Card>
      <h2 className="flex items-center gap-2 text-lg">
        <StickyNote className="size-5 text-secondary" aria-hidden /> Shared notes
      </h2>
      <ul className="mt-3 space-y-2">
        {state.notes.map((n) => (
          <li key={n.id} className="rounded-xl bg-muted px-3 py-2 text-sm">
            {n.text}
            <span className="block text-xs text-muted-foreground">{n.author}</span>
          </li>
        ))}
      </ul>
      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const form = e.currentTarget;
          const input = form.elements.namedItem("note") as HTMLInputElement;
          if (!input.value.trim()) return;
          const text = input.value.trim();
          setState((prev) => ({
            ...prev,
            notes: [
              ...prev.notes,
              { id: `n${Date.now()}`, scope: "trip", text, author: "You" },
            ],
          }));
          form.reset();
        }}
      >
        <input
          name="note"
          placeholder="Add a note for everyone"
          className="min-h-12 flex-1 rounded-xl border border-input bg-card px-4"
        />
        <Button type="submit" variant="outline">
          Add
        </Button>
      </form>
    </Card>
  );
}
