import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ClipboardList, History, ShieldQuestion } from "lucide-react";
import { AppShell } from "@/components/kintrip/AppShell";
import { Button, Card, Chip, LinkButton, inputClass } from "@/components/kintrip/ui";
import {
  DECLINE_REASONS,
  FUNDING_LABEL,
  STATUS_LABEL,
  groupFit,
  hasSponsor,
  isOrganiser,
  tallyFor,
} from "@/lib/kintrip/governance";
import { bulkDecide, decideSuggestion } from "@/lib/kintrip/actions";
import { useKintrip } from "@/lib/kintrip/store";
import type { DeclineReasonCode, SuggestionStatus } from "@/lib/kintrip/types";

export const Route = createFileRoute("/review")({
  head: () => ({
    meta: [
      { title: "Review suggestions — CommonRoute" },
      {
        name: "description",
        content:
          "Organisers review every suggested place in one queue: group fit, cost, votes, then approve, hold, keep as backup or decline with a reason.",
      },
      { property: "og:title", content: "Review suggestions — CommonRoute" },
      {
        property: "og:description",
        content: "One queue for organisers to decide what goes into the group plan, with a clear reason each time.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ReviewPage,
});

const QUEUE: SuggestionStatus[] = ["suggested", "under_review", "provisionally_approved"];

function ReviewPage() {
  const state = useKintrip();
  const organiser = isOrganiser(state);
  const [openId, setOpenId] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [reason, setReason] = useState<DeclineReasonCode>("LOW_INTEREST");
  const [note, setNote] = useState("");
  const [privateReason, setPrivateReason] = useState(false);

  const rows = useMemo(
    () =>
      state.attractions
        .map((a) => ({ a, s: state.suggestions[a.id] }))
        .filter((r) => !!r.s)
        .sort((x, y) => groupFit(state, y.a).percent - groupFit(state, x.a).percent),
    [state],
  );

  const queue = rows.filter((r) => QUEUE.includes(r.s!.status));
  const decided = rows.filter((r) => !QUEUE.includes(r.s!.status));

  if (!organiser) {
    return (
      <AppShell title="Review suggestions" subtitle="Organisers only">
        <Card className="space-y-3">
          <p>
            Only trip organisers can approve or decline suggestions. You can still suggest places and vote —
            an organiser will confirm what makes it into the plan.
          </p>
          <LinkButton to="/discover">Back to suggesting places</LinkButton>
        </Card>
      </AppShell>
    );
  }

  return (
    <AppShell title="Review suggestions" subtitle={`${queue.length} waiting for a decision`}>
      <Card className="bg-primary-soft">
        <h2 className="flex items-center gap-2 text-lg">
          <ClipboardList className="size-5 text-primary" aria-hidden /> How this works
        </h2>
        <p className="mt-1 text-sm">
          Everyone can suggest and vote. You decide what goes in. Every decision is recorded, and the group
          sees a short reason — so nothing feels arbitrary.
        </p>
      </Card>

      {selected.length > 0 ? (
        <Card className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold">{selected.length} selected</span>
          <Button
            className="min-h-11 px-3 text-sm"
            onClick={() => {
              bulkDecide(selected, "approved");
              setSelected([]);
            }}
          >
            Approve all
          </Button>
          <Button
            variant="outline"
            className="min-h-11 px-3 text-sm"
            onClick={() => {
              bulkDecide(selected, "backup");
              setSelected([]);
            }}
          >
            Keep as backups
          </Button>
          <Button variant="ghost" className="min-h-11 px-3 text-sm" onClick={() => setSelected([])}>
            Clear
          </Button>
        </Card>
      ) : null}

      {queue.length === 0 ? (
        <Card>
          <p>Nothing is waiting for a decision right now.</p>
        </Card>
      ) : null}

      {queue.map(({ a, s }) => {
        const fit = groupFit(state, a);
        const tally = tallyFor(state, a.id);
        const open = openId === a.id;
        const needsSponsor =
          hasSponsor(state) && (s!.cost.funding === "shared" || s!.cost.funding === "major");
        return (
          <Card key={a.id} className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg">{a.name}</h2>
                <p className="text-sm text-muted-foreground">
                  {a.area}, {a.city} · {a.category}
                </p>
              </div>
              <label className="flex shrink-0 items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="size-5"
                  checked={selected.includes(a.id)}
                  onChange={(e) =>
                    setSelected((prev) => (e.target.checked ? [...prev, a.id] : prev.filter((x) => x !== a.id)))
                  }
                />
                <span className="sr-only">Select {a.name}</span>
              </label>
            </div>

            <div className="flex flex-wrap gap-2">
              <Chip tone={fit.label === "Strong" ? "lime" : fit.label === "Workable" ? "primary" : "sunny"}>
                Group fit: {fit.label} ({fit.percent}%)
              </Chip>
              <Chip tone="primary">{STATUS_LABEL[s!.status]}</Chip>
              <Chip tone="secondary">
                {s!.cost.perPerson > 0
                  ? `${s!.cost.currency} ${s!.cost.perPerson} per person · ${FUNDING_LABEL[s!.cost.funding]}`
                  : "Free"}
              </Chip>
            </div>

            <p className="text-sm text-muted-foreground">
              {tally.MUST_GO} must-go · {tally.WOULD_LIKE} would like · {tally.DONT_MIND} don&apos;t mind ·{" "}
              {tally.SKIP} skip
            </p>

            <ul className="space-y-1 text-sm">
              {fit.positives.map((p) => (
                <li key={p}>• {p}</li>
              ))}
              {fit.warnings.map((w) => (
                <li key={w} className="text-sunny-foreground">
                  ⚠ {w}
                </li>
              ))}
            </ul>

            <div className="flex flex-wrap gap-2">
              <Button
                className="min-h-11 px-3 text-sm"
                onClick={() => decideSuggestion(a.id, needsSponsor ? "sponsor_approval_required" : "approved")}
              >
                {needsSponsor ? "Send to sponsor" : "Approve"}
              </Button>
              <Button
                variant="outline"
                className="min-h-11 px-3 text-sm"
                onClick={() => decideSuggestion(a.id, "backup")}
              >
                Keep as backup
              </Button>
              <Button
                variant="outline"
                className="min-h-11 px-3 text-sm"
                onClick={() => decideSuggestion(a.id, "under_review")}
              >
                Hold
              </Button>
              <Button
                variant="ghost"
                className="min-h-11 px-3 text-sm"
                onClick={() => setOpenId(open ? null : a.id)}
              >
                Decline…
              </Button>
            </div>

            {open ? (
              <div className="space-y-2 rounded-2xl bg-muted p-3">
                <label className="block text-sm font-semibold" htmlFor={`r-${a.id}`}>
                  Reason the group will see
                </label>
                <select
                  id={`r-${a.id}`}
                  className={inputClass}
                  value={reason}
                  onChange={(e) => setReason(e.target.value as DeclineReasonCode)}
                >
                  {Object.entries(DECLINE_REASONS).map(([code, label]) => (
                    <option key={code} value={code}>
                      {label}
                    </option>
                  ))}
                </select>
                <textarea
                  className={inputClass}
                  rows={2}
                  placeholder="Add a short note (optional)"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="size-5"
                    checked={privateReason}
                    onChange={(e) => setPrivateReason(e.target.checked)}
                  />
                  Keep my note private (the group sees a neutral message)
                </label>
                <Button
                  className="min-h-11 px-3 text-sm"
                  onClick={() => {
                    decideSuggestion(a.id, "declined", { reasonCode: reason, note, privateReason });
                    setOpenId(null);
                    setNote("");
                  }}
                >
                  Confirm decline
                </Button>
              </div>
            ) : null}
          </Card>
        );
      })}

      {decided.length > 0 ? (
        <Card className="space-y-3">
          <h2 className="flex items-center gap-2 text-lg">
            <History className="size-5 text-secondary" aria-hidden /> Already decided
          </h2>
          <ul className="space-y-2 text-sm">
            {decided.map(({ a, s }) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold">{a.name}</span>
                <span className="flex items-center gap-2">
                  <Chip tone={s!.status === "declined" ? "sunny" : "lime"}>{STATUS_LABEL[s!.status]}</Chip>
                  <Button
                    variant="ghost"
                    className="min-h-10 px-2 text-sm"
                    onClick={() => decideSuggestion(a.id, "under_review")}
                  >
                    Reopen
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <Card className="space-y-2">
        <h2 className="flex items-center gap-2 text-lg">
          <ShieldQuestion className="size-5 text-secondary" aria-hidden /> Decision history
        </h2>
        {state.audit.length === 0 ? (
          <p className="text-sm text-muted-foreground">No decisions recorded yet.</p>
        ) : (
          <ul className="space-y-1 text-sm text-muted-foreground">
            {state.audit.slice(0, 12).map((e) => (
              <li key={e.id}>
                {new Date(e.at).toLocaleString("en-GB")} — {e.actorName}: {e.action} ({e.detail})
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="pb-4">
        <LinkButton to="/consensus" variant="secondary">
          Continue to the group plan
        </LinkButton>
      </div>
    </AppShell>
  );
}
