import { createFileRoute } from "@tanstack/react-router";
import { Check, TriangleAlert } from "lucide-react";
import { AppShell } from "@/components/kintrip/AppShell";
import { Card, Chip } from "@/components/kintrip/ui";
import { VOTE_LABEL, groupFit, tallyFor } from "@/lib/kintrip/governance";
import { useKintrip } from "@/lib/kintrip/store";

export const Route = createFileRoute("/fit/$attractionId")({
  head: () => ({
    meta: [
      { title: "Why this fits the group — CommonRoute" },
      {
        name: "description",
        content: "A plain-language breakdown of how well one place works for everyone travelling.",
      },
      { property: "og:title", content: "Why this fits the group — CommonRoute" },
      {
        property: "og:description",
        content: "See what works, what to watch, and how the group voted on this place.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: FitScreen,
});

function FitScreen() {
  const { attractionId } = Route.useParams();
  const state = useKintrip();
  const attraction = state.attractions.find((a) => a.id === attractionId);

  if (!attraction) {
    return (
      <AppShell title="Place not found" back={{ to: "/discover", label: "Back to discover" }}>
        <Card>
          <p className="text-sm text-muted-foreground">This place is no longer on the shortlist.</p>
        </Card>
      </AppShell>
    );
  }

  const fit = groupFit(state, attraction);
  const tally = tallyFor(state, attraction.id);

  return (
    <AppShell
      title={attraction.name}
      subtitle={`${attraction.area}, ${attraction.city} · ${attraction.category}`}
      back={{ to: "/discover", label: "Back to discover" }}
    >
      <Card className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Chip tone={fit.label === "Strong" ? "lime" : fit.label === "Workable" ? "primary" : "sunny"}>
            Group fit: {fit.label} ({fit.percent}%)
          </Chip>
        </div>
        <p className="text-sm text-muted-foreground">
          This score blends how many people want to go with walking effort, cost, weather cover and anyone&apos;s
          stated limits.
        </p>
      </Card>

      <Card className="space-y-2">
        <h2 className="text-lg">What works</h2>
        {fit.positives.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing stands out yet — the group hasn&apos;t voted much.</p>
        ) : (
          <ul className="space-y-1.5 text-sm">
            {fit.positives.map((p) => (
              <li key={p} className="flex gap-2">
                <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden /> {p}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="space-y-2">
        <h2 className="text-lg">What to watch</h2>
        {fit.warnings.length === 0 ? (
          <p className="text-sm text-muted-foreground">No concerns recorded for this place.</p>
        ) : (
          <ul className="space-y-1.5 text-sm">
            {fit.warnings.map((w) => (
              <li key={w} className="flex gap-2">
                <TriangleAlert className="mt-0.5 size-4 shrink-0 text-sunny" aria-hidden /> {w}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="space-y-2">
        <h2 className="text-lg">How the group voted</h2>
        <ul className="space-y-1 text-sm">
          {state.travellers.map((t) => {
            const vote = state.votes[t.id]?.[attraction.id];
            return (
              <li key={t.id} className="flex items-center justify-between gap-2 border-b border-border pb-1 last:border-0">
                <span className="font-semibold">{t.name}</span>
                <span className="text-muted-foreground">{vote ? VOTE_LABEL[vote] : "Not voted yet"}</span>
              </li>
            );
          })}
        </ul>
        <p className="text-sm text-muted-foreground">
          {tally.MUST_GO} must-go · {tally.WOULD_LIKE} would like · {tally.DONT_MIND} don&apos;t mind · {tally.SKIP} skip
        </p>
      </Card>
    </AppShell>
  );
}
