import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Scale, UserCog } from "lucide-react";
import { AppShell } from "@/components/kintrip/AppShell";
import { Button, Card, Chip, LinkButton, inputClass } from "@/components/kintrip/ui";
import {
  MODE_LABEL,
  ROLE_LABEL,
  SEVERITY_LABEL,
  fairness,
  isOrganiser,
} from "@/lib/kintrip/governance";
import { addNeed, removeNeed, setRoles, updateDecisionSettings } from "@/lib/kintrip/actions";
import { useKintrip } from "@/lib/kintrip/store";
import type { DecisionMode, Severity, TripRole } from "@/lib/kintrip/types";

const CURRENCIES = ["SGD", "USD", "EUR", "GBP", "AUD", "JPY", "MYR", "IDR", "THB", "INR", "CNY", "HKD", "KRW", "NZD", "CAD", "CHF"];

export const Route = createFileRoute("/roles")({
  head: () => ({
    meta: [
      { title: "Roles and how decisions are made — CommonRoute" },
      {
        name: "description",
        content:
          "Set who organises, who pays and who can view, choose how the group decides, and record the needs the plan must respect.",
      },
      { property: "og:title", content: "Roles and how decisions are made — CommonRoute" },
      {
        property: "og:description",
        content: "Who organises, who pays, who views — and the needs every plan has to respect.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RolesPage,
});

const ALL_ROLES: TripRole[] = ["owner", "organiser", "sponsor", "contributor", "viewer"];

function RolesPage() {
  const state = useKintrip();
  const organiser = isOrganiser(state);
  const fair = fairness(state);
  const [needFor, setNeedFor] = useState<string | null>(null);
  const [needLabel, setNeedLabel] = useState("");
  const [needSeverity, setNeedSeverity] = useState<Severity>("comfort_need");

  return (
    <AppShell title="Roles and decisions" subtitle="Who decides what, and what the plan must respect">
      <Card className="bg-primary-soft space-y-2">
        <h2 className="flex items-center gap-2 text-lg">
          <Scale className="size-5 text-primary" aria-hidden /> How this group decides
        </h2>
        <label className="block text-sm font-semibold" htmlFor="mode">
          Decision style
        </label>
        <select
          id="mode"
          className={inputClass}
          value={state.decisions.mode}
          disabled={!organiser}
          onChange={(e) => updateDecisionSettings({ mode: e.target.value as DecisionMode })}
        >
          {Object.entries(MODE_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <label className="block text-sm font-semibold" htmlFor="currency">
          Currency for costs
        </label>
        <select
          id="currency"
          className={inputClass}
          value={state.decisions.currency}
          disabled={!organiser}
          onChange={(e) => updateDecisionSettings({ currency: e.target.value })}
        >
          {CURRENCIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <label className="block text-sm font-semibold" htmlFor="budget">
          Shared budget for the whole group (optional), in {state.decisions.currency}
        </label>
        <input
          id="budget"
          type="number"
          min={0}
          className={inputClass}
          value={state.decisions.sharedBudget ?? ""}
          disabled={!organiser}
          onChange={(e) => updateDecisionSettings({ sharedBudget: Number(e.target.value) || undefined })}
        />
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="size-5"
            checked={state.decisions.publication === "owner"}
            disabled={!organiser}
            onChange={(e) => updateDecisionSettings({ publication: e.target.checked ? "owner" : "organisers" })}
          />
          Only the trip owner can publish the final plan
        </label>
      </Card>

      <Card className="space-y-2">
        <h2 className="text-lg">Everyone gets a win</h2>
        <p className="text-sm text-muted-foreground">
          {fair.uncovered.length === 0
            ? "Every traveller has at least one activity they asked for."
            : `${fair.uncovered.map((t) => t.name).join(", ")} ${fair.uncovered.length === 1 ? "has" : "have"} nothing they picked in the plan yet.`}
        </p>
      </Card>

      {state.travellers.map((t) => (
        <Card key={t.id} className="space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h2 className="flex items-center gap-2 text-lg">
                <UserCog className="size-5 text-secondary" aria-hidden /> {t.name}
              </h2>
              <p className="text-sm text-muted-foreground">
                {t.relationship} · {t.ageGroup}
                {t.managed ? " · profile managed by an adult" : ""}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {ALL_ROLES.map((role) => {
              const on = t.roles.includes(role);
              return (
                <button
                  key={role}
                  type="button"
                  disabled={!organiser}
                  onClick={() =>
                    setRoles(t.id, on ? t.roles.filter((r) => r !== role) : [...t.roles, role])
                  }
                  className="min-h-11 rounded-xl border border-border px-3 text-sm font-semibold disabled:opacity-60 aria-pressed:border-primary aria-pressed:bg-primary-soft"
                  aria-pressed={on}
                >
                  {ROLE_LABEL[role]}
                </button>
              );
            })}
          </div>

          <div className="space-y-1">
            {(t.needs ?? []).map((n) => (
              <div key={n.id} className="flex items-center justify-between gap-2 text-sm">
                <span>
                  <Chip tone={n.severity === "hard_limit" ? "coral" : "sunny"}>{SEVERITY_LABEL[n.severity]}</Chip>{" "}
                  {n.label}
                </span>
                <Button
                  variant="ghost"
                  className="min-h-10 px-2 text-sm"
                  onClick={() => removeNeed(t.id, n.id)}
                >
                  Remove
                </Button>
              </div>
            ))}
            {needFor === t.id ? (
              <div className="space-y-2 rounded-2xl bg-muted p-3">
                <input
                  className={inputClass}
                  placeholder="What should the plan respect?"
                  value={needLabel}
                  onChange={(e) => setNeedLabel(e.target.value)}
                />
                <select
                  className={inputClass}
                  value={needSeverity}
                  onChange={(e) => setNeedSeverity(e.target.value as Severity)}
                >
                  {Object.entries(SEVERITY_LABEL).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
                <Button
                  className="min-h-11 px-3 text-sm"
                  onClick={() => {
                    if (needLabel.trim()) {
                      addNeed(t.id, {
                        type: "other",
                        severity: needSeverity,
                        label: needLabel.trim(),
                        visibility: "group",
                      });
                    }
                    setNeedLabel("");
                    setNeedFor(null);
                  }}
                >
                  Save
                </Button>
              </div>
            ) : (
              <Button
                variant="ghost"
                className="min-h-10 px-2 text-sm"
                onClick={() => setNeedFor(t.id)}
              >
                Add something to plan around
              </Button>
            )}
          </div>
        </Card>
      ))}

      <div className="flex flex-wrap gap-2 pb-4">
        <LinkButton to="/review" variant="secondary">
          Review suggestions
        </LinkButton>
        <LinkButton to="/sponsor" variant="outline">
          Money decisions
        </LinkButton>
      </div>
    </AppShell>
  );
}
