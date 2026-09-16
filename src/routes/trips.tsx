import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { CalendarRange, CheckCircle2, MapPin, Plus, RotateCcw, Sparkles, Trash2, Users } from "lucide-react";
import { AppShell } from "@/components/kintrip/AppShell";
import { Button, Card, Chip, LinkButton } from "@/components/kintrip/ui";
import { formatDate } from "@/lib/kintrip/engine";
import {
  deleteTrip,
  exitDemoTrip,
  resetDemoTrip,
  startDemoTrip,
  switchTrip,
  useTripList,
  useTripSetupStatus,
} from "@/lib/kintrip/store";

export const Route = createFileRoute("/trips")({
  head: () => ({
    meta: [
      { title: "My trips — Kintrip" },
      {
        name: "description",
        content: "Switch between your family trips, start a new one, or join an existing trip.",
      },
      { property: "og:title", content: "My trips — Kintrip" },
      {
        property: "og:description",
        content: "Switch between your family trips, start a new one, or join an existing trip.",
      },
    ],
  }),
  component: MyTrips,
});

function MyTrips() {
  const trips = useTripList();
  const { hasDemo } = useTripSetupStatus();
  const navigate = useNavigate();

  return (
    <AppShell
      title="My trips"
      subtitle="Every journey your family is planning, in one place."
      back={{ to: "/", label: "Back to trip" }}
    >
      {trips.length === 0 ? (
        <Card className="py-8 text-center">
          <h2 className="text-xl">No trips yet</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            Start a new family adventure, or open an invite link to join someone else’s trip.
          </p>
        </Card>
      ) : null}
      <div className="grid gap-3">
        {trips.map((t) => (
          <Card
            key={t.id}
            className={t.active ? "border-primary/50" : ""}
          >
            <div className="flex items-start justify-between gap-3">
              <button
                type="button"
                className="flex-1 text-left"
                onClick={() => {
                  switchTrip(t.id);
                  void navigate({ to: "/" });
                }}
              >
                <span className="flex flex-wrap items-center gap-2">
                  <span className="text-lg font-bold">{t.title}</span>
                  {t.active ? <Chip tone="primary">Current trip</Chip> : null}
                  {t.isDemo ? <Chip tone="sunny">Demo</Chip> : null}
                  {t.status === "final" ? <Chip tone="lime">Finalised</Chip> : null}
                </span>
                <span className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="size-4" aria-hidden /> {t.destination}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <CalendarRange className="size-4" aria-hidden />
                    {formatDate(t.startDate)} – {formatDate(t.endDate)}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Users className="size-4" aria-hidden />
                    {t.joined} of {t.travellerCount} joined
                  </span>
                </span>
                <span className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
                  {t.hasItinerary ? (
                    <>
                      <CheckCircle2 className="size-4 text-primary" aria-hidden /> Itinerary ready
                    </>
                  ) : (
                    "Still planning"
                  )}
                </span>
              </button>
              {!t.active || trips.length === 1 ? (
                <Button
                  variant="ghost"
                  aria-label={`Delete ${t.title}`}
                  onClick={() => {
                    if (window.confirm(`Remove “${t.title}” from this device?`)) {
                      deleteTrip(t.id);
                    }
                  }}
                >
                  <Trash2 className="size-5 text-muted-foreground" aria-hidden />
                </Button>
              ) : null}
            </div>
          </Card>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <LinkButton to="/create">
          <Plus className="size-5" aria-hidden /> Create a new trip
        </LinkButton>
        <LinkButton to="/join" variant="outline">
          Join an existing trip
        </LinkButton>
      </div>
      <p className="text-sm text-muted-foreground">
        Trips are saved on this device, so you can switch between them even offline.
      </p>
      <Card>
        <h2 className="flex items-center gap-2 text-lg">
          <Sparkles className="size-5 text-secondary" aria-hidden /> Demo mode
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          A sample family trip to Japan with seven travellers, so you can step through every feature —
          preferences, voting, the suggested plan, re-planning a day and offline viewing. Sample data only.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {hasDemo ? (
            <>
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  resetDemoTrip();
                  void navigate({ to: "/" });
                }}
              >
                <RotateCcw className="size-5" aria-hidden /> Restart demo
              </Button>
              <Button type="button" variant="ghost" onClick={exitDemoTrip}>
                Remove demo trip
              </Button>
            </>
          ) : (
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                startDemoTrip();
                void navigate({ to: "/" });
              }}
            >
              <Sparkles className="size-5" aria-hidden /> Start demo trip
            </Button>
          )}
        </div>
      </Card>
    </AppShell>
  );
}
