import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Wallet } from "lucide-react";
import { AppShell } from "@/components/kintrip/AppShell";
import { Button, Card, Chip, LinkButton, inputClass } from "@/components/kintrip/ui";
import { approvedSpend, isSponsor, STATUS_LABEL, tallyFor } from "@/lib/kintrip/governance";
import { recordSponsorDecision } from "@/lib/kintrip/actions";
import { useKintrip } from "@/lib/kintrip/store";

export const Route = createFileRoute("/sponsor")({
  head: () => ({
    meta: [
      { title: "Money decisions — CommonRoute" },
      {
        name: "description",
        content:
          "The person paying approves shared costs before anything is booked, and can say whether the group covers it or each traveller pays.",
      },
      { property: "og:title", content: "Money decisions — CommonRoute" },
      {
        property: "og:description",
        content: "Approve shared costs before anything is booked, with a running total against the budget.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SponsorPage,
});

function SponsorPage() {
  const state = useKintrip();
  const sponsor = isSponsor(state);
  const spend = approvedSpend(state);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const waiting = state.attractions.filter(
    (a) => state.suggestions[a.id]?.status === "sponsor_approval_required",
  );
  const people = Math.max(1, state.travellers.length);

  return (
    <AppShell title="Money decisions" subtitle={sponsor ? "You approve shared costs" : "Who pays, and what is agreed"}>
      <Card className="bg-secondary-soft">
        <h2 className="flex items-center gap-2 text-lg">
          <Wallet className="size-5 text-secondary" aria-hidden /> Running total
        </h2>
        <p className="mt-1 text-sm">
          Approved shared spending: <strong>{spend.currency} {spend.total}</strong>
          {state.decisions.sharedBudget ? ` of a ${spend.currency} ${state.decisions.sharedBudget} budget` : ""}.
          {spend.pending > 0 ? ` Another ${spend.currency} ${spend.pending} is still waiting for a decision.` : ""}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Figures are estimates unless a price has been confirmed.
        </p>
      </Card>

      {waiting.length === 0 ? (
        <Card>
          <p>Nothing is waiting for a money decision.</p>
        </Card>
      ) : null}

      {waiting.map((a) => {
        const s = state.suggestions[a.id]!;
        const tally = tallyFor(state, a.id);
        const total = s.cost.perPerson * people;
        return (
          <Card key={a.id} className="space-y-3">
            <div>
              <h2 className="text-lg">{a.name}</h2>
              <p className="text-sm text-muted-foreground">
                {a.area}, {a.city} · {tally.MUST_GO} must-go · {tally.WOULD_LIKE} would like
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Chip tone="secondary">
                {s.cost.currency} {s.cost.perPerson} per person
              </Chip>
              <Chip tone="primary">
                About {s.cost.currency} {total} for {people} travellers
              </Chip>
              <Chip tone="sunny">{STATUS_LABEL[s.status]}</Chip>
            </div>
            {s.cost.bookingDeadline ? (
              <p className="text-sm">Booking deadline: {s.cost.bookingDeadline}</p>
            ) : null}

            {sponsor ? (
              <div className="space-y-2">
                <textarea
                  className={inputClass}
                  rows={2}
                  placeholder="Add a note for the group (optional)"
                  value={notes[a.id] ?? ""}
                  onChange={(e) => setNotes((prev) => ({ ...prev, [a.id]: e.target.value }))}
                />
                <div className="flex flex-wrap gap-2">
                  <Button
                    className="min-h-11 px-3 text-sm"
                    onClick={() => recordSponsorDecision(a.id, "group_funded", total, notes[a.id])}
                  >
                    I&apos;ll cover this for the group
                  </Button>
                  <Button
                    variant="outline"
                    className="min-h-11 px-3 text-sm"
                    onClick={() => recordSponsorDecision(a.id, "individually_paid", total, notes[a.id])}
                  >
                    Everyone pays their own
                  </Button>
                  <Button
                    variant="outline"
                    className="min-h-11 px-3 text-sm"
                    onClick={() => recordSponsorDecision(a.id, "hold", total, notes[a.id])}
                  >
                    Hold for now
                  </Button>
                  <Button
                    variant="ghost"
                    className="min-h-11 px-3 text-sm"
                    onClick={() => recordSponsorDecision(a.id, "declined", total, notes[a.id])}
                  >
                    Not this trip
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Waiting for the person covering costs to decide.
              </p>
            )}
          </Card>
        );
      })}

      {state.sponsorApprovals.length > 0 ? (
        <Card className="space-y-2">
          <h2 className="text-lg">Money decisions so far</h2>
          <ul className="space-y-1 text-sm text-muted-foreground">
            {state.sponsorApprovals.map((x) => (
              <li key={x.id}>
                {state.attractions.find((a) => a.id === x.suggestionId)?.name ?? "A place"} —{" "}
                {x.decision.replace(/_/g, " ")} ({x.currency} {x.amount}) by {x.sponsorName}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <div className="pb-4">
        <LinkButton to="/review" variant="secondary">
          Back to the review queue
        </LinkButton>
      </div>
    </AppShell>
  );
}
