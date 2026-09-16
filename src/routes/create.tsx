import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/kintrip/AppShell";
import { StartTripCard } from "@/components/kintrip/StartTripForm";

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
  return (
    <AppShell back={{ to: "/", label: "Back" }}>
      <StartTripCard embedded />
    </AppShell>
  );
}
