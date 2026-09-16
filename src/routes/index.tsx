import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  MapPin,
  Navigation,
  PlaneTakeoff,
  RefreshCw,
  Sparkles,
  StickyNote,
  Train,
} from "lucide-react";
import { AppShell } from "@/components/kintrip/AppShell";
import { Button, Card, Chip, LinkButton } from "@/components/kintrip/ui";
import { formatDate, pretty, toMin } from "@/lib/kintrip/engine";
import { exitDemoTrip, setState, startDemoTrip, useKintrip, useTripSetupStatus } from "@/lib/kintrip/store";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Kintrip — Plan a trip that works for every generation" },
      {
        name: "description",
        content:
          "Kintrip turns your family's different preferences and needs into one realistic itinerary — and helps you re-plan the day when things change.",
      },
      { property: "og:title", content: "Kintrip — family travel planning" },
      {
        property: "og:description",
        content:
          "Many generations. One journey. Shared memories. Collect preferences, vote together and get a realistic family itinerary.",
      },
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
    <AppShell>
      <section className="mx-auto flex min-h-[60vh] max-w-2xl flex-col items-center justify-center py-10 text-center sm:py-16">
        <span className="mb-5 inline-flex size-16 items-center justify-center rounded-full bg-primary-soft text-primary">
          <PlaneTakeoff className="size-8" aria-hidden />
        </span>
        <p className="text-sm font-bold text-primary">Many generations. One journey. Shared memories.</p>
        <h1 className="mt-3 text-3xl sm:text-4xl">Let’s plan your first family trip</h1>
        <p className="mt-3 max-w-xl text-muted-foreground">
          Bring everyone’s preferences and practical needs together, then turn them into one plan the family can enjoy.
        </p>
        <div className="mt-7 flex w-full max-w-sm flex-col gap-3 sm:flex-row sm:max-w-none sm:justify-center">
          <LinkButton to="/create">
            Create your first trip <ArrowRight className="size-5" aria-hidden />
          </LinkButton>
          <LinkButton to="/join" variant="outline">Join a trip</LinkButton>
        </div>
        <p className="mt-6 text-sm text-muted-foreground">No account needed to get started.</p>
        <div className="mt-8 w-full max-w-xl">
          <Card className="text-left">
            <h2 className="text-lg">Just exploring?</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Open the demo trip — a family of seven in Japan — to step through voting, the suggested plan,
              re-planning a day and offline viewing. You can remove it anytime.
            </p>
            <div className="mt-4">
              <Button type="button" variant="secondary" onClick={() => startDemoTrip()}>
                <Sparkles className="size-5" aria-hidden /> Try the demo trip
              </Button>
            </div>
          </Card>
        </div>
      </section>
    </AppShell>
  );
}

function DemoBanner() {
  const { demoActive } = useTripSetupStatus();
  if (!demoActive) return null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-sunny-soft px-4 py-3 text-sm">
      <span className="inline-flex items-center gap-2 font-semibold">
        <Sparkles className="size-4" aria-hidden /> Demo trip — sample family and sample places
      </span>
      <Button type="button" variant="ghost" className="shrink-0 px-3" onClick={exitDemoTrip}>
        Exit demo
      </Button>
    </div>
  );
}

function ActiveTrip() {
  const state = useKintrip();
  const { trip, itinerary } = state;
  const joined = state.travellers.filter((t) => t.joined).length;
  const withPrefs = state.travellers.filter((t) => t.prefStatus === "complete").length;
  const voted = Object.values(state.votes).filter((v) => Object.keys(v).length > 0).length;

  if (!itinerary) {
    const steps = [
      { label: "Invite your family", done: joined > 1, to: "/invite", hint: `${joined} joined` },
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
      <AppShell title={trip.title} subtitle={`${trip.destination} · ${formatDate(trip.startDate)} – ${formatDate(trip.endDate)}`}>
        <DemoBanner />
        <Card className="bg-primary-soft">
          <h2 className="text-lg">Your family is nearly ready to plan</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {withPrefs} of {trip.travellerCount} travellers have shared what matters to them.
          </p>
          <div className="mt-4">
            <LinkButton to="/consensus">
              See where everyone stands <ArrowRight className="size-5" />
            </LinkButton>
          </div>
        </Card>

        <div className="grid gap-3 sm:grid-cols-2">
          {steps.map((s) => (
            <Link key={s.label} to={s.to} className="kin-card flex items-center gap-3 p-4">
              <CheckCircle2
                className={s.done ? "size-6 text-primary" : "size-6 text-muted-foreground"}
                aria-hidden
              />
              <span className="flex-1">
                <span className="block font-semibold">{s.label}</span>
                <span className="block text-sm text-muted-foreground">{s.hint}</span>
              </span>
              <ArrowRight className="size-5 text-muted-foreground" aria-hidden />
            </Link>
          ))}
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
