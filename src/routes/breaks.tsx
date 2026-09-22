import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Eye, HeartHandshake, Lock, Send } from "lucide-react";
import { AppShell } from "@/components/kintrip/AppShell";
import { Button, Card, Chip, Field, inputClass } from "@/components/kintrip/ui";
import { useKintrip } from "@/lib/kintrip/store";
import { actorName, editableTravellers, isOrganiser } from "@/lib/kintrip/governance";
import {
  BREAK_LABEL,
  BREAK_STATUS_LABEL,
  breakHandlers,
  maySeeBreakNote,
  publicBreakLine,
  visibleBreakRequests,
} from "@/lib/kintrip/coordination";
import {
  acceptBreakArrangement,
  acknowledgeBreakRequest,
  cancelBreakRequest,
  proposeBreakArrangement,
  resolveBreakRequest,
  submitBreakRequest,
} from "@/lib/kintrip/coordination.actions";
import type { BreakType } from "@/lib/kintrip/types";

export const Route = createFileRoute("/breaks")({
  head: () => ({
    meta: [
      { title: "Rest and rejoin — CommonRoute" },
      {
        name: "description",
        content:
          "Ask quietly for a rest, to skip a stop or to rejoin later. Only the people who can help see the reason.",
      },
      { property: "og:title", content: "Rest and rejoin — CommonRoute" },
      {
        property: "og:description",
        content: "A private way to ask for a break, with the group told only what they need.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: BreaksScreen,
});

const TYPES: { value: BreakType; label: string }[] = [
  { value: "rest", label: "I need a rest" },
  { value: "skip_next", label: "I would rather skip the next stop" },
  { value: "join_later", label: "I will join the group later" },
];

function BreaksScreen() {
  const state = useKintrip();
  const me = state.activeTravellerId;
  const organiser = isOrganiser(state);
  const canSendFor = editableTravellers(state);
  const [travellerId, setTravellerId] = useState(me);
  const [type, setType] = useState<BreakType>("rest");
  const [note, setNote] = useState("");
  const [point, setPoint] = useState("");
  const [time, setTime] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [proposal, setProposal] = useState<Record<string, string>>({});

  const handlers = breakHandlers(state, travellerId);
  const requests = visibleBreakRequests(state);

  const send = () => {
    setError(null);
    setSent(false);
    const err = submitBreakRequest({
      travellerId,
      type,
      note: note || undefined,
      rejoinPoint: point || undefined,
      rejoinTime: time || undefined,
    });
    if (err) {
      setError(err);
      return;
    }
    setNote("");
    setPoint("");
    setTime("");
    setSent(true);
  };

  return (
    <AppShell title="Rest and rejoin" subtitle="A quiet word, not an announcement">
      <Card className="space-y-3">
        <p className="inline-flex items-center gap-2 text-sm font-bold">
          <Lock className="size-4 text-secondary" aria-hidden /> Who will see this
        </p>
        <p className="text-sm text-muted-foreground">
          {handlers.length === 0
            ? "There is nobody set up to receive this yet."
            : `${handlers
                .map((id) => actorName(state, id))
                .join(", ")} will see it. The rest of the group is only told about time and meeting changes — never the reason.`}
        </p>

        {canSendFor.length > 1 ? (
          <Field label="Who is this for">
            <select
              className={inputClass}
              value={travellerId}
              onChange={(e) => setTravellerId(e.target.value)}
            >
              {canSendFor.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </Field>
        ) : null}

        <Field label="What would help">
          <select className={inputClass} value={type} onChange={(e) => setType(e.target.value as BreakType)}>
            {TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Anything you want them to know (private, optional)">
          <textarea
            className={inputClass}
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Only the people above will read this."
          />
        </Field>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Where you would rejoin (optional)">
            <input className={inputClass} value={point} onChange={(e) => setPoint(e.target.value)} />
          </Field>
          <Field label="When (optional)">
            <input
              className={inputClass}
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
            />
          </Field>
        </div>

        <Button type="button" onClick={send}>
          <Send className="size-4" aria-hidden /> Send quietly
        </Button>
        {error ? <p className="text-sm font-semibold text-coral">{error}</p> : null}
        {sent ? (
          <p className="text-sm font-semibold text-secondary">
            Sent. It is marked as sent only now that it has been recorded.
          </p>
        ) : null}
      </Card>

      <h2 className="text-lg">Requests you can see</h2>
      {requests.length === 0 ? (
        <Card>
          <p className="text-sm">Nothing at the moment.</p>
        </Card>
      ) : (
        requests.map((r) => {
          const mine = r.travellerId === me || r.actorId === me;
          const mayHandle = r.handlerIds.includes(me) || organiser;
          return (
            <Card key={r.id} className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-bold">
                  {actorName(state, r.travellerId)} · {BREAK_LABEL[r.type]}
                </p>
                <Chip tone={r.status === "resolved" ? "lime" : "sunny"}>
                  {BREAK_STATUS_LABEL[r.status]}
                </Chip>
              </div>
              {r.actorId !== r.travellerId ? (
                <p className="text-xs text-muted-foreground">
                  Sent by {actorName(state, r.actorId)} on their behalf
                </p>
              ) : null}
              {r.note && maySeeBreakNote(state, r) ? (
                <p className="rounded-xl bg-muted p-3 text-sm">
                  <Lock className="mr-1 inline size-3.5" aria-hidden />
                  {r.note}
                </p>
              ) : null}
              {r.rejoinPoint ? (
                <p className="text-sm text-muted-foreground">
                  Would rejoin at {r.rejoinPoint}
                  {r.rejoinTime ? ` at ${r.rejoinTime}` : ""}.
                </p>
              ) : null}
              {r.proposal ? (
                <div className="rounded-xl bg-primary-soft p-3 text-sm">
                  <p className="font-semibold">{r.proposal.text}</p>
                  {r.proposal.unverified.length > 0 ? (
                    <p className="mt-1 text-muted-foreground">
                      Not checked yet: {r.proposal.unverified.join(", ")}
                    </p>
                  ) : null}
                  <p className="mt-1 text-xs text-muted-foreground">
                    Suggested by {r.proposal.by}
                    {r.proposal.acknowledged ? " · accepted" : ""}
                  </p>
                </div>
              ) : null}

              <div className="flex flex-wrap gap-2">
                {mayHandle && r.status === "submitted" ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-11 px-3 text-sm"
                    onClick={() => acknowledgeBreakRequest(r.id)}
                  >
                    <Eye className="size-4" aria-hidden /> I have seen this
                  </Button>
                ) : null}
                {mine && r.proposal && !r.proposal.acknowledged ? (
                  <Button
                    type="button"
                    className="min-h-11 px-3 text-sm"
                    onClick={() => acceptBreakArrangement(r.id)}
                  >
                    That works
                  </Button>
                ) : null}
                {mine && r.status !== "resolved" && r.status !== "cancelled" ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-11 px-3 text-sm"
                    onClick={() => cancelBreakRequest(r.id)}
                  >
                    Withdraw
                  </Button>
                ) : null}
              </div>

              {mayHandle && r.status !== "resolved" && r.status !== "cancelled" ? (
                <div className="space-y-2 border-t border-border pt-3">
                  <Field label="Suggest an arrangement">
                    <input
                      className={inputClass}
                      value={proposal[r.id] ?? ""}
                      onChange={(e) => setProposal((p) => ({ ...p, [r.id]: e.target.value }))}
                      placeholder="Rest at the cafe, rejoin at the gate at 15:00"
                    />
                  </Field>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="min-h-11 px-3 text-sm"
                      onClick={() =>
                        proposeBreakArrangement(r.id, {
                          text: proposal[r.id] ?? "",
                          checks: [],
                          unverified: ["Step-free access", "Seating at the meeting point"],
                        })
                      }
                    >
                      <HeartHandshake className="size-4" aria-hidden /> Suggest this
                    </Button>
                    <Button
                      type="button"
                      className="min-h-11 px-3 text-sm"
                      onClick={() => resolveBreakRequest(r.id, proposal[r.id] ?? "", true)}
                    >
                      Sorted — tell the group the new meeting time
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    The group will read: “{publicBreakLine(state, r)}”
                  </p>
                </div>
              ) : null}
            </Card>
          );
        })
      )}
    </AppShell>
  );
}
