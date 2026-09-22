import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AlertTriangle, Link2, ShieldAlert, Trash2 } from "lucide-react";
import { AppShell } from "@/components/kintrip/AppShell";
import { Button, Card, Chip, Field, inputClass } from "@/components/kintrip/ui";
import { useKintrip } from "@/lib/kintrip/store";
import {
  canManageLogistics,
  dependencyStateFor,
  refLabel,
  refSatisfied,
} from "@/lib/kintrip/coordination";
import {
  addDependency,
  removeDependency,
  waiveDependency,
  warnAboutDescendants,
} from "@/lib/kintrip/coordination.actions";
import type { DependencyRef } from "@/lib/kintrip/types";

export const Route = createFileRoute("/dependencies")({
  head: () => ({
    meta: [
      { title: "What waits for what — CommonRoute" },
      {
        name: "description",
        content:
          "Record which bookings and jobs depend on others, so a slipped flight shows everything it puts at risk.",
      },
      { property: "og:title", content: "What waits for what — CommonRoute" },
      {
        property: "og:description",
        content: "Booking order made plain, with nothing ever cancelled automatically.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DependenciesScreen,
});

const refKey = (r: DependencyRef) => `${r.kind}:${r.id}`;
const parseRef = (value: string): DependencyRef | null => {
  const [kind, id] = value.split(":");
  if ((kind !== "booking" && kind !== "task") || !id) return null;
  return { kind, id };
};

function DependenciesScreen() {
  const state = useKintrip();
  const mayEdit = canManageLogistics(state);
  const [error, setError] = useState<string | null>(null);
  const [prerequisite, setPrerequisite] = useState("");
  const [dependent, setDependent] = useState("");
  const [reason, setReason] = useState<Record<string, string>>({});

  const options: { value: string; label: string }[] = [
    ...state.bookings
      .filter((b) => b.status !== "cancelled")
      .map((b) => ({ value: `booking:${b.id}`, label: `Booking · ${b.title}` })),
    ...state.tasks
      .filter((t) => t.state !== "cancelled")
      .map((t) => ({ value: `task:${t.id}`, label: `Job · ${t.title}` })),
  ];

  const dependents = [...new Set(state.dependencies.map((e) => refKey(e.dependent)))]
    .map(parseRef)
    .filter((r): r is DependencyRef => r !== null);

  return (
    <AppShell title="What waits for what" subtitle="So one delay does not surprise everyone">
      {error ? (
        <Card className="border-coral bg-coral-soft">
          <p className="inline-flex items-start gap-2 text-sm font-semibold">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden /> {error}
          </p>
        </Card>
      ) : null}

      {mayEdit ? (
        <Card className="space-y-3">
          <h2 className="text-lg">Add a link</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="This must be settled first">
              <select
                className={inputClass}
                value={prerequisite}
                onChange={(e) => setPrerequisite(e.target.value)}
              >
                <option value="">Choose…</option>
                {options.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Before this one">
              <select
                className={inputClass}
                value={dependent}
                onChange={(e) => setDependent(e.target.value)}
              >
                <option value="">Choose…</option>
                {options.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Button
            type="button"
            onClick={() => {
              const p = parseRef(prerequisite);
              const d = parseRef(dependent);
              if (!p || !d) {
                setError("Choose both items first.");
                return;
              }
              const err = addDependency({ prerequisite: p, dependent: d });
              setError(err);
              if (!err) {
                setPrerequisite("");
                setDependent("");
              }
            }}
          >
            <Link2 className="size-4" aria-hidden /> Record this order
          </Button>
        </Card>
      ) : null}

      {state.dependencies.length === 0 ? (
        <Card>
          <p className="text-sm">
            Nothing waits on anything yet. Add a link when one booking only makes sense after
            another is confirmed.
          </p>
        </Card>
      ) : (
        dependents.map((ref) => {
          const { state: depState, unmet } = dependencyStateFor(state, ref);
          const edges = state.dependencies.filter(
            (e) => e.dependent.kind === ref.kind && e.dependent.id === ref.id,
          );
          return (
            <Card key={refKey(ref)} className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-bold">{refLabel(state, ref)}</p>
                <Chip tone={depState === "ready" ? "lime" : depState === "blocked" ? "coral" : "sunny"}>
                  {depState === "ready"
                    ? "Clear to book"
                    : depState === "blocked"
                      ? "Waiting on something"
                      : "Already booked — at risk"}
                </Chip>
              </div>
              <ul className="space-y-2 text-sm">
                {edges.map((e) => (
                  <li key={e.id} className="flex flex-wrap items-center justify-between gap-2">
                    <span>
                      {refSatisfied(state, e) ? "✓" : "•"} Waits for{" "}
                      <span className="font-semibold">{refLabel(state, e.prerequisite)}</span>
                      {e.waivedBy ? (
                        <span className="block text-muted-foreground">
                          Going ahead anyway — {e.waivedBy}: {e.waivedReason}
                        </span>
                      ) : null}
                    </span>
                    {mayEdit ? (
                      <Button
                        type="button"
                        variant="ghost"
                        className="min-h-11 px-2 text-sm"
                        aria-label="Remove this link"
                        onClick={() => setError(removeDependency(e.id))}
                      >
                        <Trash2 className="size-4" aria-hidden />
                      </Button>
                    ) : null}
                  </li>
                ))}
              </ul>

              {mayEdit && unmet.length > 0 ? (
                <div className="space-y-2 border-t border-border pt-3">
                  <Field label="Go ahead without waiting — say why">
                    <input
                      className={inputClass}
                      value={reason[refKey(ref)] ?? ""}
                      onChange={(e) => setReason((r) => ({ ...r, [refKey(ref)]: e.target.value }))}
                      placeholder="The price expires today and the flight is nearly certain"
                    />
                  </Field>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="min-h-11 px-3 text-sm"
                      onClick={() =>
                        setError(waiveDependency(unmet[0]!.id, reason[refKey(ref)] ?? ""))
                      }
                    >
                      <ShieldAlert className="size-4" aria-hidden /> Book it anyway, with a record
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      className="min-h-11 px-3 text-sm"
                      onClick={() => setError(warnAboutDescendants(state, ref) as unknown as string)}
                    >
                      Tell the organisers what this affects
                    </Button>
                  </div>
                </div>
              ) : null}
            </Card>
          );
        })
      )}
    </AppShell>
  );
}
