import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ExternalLink, LayoutList, ListChecks } from "lucide-react";
import { AppShell } from "@/components/kintrip/AppShell";
import { Button, Card, Chip } from "@/components/kintrip/ui";
import { useKintrip } from "@/lib/kintrip/store";
import { isOrganiser } from "@/lib/kintrip/governance";
import { PACKING_TEMPLATES, addTask, applyPackingTemplate } from "@/lib/kintrip/actions";
import { addMilestone } from "@/lib/kintrip/planning";
import { trackEvent } from "@/lib/kintrip/commerce.functions";

/**
 * Starter lists (P10) and disclosed outside links (P18).
 * Remixed from the original Kintrip project.
 *
 * Every list is a starting point the group edits, never a complete answer.
 * Outside links are labelled plainly and never affect any ranking or approval.
 */

const title = "Starter lists — CommonRoute";
const description = "Add a ready-made packing list, a set of jobs or the usual deadlines, then edit freely.";

export const Route = createFileRoute("/templates")({
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
  component: TemplatesScreen,
});

const JOB_TEMPLATES: Record<string, string[]> = {
  "Before you go": [
    "Check everyone’s passport expiry dates",
    "Arrange travel insurance",
    "Confirm who is bringing the first aid kit",
    "Share the plan with anyone staying home",
  ],
  "Travelling with older relatives": [
    "Check step-free access at each stop",
    "Pack a written medication list",
    "Agree a meeting point for each day",
    "Book seats together where possible",
  ],
  "Travelling with young children": [
    "Pack snacks and spare clothes for each day",
    "Check pram access on the routes",
    "Agree nap or quiet time in the plan",
  ],
};

function daysBefore(date: string, days: number): string {
  const ms = Date.parse(`${date}T00:00:00Z`);
  if (Number.isNaN(ms)) return date;
  return new Date(ms - days * 24 * 3600 * 1000).toISOString().slice(0, 10);
}

const LINKS = [
  {
    label: "TripIt Pro pricing",
    url: "https://www.tripit.com/web/pro/pricing",
    note: "For comparison only. We are not connected to them and earn nothing from this link.",
  },
  {
    label: "Tricount — splitting shared costs",
    url: "https://www.tricount.com/",
    note: "A separate free tool some groups use alongside CommonRoute. No payment or partnership involved.",
  },
];

function TemplatesScreen() {
  const state = useKintrip();
  const organiser = isOrganiser(state);
  const [done, setDone] = useState<string | null>(null);

  function applyJobs(name: string) {
    for (const t of JOB_TEMPLATES[name] ?? []) addTask({ title: t });
    setDone(`Added ${JOB_TEMPLATES[name]?.length ?? 0} jobs from “${name}”.`);
    void trackEvent({ data: { name: "template_used", tripId: state.trip.id, props: { step: "jobs" } } }).catch(
      () => {},
    );
  }

  function applyDeadlines() {
    const start = state.trip.startDate;
    addMilestone({ title: "Book flights or trains", dueDate: daysBefore(start, 90), kind: "booking" });
    addMilestone({ title: "Confirm where everyone is staying", dueDate: daysBefore(start, 60), kind: "booking" });
    addMilestone({ title: "Settle shared payments so far", dueDate: daysBefore(start, 30), kind: "payment" });
    addMilestone({ title: "Check passports and any visas", dueDate: daysBefore(start, 45), kind: "document" });
    setDone("Added four usual deadlines, counted back from your start date.");
    void trackEvent({
      data: { name: "template_used", tripId: state.trip.id, props: { step: "deadlines" } },
    }).catch(() => {});
  }

  return (
    <AppShell title="Starter lists" subtitle="A head start you can edit. Nothing here is a complete list.">
      {done ? (
        <Card className="bg-primary-soft p-4">
          <p className="text-sm font-semibold">{done}</p>
        </Card>
      ) : null}

      <Card className="p-5">
        <Chip tone="secondary">
          <LayoutList className="size-4" aria-hidden /> Packing
        </Chip>
        <div className="mt-3 flex flex-wrap gap-2">
          {Object.keys(PACKING_TEMPLATES).map((name) => (
            <Button
              key={name}
              variant="outline"
              onClick={() => {
                applyPackingTemplate(name);
                setDone(`Added the “${name}” packing list.`);
                void trackEvent({
                  data: { name: "template_used", tripId: state.trip.id, props: { step: "packing" } },
                }).catch(() => {});
              }}
            >
              {name}
            </Button>
          ))}
        </div>
      </Card>

      <Card className="p-5">
        <Chip tone="secondary">
          <ListChecks className="size-4" aria-hidden /> Jobs
        </Chip>
        <div className="mt-3 flex flex-wrap gap-2">
          {Object.keys(JOB_TEMPLATES).map((name) => (
            <Button key={name} variant="outline" onClick={() => applyJobs(name)}>
              {name}
            </Button>
          ))}
        </div>
      </Card>

      {organiser ? (
        <Card className="p-5">
          <Chip tone="secondary">Deadlines</Chip>
          <p className="mt-2 text-sm text-muted-foreground">
            Adds the deadlines most groups need, counted back from {state.trip.startDate || "your start date"}.
          </p>
          <Button variant="outline" className="mt-3" onClick={applyDeadlines}>
            Add the usual deadlines
          </Button>
        </Card>
      ) : null}

      <Card className="p-5">
        <h2 className="text-lg">Links to other tools</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          These are outside websites. CommonRoute earns nothing from them, and they never affect what your
          group is shown or what gets approved.
        </p>
        <ul className="mt-3 space-y-3">
          {LINKS.map((l) => (
            <li key={l.url}>
              <a
                href={l.url}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex items-center gap-2 font-semibold text-secondary underline"
              >
                {l.label} <ExternalLink className="size-4" aria-hidden />
              </a>
              <p className="text-sm text-muted-foreground">{l.note}</p>
            </li>
          ))}
        </ul>
      </Card>
    </AppShell>
  );
}
