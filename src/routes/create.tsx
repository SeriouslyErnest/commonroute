import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { AppShell } from "@/components/kintrip/AppShell";
import { Button, Card, Field, inputClass } from "@/components/kintrip/ui";
import { createNewTrip } from "@/lib/kintrip/store";

export const Route = createFileRoute("/create")({
  head: () => ({
    meta: [
      { title: "Create a family trip — Kintrip" },
      {
        name: "description",
        content: "Start a multi-generational trip in under a minute: destination, dates, travellers.",
      },
      { property: "og:title", content: "Create a family trip — Kintrip" },
      {
        property: "og:description",
        content: "Start a multi-generational trip in under a minute.",
      },
    ],
  }),
  component: CreateTrip,
});

function CreateTrip() {
  const state = useKintrip();
  const navigate = useNavigate();

  return (
    <AppShell
      title="Where's your next family adventure?"
      subtitle="Turn travel plans into shared memories."
      back={{ to: "/", label: "Back to trip" }}
    >
      <Card>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            setState((prev) => ({
              ...prev,
              trip: {
                ...prev.trip,
                title: String(f.get("title") || "Our family trip"),
                destination: String(f.get("destination")),
                startDate: String(f.get("start")),
                endDate: String(f.get("end")),
                travellerCount: Number(f.get("count")),
              },
              itinerary: null,
            }));
            void navigate({ to: "/invite" });
          }}
        >
          <Field label="Destination">
            <input name="destination" defaultValue={state.trip.destination} className={inputClass} required />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Start date">
              <input type="date" name="start" defaultValue={state.trip.startDate} className={inputClass} required />
            </Field>
            <Field label="End date">
              <input type="date" name="end" defaultValue={state.trip.endDate} className={inputClass} required />
            </Field>
          </div>
          <Field label="Number of travellers">
            <input
              type="number"
              min={1}
              max={20}
              name="count"
              defaultValue={state.trip.travellerCount}
              className={inputClass}
              required
            />
          </Field>
          <Field label="Trip name (optional)">
            <input name="title" defaultValue={state.trip.title} className={inputClass} />
          </Field>
          <Button type="submit" className="w-full">
            Create trip <ArrowRight className="size-5" aria-hidden />
          </Button>
        </form>
      </Card>
      <p className="text-center text-sm text-muted-foreground">
        Already invited?{" "}
        <Link to="/join" className="font-semibold text-secondary">
          Join an existing trip
        </Link>
      </p>
    </AppShell>
  );
}
