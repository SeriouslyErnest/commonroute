import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2, Footprints, Gauge, Heart, ShieldCheck } from "lucide-react";
import { AppShell } from "@/components/kintrip/AppShell";
import { Card, Chip, LinkButton } from "@/components/kintrip/ui";
import { familyWalkingLimit } from "@/lib/kintrip/engine";
import { useKintrip } from "@/lib/kintrip/store";

export const Route = createFileRoute("/family")({
  head: () => ({
    meta: [
      { title: "Your travel group — CommonRoute" },
      {
        name: "description",
        content: "See who has joined the trip, what matters to each traveller and what to plan around.",
      },
      { property: "og:title", content: "Your travel group — CommonRoute" },
      {
        property: "og:description",
        content: "Who has joined, what each traveller enjoys, and the needs the plan respects.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: FamilyTab,
});

function FamilyTab() {
  const state = useKintrip();
  const limit = familyWalkingLimit(state);

  return (
    <AppShell title="Your travel group" subtitle={`${state.travellers.length} ${state.travellers.length === 1 ? "traveller" : "travellers"} on this trip`}>
      <Card className="bg-secondary-soft">
        <h2 className="flex items-center gap-2 text-lg">
          <ShieldCheck className="size-5 text-secondary" aria-hidden /> What the plan respects
        </h2>
        <p className="mt-1 text-sm">
          Walking is kept to a <strong>{limit}</strong> level overall, with rests after busier
          stretches and a slower afternoon on the fuller days.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <LinkButton to="/preferences" variant="secondary">
            Update preferences
          </LinkButton>
          <LinkButton to="/invite" variant="outline">
            Invite more people
          </LinkButton>
        </div>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2">
        {state.travellers.map((t) => (
          <Card key={t.id} className="space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="text-lg">{t.name}</h2>
                <p className="text-sm text-muted-foreground">
                  {t.relationship} · {t.ageGroup}
                </p>
              </div>
               {t.prefStatus === "complete" ? (
                 <span className="inline-flex shrink-0 items-center gap-1 text-xs font-bold text-muted-foreground" aria-label="Preferences complete">
                   <CheckCircle2 className="size-4 text-primary" aria-hidden /> Complete
                 </span>
               ) : (
                 <Chip tone="sunny">Preferences not started</Chip>
               )}
            </div>
            <p className="flex flex-wrap gap-2 text-sm">
              {t.preferences.interests.map((i) => (
                <Chip key={i} tone="primary">
                  <Heart className="size-3" aria-hidden /> {i}
                </Chip>
              ))}
            </p>
            <p className="flex flex-wrap gap-3 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Gauge className="size-4" aria-hidden /> {t.preferences.pace} pace
              </span>
              <span className="inline-flex items-center gap-1">
                <Footprints className="size-4" aria-hidden /> {t.preferences.walking} walking
              </span>
            </p>
            {t.preferences.constraints ? (
              <p className="rounded-xl bg-muted px-3 py-2 text-sm">{t.preferences.constraints}</p>
            ) : null}
          </Card>
        ))}
      </div>

      <p className="pb-4 text-center text-sm text-muted-foreground">
        Starting a different trip?{" "}
        <Link to="/create" className="font-semibold text-secondary">
          Create a new trip
        </Link>
      </p>
    </AppShell>
  );
}
