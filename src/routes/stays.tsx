import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Building2, Plus, Trash2 } from "lucide-react";
import { AppShell } from "@/components/kintrip/AppShell";
import { Button, Card, Chip, Field, inputClass } from "@/components/kintrip/ui";
import { PaidGate, AllowanceNote } from "@/components/kintrip/PaidGate";
import { useKintrip } from "@/lib/kintrip/store";
import { isOrganiser } from "@/lib/kintrip/governance";
import { addStayOption, recordStayResults, removeStayOption } from "@/lib/kintrip/planning";
import { compareStays, nightsBetween, type StayComparison } from "@/lib/kintrip/compare";
import { useCommerce } from "@/lib/kintrip/useCommerce";

/**
 * Compare places to stay against the group's real plan (P06).
 * Remixed from the original Kintrip project.
 */

const title = "Compare places to stay — CommonRoute";
const description = "See how each possible base sits against the places your group plans to visit.";

export const Route = createFileRoute("/stays")({
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
  component: StaysScreen,
});

function money(minor: number | null, currency: string) {
  if (minor == null) return "Not recorded";
  return `${currency} ${(minor / 100).toFixed(0)}`;
}

function StaysScreen() {
  const state = useKintrip();
  const organiser = isOrganiser(state);
  const { runJob } = useCommerce();
  const [name, setName] = useState("");
  const [cost, setCost] = useState("");
  const [coords, setCoords] = useState("");
  const [results, setResults] = useState<StayComparison[] | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const nights = useMemo(
    () => nightsBetween(state.trip.startDate, state.trip.endDate),
    [state.trip.startDate, state.trip.endDate],
  );

  function add() {
    const [latRaw, lonRaw] = coords.split(",").map((s) => s.trim());
    addStayOption({
      name,
      nightlyCostMinor: cost ? Math.round(Number(cost) * 100) : undefined,
      lat: latRaw ? Number(latRaw) : undefined,
      lon: lonRaw ? Number(lonRaw) : undefined,
    });
    setName("");
    setCost("");
    setCoords("");
  }

  async function compare() {
    setBusy(true);
    setStatus(null);
    const hash = state.stayOptions.map((o) => `${o.id}:${o.lat}:${o.lon}:${o.nightlyCostMinor}`).join("|");
    const outcome = await runJob("compare_bases", hash, () => compareStays(state, state.stayOptions));
    if (outcome.ok) {
      setResults(outcome.result);
      recordStayResults(
        Object.fromEntries(
          outcome.result.map((r) => [
            r.optionId,
            {
              at: new Date().toISOString(),
              revision: state.itinerary?.version ?? 1,
              medianMinutes: r.medianMinutes,
              reachable: r.reachable,
              unknown: r.unknown,
              nightsCostMinor: r.nightsCostMinor,
            },
          ]),
        ),
      );
    } else {
      setStatus(
        outcome.reason === "exhausted"
          ? "This trip has used all its advanced comparisons. Everything else keeps working."
          : outcome.reason === "locked"
            ? "This comparison is part of Trip Plus."
            : "That did not finish, so nothing was counted. Please try again.",
      );
    }
    setBusy(false);
  }

  const currency = state.decisions.currency;

  return (
    <AppShell title="Places to stay" subtitle="Up to five options, compared against where your group is actually going.">
      {organiser ? (
        <Card className="p-5">
          <h2 className="text-lg">Add an option</h2>
          <div className="mt-3 space-y-3">
            <Field label="Name">
              <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="Hotel near the station" />
            </Field>
            <Field label={`Price per night (${currency}) — optional`}>
              <input className={inputClass} inputMode="decimal" value={cost} onChange={(e) => setCost(e.target.value)} />
            </Field>
            <Field label="Coordinates — optional, as latitude, longitude">
              <input className={inputClass} value={coords} onChange={(e) => setCoords(e.target.value)} placeholder="35.0116, 135.7681" />
            </Field>
            <Button disabled={!name.trim() || state.stayOptions.length >= 5} onClick={add}>
              <Plus className="size-5" aria-hidden /> Add option
            </Button>
            {state.stayOptions.length >= 5 ? (
              <p className="text-sm text-muted-foreground">Five options is the most that can be compared at once.</p>
            ) : null}
          </div>
        </Card>
      ) : null}

      {state.stayOptions.length === 0 ? (
        <Card className="p-5">
          <p className="text-sm text-muted-foreground">
            No options yet. Add the places you are considering, with coordinates if you have them.
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {state.stayOptions.map((o) => {
            const r = results?.find((x) => x.optionId === o.id) ?? null;
            const stored = o.result;
            return (
              <Card key={o.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Chip tone="secondary">
                      <Building2 className="size-4" aria-hidden /> Option
                    </Chip>
                    <p className="mt-2 font-semibold">{o.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {o.nightlyCostMinor != null
                        ? `${money(o.nightlyCostMinor, currency)} a night${nights ? ` · ${nights} nights` : ""}`
                        : "Price not recorded"}
                      {o.lat == null || o.lon == null ? " · location unknown" : ""}
                    </p>
                  </div>
                  {organiser ? (
                    <button type="button" aria-label={`Remove ${o.name}`} onClick={() => removeStayOption(o.id)} className="text-muted-foreground">
                      <Trash2 className="size-5" aria-hidden />
                    </button>
                  ) : null}
                </div>
                {(r ?? stored) ? (
                  <div className="mt-3 rounded-2xl bg-muted p-3 text-sm">
                    <p>
                      Typical walk to your planned places:{" "}
                      <strong>
                        {(r?.medianMinutes ?? stored?.medianMinutes) == null
                          ? "unknown"
                          : `${r?.medianMinutes ?? stored?.medianMinutes} min`}
                      </strong>
                    </p>
                    <p className="text-muted-foreground">
                      {r?.reachable ?? stored?.reachable ?? 0} places measured
                      {(r?.unknown ?? stored?.unknown ?? 0) > 0
                        ? `, ${r?.unknown ?? stored?.unknown} with no location recorded`
                        : ""}
                      . Straight-line distance at walking pace, not a routed journey.
                    </p>
                    <p className="mt-1">
                      Whole stay: <strong>{money(r?.nightsCostMinor ?? stored?.nightsCostMinor ?? null, currency)}</strong>
                    </p>
                  </div>
                ) : null}
              </Card>
            );
          })}
        </div>
      )}

      <PaidGate
        feature="compare_bases"
        preview="Compares every option you have added against the places your group plans to visit, and shows the typical walk and the cost of the whole stay side by side."
      >
        <Card className="p-5">
          <h2 className="text-lg">Compare these options</h2>
          <AllowanceNote />
          <Button className="mt-3" disabled={busy || state.stayOptions.length < 2} onClick={() => void compare()}>
            {busy ? "Comparing…" : "Compare now"}
          </Button>
          {state.stayOptions.length < 2 ? (
            <p className="mt-2 text-sm text-muted-foreground">Add at least two options to compare.</p>
          ) : null}
          {status ? <p className="mt-3 text-sm font-semibold">{status}</p> : null}
        </Card>
      </PaidGate>
    </AppShell>
  );
}
