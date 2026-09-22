import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Lock, Trash2 } from "lucide-react";
import { AppShell } from "@/components/kintrip/AppShell";
import { Button, Card, Field, inputClass } from "@/components/kintrip/ui";
import { useKintrip } from "@/lib/kintrip/store";
import { actorName, editableTravellers } from "@/lib/kintrip/governance";
import { deleteFeedback, saveFeedback } from "@/lib/kintrip/coordination.actions";
import type { TripFeedback } from "@/lib/kintrip/types";

export const Route = createFileRoute("/feedback")({
  head: () => ({
    meta: [
      { title: "After the trip — CommonRoute" },
      {
        name: "description",
        content:
          "Three optional questions after the trip. Your answers stay private unless you choose to share them.",
      },
      { property: "og:title", content: "After the trip — CommonRoute" },
      {
        property: "og:description",
        content: "Say what worked and what did not, and decide who sees it.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: FeedbackScreen,
});

const PACE: { value: NonNullable<TripFeedback["pace"]>; label: string }[] = [
  { value: "too_much", label: "Too much walking and rushing" },
  { value: "about_right", label: "About right" },
  { value: "too_little", label: "We could have done more" },
];

const DOWNTIME: { value: NonNullable<TripFeedback["downtime"]>; label: string }[] = [
  { value: "not_enough", label: "Not enough quiet time" },
  { value: "about_right", label: "About right" },
  { value: "plenty", label: "Plenty of quiet time" },
];

function FeedbackScreen() {
  const state = useKintrip();
  const people = editableTravellers(state);
  const [travellerId, setTravellerId] = useState(state.activeTravellerId);
  const [pace, setPace] = useState<TripFeedback["pace"]>(undefined);
  const [downtime, setDowntime] = useState<TripFeedback["downtime"]>(undefined);
  const [revisit, setRevisit] = useState("");
  const [share, setShare] = useState(false);
  const [applyPref, setApplyPref] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const existing = state.feedback.find((f) => f.travellerId === travellerId);
  const traveller = state.travellers.find((t) => t.id === travellerId);
  const proposed = pace === "too_much";

  return (
    <AppShell title="After the trip" subtitle="Three optional questions">
      <Card className="space-y-2">
        <p className="inline-flex items-center gap-2 text-sm font-bold">
          <Lock className="size-4 text-secondary" aria-hidden /> Private by default
        </p>
        <p className="text-sm text-muted-foreground">
          Nobody sees your answers unless you tick the box. Nothing is added up or turned into a
          score, and nothing is shown publicly.
        </p>
      </Card>

      <Card className="space-y-3">
        {people.length > 1 ? (
          <Field label="Who is answering">
            <select
              className={inputClass}
              value={travellerId}
              onChange={(e) => setTravellerId(e.target.value)}
            >
              {people.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </Field>
        ) : null}

        <Field label="How was the pace?">
          <select
            className={inputClass}
            value={pace ?? ""}
            onChange={(e) => setPace((e.target.value || undefined) as TripFeedback["pace"])}
          >
            <option value="">Rather not say</option>
            {PACE.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Was there enough quiet time?">
          <select
            className={inputClass}
            value={downtime ?? ""}
            onChange={(e) => setDowntime((e.target.value || undefined) as TripFeedback["downtime"])}
          >
            <option value="">Rather not say</option>
            {DOWNTIME.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="What would you do again? (optional)">
          <textarea
            className={inputClass}
            rows={2}
            value={revisit}
            onChange={(e) => setRevisit(e.target.value)}
          />
        </Field>

        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            className="mt-1 size-5"
            checked={share}
            onChange={(e) => setShare(e.target.checked)}
          />
          <span>Let the organisers read these answers.</span>
        </label>

        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            className="mt-1 size-5"
            checked={applyPref}
            onChange={(e) => setApplyPref(e.target.checked)}
          />
          <span>
            Update my travel preferences from this answer.
            {proposed && traveller ? (
              <span className="block text-muted-foreground">
                Pace {traveller.preferences.pace} → relaxed, walking {traveller.preferences.walking}{" "}
                → low.
              </span>
            ) : (
              <span className="block text-muted-foreground">
                Nothing would change from the answers above.
              </span>
            )}
          </span>
        </label>

        <Button
          type="button"
          onClick={() => {
            setSaved(false);
            const err = saveFeedback({
              travellerId,
              pace,
              downtime,
              revisit: revisit || undefined,
              sharedWithOrganisers: share,
              preferenceApplied: applyPref,
            });
            setError(err);
            if (!err) setSaved(true);
          }}
        >
          Save my answers
        </Button>
        {error ? <p className="text-sm font-semibold text-coral">{error}</p> : null}
        {saved ? <p className="text-sm font-semibold text-secondary">Saved.</p> : null}
      </Card>

      {existing ? (
        <Card className="space-y-2">
          <p className="font-bold">Saved answers for {actorName(state, existing.travellerId)}</p>
          <p className="text-sm text-muted-foreground">
            {existing.sharedWithOrganisers ? "Shared with organisers" : "Kept private"} ·{" "}
            {new Date(existing.at).toLocaleDateString("en-GB")}
          </p>
          <Button
            type="button"
            variant="outline"
            className="min-h-11 px-3 text-sm"
            onClick={() => deleteFeedback(existing.travellerId)}
          >
            <Trash2 className="size-4" aria-hidden /> Delete my answers
          </Button>
        </Card>
      ) : null}
    </AppShell>
  );
}
