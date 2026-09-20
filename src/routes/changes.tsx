import { createFileRoute, Link } from "@tanstack/react-router";
import { BellRing, CheckCircle2, History } from "lucide-react";
import { AppShell } from "@/components/kintrip/AppShell";
import { Button, Card, Chip } from "@/components/kintrip/ui";
import { acknowledgeChange } from "@/lib/kintrip/actions";
import { editableTravellers } from "@/lib/kintrip/governance";
import { useKintrip } from "@/lib/kintrip/store";

export const Route = createFileRoute("/changes")({
  head: () => ({
    meta: [
      { title: "What's changed — CommonRoute" },
      {
        name: "description",
        content: "Every change to the shared plan since it was last published, and who has seen it.",
      },
      { property: "og:title", content: "What's changed — CommonRoute" },
      { property: "og:description", content: "See what moved in the plan and tell your group you have seen it." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ChangesScreen,
});

function ChangesScreen() {
  const state = useKintrip();
  const mine = editableTravellers(state);
  const changes = state.publishedChanges ?? [];
  const nameOf = (id: string) => state.travellers.find((t) => t.id === id)?.name ?? "Someone";

  return (
    <AppShell title="What's changed" subtitle="Every update to the plan your group has already seen">
      {changes.length === 0 ? (
        <Card className="space-y-2">
          <p className="text-sm">
            Nothing has changed since the plan was shared. When a stop moves, is added or is dropped,
            it appears here with a plain description.
          </p>
          <Link to="/itinerary" className="font-semibold text-secondary">
            Open the plan →
          </Link>
        </Card>
      ) : null}

      {changes.map((c) => {
        const waiting = mine.filter((t) => !c.acknowledged.includes(t.id));
        return (
          <Card key={c.id} className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 text-lg">
                <History className="size-5 text-secondary" aria-hidden /> Version {c.version}
              </h2>
              <Chip tone={waiting.length > 0 ? "sunny" : "primary"}>
                {waiting.length > 0 ? "Not seen yet" : "Seen"}
              </Chip>
            </div>
            <p className="text-xs text-muted-foreground">
              Shared by {c.by} · {new Date(c.at).toLocaleString("en-GB")} · was version {c.previousVersion}
            </p>
            <ul className="space-y-1 text-sm">
              {c.changes.map((ch, i) => (
                <li key={i} className="flex items-start gap-2">
                  <BellRing className="mt-0.5 size-4 shrink-0 text-secondary" aria-hidden />
                  <span>
                    {ch.text}
                    {ch.affected.length > 0 ? (
                      <span className="block text-xs text-muted-foreground">
                        Affects {ch.affected.map(nameOf).join(", ")}
                      </span>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap gap-2">
              {waiting.map((t) => (
                <Button key={t.id} type="button" variant="outline" onClick={() => acknowledgeChange(c.id, t.id)}>
                  <CheckCircle2 className="size-4" aria-hidden />
                  {t.id === state.activeTravellerId ? "I've seen this" : `Seen by ${t.name}`}
                </Button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              {c.acknowledged.length} of {state.travellers.length} have said they have seen it.
            </p>
          </Card>
        );
      })}
    </AppShell>
  );
}
