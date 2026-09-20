import { createFileRoute } from "@tanstack/react-router";
import { HeartHandshake } from "lucide-react";
import { AppShell } from "@/components/kintrip/AppShell";
import { Card, Chip, LinkButton } from "@/components/kintrip/ui";
import { fairness } from "@/lib/kintrip/governance";
import { useKintrip } from "@/lib/kintrip/store";

export const Route = createFileRoute("/fairness")({
  head: () => ({
    meta: [
      { title: "Everyone gets a win — CommonRoute" },
      {
        name: "description",
        content: "Check that every person in the group has at least one thing they really wanted in the plan.",
      },
      { property: "og:title", content: "Everyone gets a win — CommonRoute" },
      {
        property: "og:description",
        content: "A simple check that the plan works for every person, not only the loudest voices.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: FairnessScreen,
});

function FairnessScreen() {
  const state = useKintrip();
  const f = fairness(state);

  const plannedIds = new Set(
    (state.itinerary?.days ?? []).flatMap((d) => d.items.map((i) => i.attractionId).filter(Boolean) as string[]),
  );

  return (
    <AppShell
      title="Everyone gets a win"
      subtitle={`${f.covered.length} of ${f.total} people have something they asked for`}
      back={{ to: "/itinerary", label: "Back to the plan" }}
    >
      <Card className="border-primary/40 bg-primary-soft">
        <h2 className="flex items-center gap-2 text-lg">
          <HeartHandshake className="size-5 text-primary" aria-hidden /> Why this matters
        </h2>
        <p className="mt-2 text-sm">
          A plan can look balanced overall and still leave one person with nothing they chose. This page
          checks each person separately.
        </p>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2">
        {state.travellers.map((t) => {
          const happy = f.covered.includes(t.id);
          const wanted = Object.entries(state.votes[t.id] ?? {})
            .filter(([, v]) => v === "MUST_GO")
            .map(([id]) => state.attractions.find((a) => a.id === id))
            .filter(Boolean);
          const missing = wanted.filter((a) => a && !plannedIds.has(a.id));
          return (
            <Card key={t.id} className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-base font-extrabold">{t.name}</h3>
                <Chip tone={happy ? "lime" : "sunny"}>{happy ? "Has a win" : "Nothing yet"}</Chip>
              </div>
              {wanted.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Hasn&apos;t marked any must-go places yet, so there is nothing to protect.
                </p>
              ) : happy ? (
                <p className="text-sm text-muted-foreground">
                  Their must-go choices are in the plan.
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Still missing: {missing.map((a) => a!.name).join(", ")}
                </p>
              )}
            </Card>
          );
        })}
      </div>

      {f.uncovered.length > 0 ? (
        <Card className="space-y-3">
          <h2 className="text-lg">How to fix this</h2>
          <p className="text-sm text-muted-foreground">
            Add one of their choices back into a lighter day, or split that day so a smaller group can go.
          </p>
          <div className="flex flex-wrap gap-2">
            <LinkButton to="/itinerary" variant="secondary">
              Adjust the plan
            </LinkButton>
            <LinkButton to="/review" variant="outline">
              Review suggestions
            </LinkButton>
          </div>
        </Card>
      ) : null}
    </AppShell>
  );
}
