import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/kintrip/AppShell";
import { StartTripCard } from "@/components/kintrip/StartTripForm";

export const Route = createFileRoute("/create")({
  head: () => ({
    meta: [
      { title: "Create a group trip — CommonRoute" },
      {
        name: "description",
        content: "Start a multi-generational trip in under a minute: destination, dates, travellers.",
      },
      { property: "og:title", content: "Create a group trip — CommonRoute" },
      {
        property: "og:description",
        content: "Start a multi-generational trip in under a minute.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
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
