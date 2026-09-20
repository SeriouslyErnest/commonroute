import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { CheckCircle2, ClipboardList, Clock, Luggage, Plus, Trash2 } from "lucide-react";
import { AppShell } from "@/components/kintrip/AppShell";
import { Button, Card, Chip, Field, inputClass } from "@/components/kintrip/ui";
import {
  PACKING_TEMPLATES,
  addPackingItem,
  addTask,
  applyPackingTemplate,
  assignTask,
  cancelTask,
  commitPackingQuantity,
  removePackingItem,
  respondToTask,
  setPackingPacked,
  setTaskComplete,
} from "@/lib/kintrip/actions";
import { actorName, canEditFor, isOrganiser } from "@/lib/kintrip/governance";
import { useKintrip } from "@/lib/kintrip/store";
import type { PackingItem, TaskState } from "@/lib/kintrip/types";

export const Route = createFileRoute("/getting-ready")({
  head: () => ({
    meta: [
      { title: "Getting ready — CommonRoute" },
      {
        name: "description",
        content: "Share out the jobs before the trip and keep one packing list for the whole group.",
      },
      { property: "og:title", content: "Getting ready — CommonRoute" },
      {
        property: "og:description",
        content: "Who is doing what, by when, and who is bringing the shared things.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: GettingReadyScreen,
});

const STATE_LABEL: Record<TaskState, string> = {
  unassigned: "Nobody yet",
  awaiting_acceptance: "Waiting to be accepted",
  accepted: "Accepted",
  complete: "Done",
  cancelled: "Cancelled",
};

const isOverdue = (deadline: string | undefined, state: TaskState) =>
  !!deadline && state === "accepted" && new Date(deadline) < new Date();

function GettingReadyScreen() {
  const state = useKintrip();
  const me = state.activeTravellerId;
  const organiser = isOrganiser(state);
  const [task, setTask] = useState({ title: "", assigneeId: "", deadline: "" });
  const [item, setItem] = useState({ label: "", scope: "shared" as PackingItem["scope"], quantityNeeded: 1 });
  const [conflict, setConflict] = useState<string | null>(null);

  const visiblePacking = state.packing.filter((p) => {
    if (p.scope === "shared") return true;
    if (!p.travellerId) return true;
    if (p.visibility === "group") return true;
    if (p.visibility === "organisers") return organiser || canEditFor(state, p.travellerId);
    return canEditFor(state, p.travellerId);
  });
  const shared = visiblePacking.filter((p) => p.scope === "shared");
  const personal = visiblePacking.filter((p) => p.scope !== "shared");
  const overdue = state.tasks.filter((t) => isOverdue(t.deadline, t.state));

  return (
    <AppShell title="Getting ready" subtitle="Jobs to share out and things to bring">
      {organiser && overdue.length > 0 ? (
        <Card className="bg-sunny-soft">
          <p className="text-sm">
            <strong>{overdue.length}</strong> accepted{" "}
            {overdue.length === 1 ? "job is" : "jobs are"} past their date. A quiet nudge may help — this
            note is only shown to organisers.
          </p>
        </Card>
      ) : null}

      <Card className="space-y-3">
        <h2 className="flex items-center gap-2 text-lg">
          <ClipboardList className="size-5 text-primary" aria-hidden /> Jobs
        </h2>
        <p className="text-sm text-muted-foreground">
          Taking on a job never gives anyone the power to approve spending.
        </p>

        <div className="grid gap-2 sm:grid-cols-[2fr_1fr_1fr_auto] sm:items-end">
          <Field label="What needs doing?">
            <input
              className={inputClass}
              value={task.title}
              onChange={(e) => setTask({ ...task, title: e.target.value })}
              placeholder="Book the airport transfer"
            />
          </Field>
          <Field label="Who?">
            <select
              className={inputClass}
              value={task.assigneeId}
              onChange={(e) => setTask({ ...task, assigneeId: e.target.value })}
            >
              <option value="">Nobody yet</option>
              {state.travellers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="By when?">
            <input
              type="date"
              className={inputClass}
              value={task.deadline}
              onChange={(e) => setTask({ ...task, deadline: e.target.value })}
            />
          </Field>
          <Button
            type="button"
            onClick={() => {
              if (!task.title.trim()) return;
              addTask({
                title: task.title,
                assigneeId: task.assigneeId || undefined,
                deadline: task.deadline || undefined,
              });
              setTask({ title: "", assigneeId: "", deadline: "" });
            }}
          >
            <Plus className="size-4" aria-hidden /> Add
          </Button>
        </div>

        {state.tasks.length === 0 ? (
          <p className="text-sm text-muted-foreground">No jobs yet.</p>
        ) : (
          <ul className="space-y-2">
            {state.tasks.map((t) => (
              <li key={t.id} className="rounded-xl bg-muted px-3 py-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold">{t.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {t.assigneeId ? actorName(state, t.assigneeId) : "Nobody yet"}
                      {t.deadline ? ` · by ${t.deadline}` : ""}
                    </p>
                  </div>
                  <span className="flex flex-wrap items-center gap-2">
                    <Chip tone={t.state === "complete" ? "lime" : t.state === "cancelled" ? "sunny" : "primary"}>
                      {STATE_LABEL[t.state]}
                    </Chip>
                    {isOverdue(t.deadline, t.state) ? (
                      <Chip tone="sunny">
                        <Clock className="size-3" aria-hidden /> Past its date
                      </Chip>
                    ) : null}
                  </span>
                </div>

                <div className="mt-2 flex flex-wrap gap-2">
                  {t.assigneeId === me && t.state === "awaiting_acceptance" ? (
                    <>
                      <Button type="button" onClick={() => respondToTask(t.id, true)}>
                        I&apos;ll do it
                      </Button>
                      <Button type="button" variant="outline" onClick={() => respondToTask(t.id, false)}>
                        I can&apos;t
                      </Button>
                    </>
                  ) : null}
                  {(t.assigneeId === me || organiser) && (t.state === "accepted" || t.state === "complete") ? (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setTaskComplete(t.id, t.state !== "complete")}
                    >
                      <CheckCircle2 className="size-4" aria-hidden />
                      {t.state === "complete" ? "Not done after all" : "Mark as done"}
                    </Button>
                  ) : null}
                  {organiser && t.state === "unassigned" ? (
                    <select
                      className={inputClass}
                      value=""
                      onChange={(e) => e.target.value && assignTask(t.id, e.target.value)}
                      aria-label={`Ask someone to do ${t.title}`}
                    >
                      <option value="">Ask someone…</option>
                      {state.travellers.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  ) : null}
                  {organiser && t.state !== "cancelled" && t.state !== "complete" ? (
                    <Button type="button" variant="outline" onClick={() => cancelTask(t.id)}>
                      Not needed
                    </Button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="space-y-3">
        <h2 className="flex items-center gap-2 text-lg">
          <Luggage className="size-5 text-primary" aria-hidden /> Packing
        </h2>
        <p className="text-sm text-muted-foreground">
          Starting lists are a helping hand, not a complete list — add whatever your group needs.
        </p>
        <div className="flex flex-wrap gap-2">
          {Object.keys(PACKING_TEMPLATES).map((name) => (
            <Button key={name} type="button" variant="outline" onClick={() => applyPackingTemplate(name)}>
              Add the {name.toLowerCase()} list
            </Button>
          ))}
        </div>

        <div className="grid gap-2 sm:grid-cols-[2fr_1fr_1fr_auto] sm:items-end">
          <Field label="Item">
            <input
              className={inputClass}
              value={item.label}
              onChange={(e) => setItem({ ...item, label: e.target.value })}
              placeholder="Travel adapter"
            />
          </Field>
          <Field label="For whom?">
            <select
              className={inputClass}
              value={item.scope}
              onChange={(e) => setItem({ ...item, scope: e.target.value as PackingItem["scope"] })}
            >
              <option value="shared">Shared by the group</option>
              <option value="personal">Just for me</option>
              <option value="dependent">For someone I help</option>
            </select>
          </Field>
          <Field label="How many?">
            <input
              type="number"
              min={1}
              className={inputClass}
              value={item.quantityNeeded}
              disabled={item.scope !== "shared"}
              onChange={(e) => setItem({ ...item, quantityNeeded: Number(e.target.value) })}
            />
          </Field>
          <Button
            type="button"
            onClick={() => {
              if (!item.label.trim()) return;
              addPackingItem({
                label: item.label,
                scope: item.scope,
                travellerId: item.scope === "shared" ? undefined : me,
                quantityNeeded: item.quantityNeeded,
              });
              setItem({ ...item, label: "" });
            }}
          >
            <Plus className="size-4" aria-hidden /> Add
          </Button>
        </div>

        {conflict ? (
          <p className="rounded-xl bg-sunny-soft px-3 py-2 text-sm">{conflict}</p>
        ) : null}

        <h3 className="text-base font-extrabold">Shared things</h3>
        {shared.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing shared yet.</p>
        ) : (
          <ul className="space-y-2">
            {shared.map((p) => {
              const needed = p.quantityNeeded ?? 1;
              const committed = p.quantityCommitted ?? 0;
              return (
                <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-muted px-3 py-2">
                  <div>
                    <p className="font-semibold">{p.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {committed} of {needed} covered
                      {p.responsibleId ? ` · ${actorName(state, p.responsibleId)} is bringing it` : ""}
                    </p>
                  </div>
                  <span className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      disabled={committed >= needed}
                      onClick={() => {
                        const ok = commitPackingQuantity(p.id, 1, p.version);
                        setConflict(
                          ok
                            ? null
                            : "Someone else claimed this first. Your screen has been refreshed — check what is still needed.",
                        );
                      }}
                    >
                      I&apos;ll bring one
                    </Button>
                    <Button type="button" variant="outline" onClick={() => setPackingPacked(p.id, !p.packed)}>
                      {p.packed ? "Packed" : "Mark as packed"}
                    </Button>
                    {organiser ? (
                      <Button type="button" variant="outline" onClick={() => removePackingItem(p.id)}>
                        <Trash2 className="size-4" aria-hidden />
                      </Button>
                    ) : null}
                  </span>
                </li>
              );
            })}
          </ul>
        )}

        <h3 className="text-base font-extrabold">Personal things</h3>
        {personal.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing on your personal list yet.</p>
        ) : (
          <ul className="space-y-2">
            {personal.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-muted px-3 py-2">
                <div>
                  <p className="font-semibold">{p.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {p.scope === "dependent" && p.travellerId
                      ? `For ${actorName(state, p.travellerId)}`
                      : "Private to you"}
                  </p>
                </div>
                <span className="flex gap-2">
                  <Button type="button" variant="outline" onClick={() => setPackingPacked(p.id, !p.packed)}>
                    {p.packed ? "Packed" : "Mark as packed"}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => removePackingItem(p.id)}>
                    <Trash2 className="size-4" aria-hidden />
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </AppShell>
  );
}
