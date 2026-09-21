import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { CheckCircle2, MinusCircle, Plus, Trash2, Vote, XCircle } from "lucide-react";
import { AppShell } from "@/components/kintrip/AppShell";
import { Button, Card, Chip, Field, inputClass } from "@/components/kintrip/ui";
import { useKintrip } from "@/lib/kintrip/store";
import { isOrganiser, editableTravellers } from "@/lib/kintrip/governance";
import {
  answerPoll,
  closePoll,
  createPoll,
  pollNonResponders,
  removePoll,
  reopenPoll,
  tallyPoll,
} from "@/lib/kintrip/planning";
import { trackEvent } from "@/lib/kintrip/commerce.functions";
import type { PollAnswer, PollKind } from "@/lib/kintrip/types";

/**
 * Group questions before the plan exists (P01): dates, destination, budget.
 * Remixed from the original Kintrip project.
 */

const title = "Group questions — CommonRoute";
const description = "Agree on dates, destination and budget before anyone books anything.";

export const Route = createFileRoute("/polls")({
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
  component: PollsScreen,
});

const kinds: { value: PollKind; label: string }[] = [
  { value: "dates", label: "Dates" },
  { value: "destination", label: "Where to go" },
  { value: "budget", label: "Budget" },
  { value: "other", label: "Something else" },
];

const answers: { value: PollAnswer; label: string; icon: typeof CheckCircle2 }[] = [
  { value: "yes", label: "Works", icon: CheckCircle2 },
  { value: "maybe", label: "Could work", icon: MinusCircle },
  { value: "no", label: "Doesn’t work", icon: XCircle },
];

function PollsScreen() {
  const state = useKintrip();
  const organiser = isOrganiser(state);
  const answerFor = useMemo(() => editableTravellers(state), [state]);
  const [who, setWho] = useState(state.activeTravellerId);
  const [showNew, setShowNew] = useState(false);
  const [kind, setKind] = useState<PollKind>("dates");
  const [question, setQuestion] = useState("");
  const [lines, setLines] = useState("");

  const speakingFor = answerFor.find((t) => t.id === who) ?? answerFor[0];

  function submit() {
    const options = lines
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .map((label) => ({ label }));
    createPoll({ kind, question, options });
    void trackEvent({ data: { name: "poll_created", tripId: state.trip.id, props: { step: kind } } }).catch(
      () => {},
    );
    setQuestion("");
    setLines("");
    setShowNew(false);
  }

  return (
    <AppShell
      title="Group questions"
      subtitle="Settle the big choices together before anyone books anything."
    >
      {organiser ? (
        <Card className="p-5">
          {showNew ? (
            <div className="space-y-3">
              <Field label="What are you asking?">
                <input
                  className={inputClass}
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="Which week suits everyone?"
                />
              </Field>
              <Field label="Type">
                <div className="flex flex-wrap gap-2">
                  {kinds.map((k) => (
                    <button
                      key={k.value}
                      type="button"
                      onClick={() => setKind(k.value)}
                      className="rounded-full"
                      aria-pressed={kind === k.value}
                    >
                      <Chip tone={kind === k.value ? "primary" : "neutral"}>{k.label}</Chip>
                    </button>
                  ))}
                </div>
              </Field>
              <Field label="Choices — one per line">
                <textarea
                  className={`${inputClass} min-h-28`}
                  value={lines}
                  onChange={(e) => setLines(e.target.value)}
                  placeholder={"14–21 March\n21–28 March\n4–11 April"}
                />
              </Field>
              <div className="flex gap-2">
                <Button onClick={submit}>Ask the group</Button>
                <Button variant="outline" onClick={() => setShowNew(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <Button onClick={() => setShowNew(true)}>
              <Plus className="size-5" aria-hidden /> Ask the group something
            </Button>
          )}
        </Card>
      ) : null}

      {answerFor.length > 1 ? (
        <Card className="p-4">
          <Field label="Answering as">
            <select className={inputClass} value={who} onChange={(e) => setWho(e.target.value)}>
              {answerFor.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.id === state.activeTravellerId ? `${t.name} (you)` : `${t.name} (you help them)`}
                </option>
              ))}
            </select>
          </Field>
        </Card>
      ) : null}

      {state.polls.length === 0 ? (
        <Card className="p-5">
          <p className="text-sm text-muted-foreground">
            No questions yet. Dates and destination are usually the first two worth asking.
          </p>
        </Card>
      ) : null}

      {state.polls.map((poll) => {
        const tally = tallyPoll(state, poll);
        const waiting = pollNonResponders(state, poll);
        const best = [...tally].sort((a, b) => b.score - a.score)[0];
        const mine = poll.responses[speakingFor?.id ?? ""] ?? {};
        return (
          <Card key={poll.id} className="p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <Chip tone={poll.closed ? "neutral" : "primary"}>
                  <Vote className="size-4" aria-hidden />
                  {poll.closed ? "Closed" : "Open"}
                </Chip>
                <h2 className="mt-2 text-lg">{poll.question}</h2>
              </div>
              {organiser ? (
                <button
                  type="button"
                  aria-label="Remove question"
                  onClick={() => removePoll(poll.id)}
                  className="text-muted-foreground"
                >
                  <Trash2 className="size-5" aria-hidden />
                </button>
              ) : null}
            </div>

            <ul className="mt-4 space-y-3">
              {poll.options.map((o) => {
                const t = tally.find((x) => x.optionId === o.id)!;
                const chosen = poll.decidedOptionId === o.id;
                return (
                  <li
                    key={o.id}
                    className={`rounded-2xl border p-3 ${chosen ? "border-primary bg-primary-soft" : "border-border"}`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-semibold">{o.label}</span>
                      <span className="text-sm text-muted-foreground">
                        {t.yes} works · {t.maybe} could · {t.no} can’t
                      </span>
                    </div>
                    {poll.closed ? null : (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {answers.map((a) => {
                          const active = mine[o.id] === a.value;
                          return (
                            <button
                              key={a.value}
                              type="button"
                              aria-pressed={active}
                              onClick={() => answerPoll(poll.id, o.id, a.value, speakingFor?.id)}
                              className={`flex items-center gap-1 rounded-full border px-3 py-1.5 text-sm font-semibold ${
                                active ? "border-primary bg-primary-soft" : "border-border"
                              }`}
                            >
                              <a.icon className="size-4" aria-hidden /> {a.label}
                            </button>
                          );
                        })}
                      </div>
                    )}
                    {organiser && !poll.closed ? (
                      <Button
                        variant="outline"
                        className="mt-2"
                        onClick={() => {
                          closePoll(poll.id, o.id);
                          void trackEvent({
                            data: { name: "poll_closed", tripId: state.trip.id, props: { step: poll.kind } },
                          }).catch(() => {});
                        }}
                      >
                        Go with this
                      </Button>
                    ) : null}
                  </li>
                );
              })}
            </ul>

            {waiting.length > 0 && !poll.closed ? (
              <p className="mt-3 text-sm text-muted-foreground">
                Still to answer: {waiting.map((t) => t.name).join(", ")}
              </p>
            ) : null}
            {best && !poll.closed ? (
              <p className="mt-2 text-sm font-semibold">
                Most workable so far: {best.label}. The organiser decides — this is only a count.
              </p>
            ) : null}
            {poll.closed && organiser ? (
              <Button variant="outline" className="mt-3" onClick={() => reopenPoll(poll.id)}>
                Reopen
              </Button>
            ) : null}
          </Card>
        );
      })}
    </AppShell>
  );
}
