import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { GitCompare, Star, Trash2, TriangleAlert } from "lucide-react";
import { AppShell } from "@/components/kintrip/AppShell";
import { Button, Card, Chip } from "@/components/kintrip/ui";
import { PaidGate, AllowanceNote } from "@/components/kintrip/PaidGate";
import { useKintrip } from "@/lib/kintrip/store";
import { isOrganiser } from "@/lib/kintrip/governance";
import { removeScenario, saveScenarios } from "@/lib/kintrip/planning";
import { buildScenarios } from "@/lib/kintrip/compare";
import { useCommerce } from "@/lib/kintrip/useCommerce";
import { rateAdvancedJob } from "@/lib/kintrip/commerce.functions";

/**
 * Side-by-side plan alternatives (P07). Remixed from the original Kintrip
 * project.
 *
 * Alternatives are suggestions only. Accepting one creates a draft for the
 * owner to publish — nothing here changes the shared plan by itself.
 */

const title = "Compare plans — CommonRoute";
const description = "See up to three alternative versions of your plan side by side before changing anything.";

export const Route = createFileRoute("/scenarios")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ScenariosScreen,
});

function ScenariosScreen() {
  const state = useKintrip();
  const organiser = isOrganiser(state);
  const { runJob } = useCommerce();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const baseline = state.itinerary?.version ?? 0;

  async function generate() {
    setBusy(true);
    setStatus(null);
    const hash = `${baseline}:${state.itinerary?.days.length ?? 0}`;
    const outcome = await runJob("scenarios", hash, () =>
      buildScenarios(state, state.activeTravellerId),
    );
    if (outcome.ok) {
      if (outcome.result.length === 0) {
        setStatus("There is nothing worth changing in this plan right now.");
      } else {
        saveScenarios(outcome.result);
      }
    } else {
      setStatus(
        outcome.reason === "exhausted"
          ? "This trip has used all its advanced comparisons. Everything else keeps working."
          : outcome.reason === "locked"
            ? "Comparing plans is part of Trip Plus."
            : "That did not finish, so nothing was counted. Please try again.",
      );
    }
    setBusy(false);
  }

  if (!state.itinerary) {
    return (
      <AppShell title="Compare plans">
        <Card className="p-5">
          <p className="text-sm text-muted-foreground">
            Build a plan first. Alternatives are always worked out from the plan the group already has.
          </p>
        </Card>
      </AppShell>
    );
  }

  return (
    <AppShell title="Compare plans" subtitle="Up to three alternatives, worked out from the plan you have now.">
      <PaidGate
        feature="scenarios"
        preview="Produces up to three alternative versions of your plan — calmer, less travelling, or a shorter day for someone who tires — with the trade-offs written out."
      >
        <Card className="p-5">
          <h2 className="text-lg">Work out some alternatives</h2>
          <AllowanceNote />
          <Button className="mt-3" disabled={busy} onClick={() => void generate()}>
            <GitCompare className="size-5" aria-hidden /> {busy ? "Working…" : "Suggest alternatives"}
          </Button>
          {status ? <p className="mt-3 text-sm font-semibold">{status}</p> : null}
        </Card>
      </PaidGate>

      {state.scenarios.map((s) => (
        <Card key={s.id} className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <Chip tone={s.outdated ? "neutral" : "primary"}>
                {s.outdated ? "Based on an older plan" : `From version ${s.baselineRevision}`}
              </Chip>
              <h3 className="mt-2 text-lg">{s.label}</h3>
            </div>
            {organiser ? (
              <button type="button" aria-label={`Remove ${s.label}`} onClick={() => removeScenario(s.id)} className="text-muted-foreground">
                <Trash2 className="size-5" aria-hidden />
              </button>
            ) : null}
          </div>
          <p className="mt-2 text-sm">{s.summary}</p>
          <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
            {s.changes.map((c) => (
              <li key={c}>· {c}</li>
            ))}
          </ul>
          <p className="mt-2 text-sm">
            Travelling time:{" "}
            {s.travelMinutesDelta == null
              ? "about the same, as far as we can tell"
              : `${s.travelMinutesDelta} minutes`}
          </p>
          {s.warnings.map((w) => (
            <p key={w} className="mt-2 flex items-start gap-2 text-sm text-secondary">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden /> {w}
            </p>
          ))}
          {s.outdated ? (
            <p className="mt-2 text-sm text-muted-foreground">
              The plan has changed since this was worked out, so it is kept for reference only.
            </p>
          ) : null}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted-foreground">Was this useful?</span>
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                aria-label={`Rate ${n} out of 5`}
                onClick={() => void rateAdvancedJob({ data: { tripId: state.trip.id, jobId: s.id, rating: n } }).catch(() => {})}
                className="text-secondary"
              >
                <Star className="size-5" aria-hidden />
              </button>
            ))}
          </div>
        </Card>
      ))}
    </AppShell>
  );
}
