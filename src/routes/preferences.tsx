import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/kintrip/AppShell";
import { Button, Card, Field, inputClass } from "@/components/kintrip/ui";
import { setState, useKintrip } from "@/lib/kintrip/store";
import type { Pace, Traveller, Walking } from "@/lib/kintrip/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/preferences")({
  head: () => ({
    meta: [
      { title: "Family preferences — Kintrip" },
      {
        name: "description",
        content: "Five quick questions so the plan fits your interests, pace, walking comfort and needs.",
      },
      { property: "og:title", content: "Family preferences — Kintrip" },
      {
        property: "og:description",
        content: "Five quick questions so the plan fits everyone in the family.",
      },
    ],
  }),
  component: PreferencesPage,
});

const INTERESTS = [
  "Food",
  "Culture",
  "Shopping",
  "Nature",
  "Theme parks",
  "Museums",
  "Relaxing",
  "Technology",
  "Photography",
  "Temples",
  "Animals",
  "Sightseeing",
  "Anime",
];

function PreferencesPage() {
  const state = useKintrip();
  const me = state.travellers.find((t) => t.id === state.activeTravellerId) ?? state.travellers[0];
  if (!me) {
    return (
      <AppShell
        title="Help us plan for your family"
        subtitle="Loading your details…"
        back={{ to: "/family", label: "Back to family" }}
      >
        <Card>Loading your trip…</Card>
      </AppShell>
    );
  }
  return <PreferencesForm key={me.id} me={me} />;
}

function PreferencesForm({ me }: { me: Traveller }) {
  const state = useKintrip();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [draft, setDraft] = useState(me.preferences);


  const save = () => {
    setState((prev) => ({
      ...prev,
      travellers: prev.travellers.map((t) =>
        t.id === me.id ? { ...t, preferences: draft, prefStatus: "complete" } : t,
      ),
    }));
    void navigate({ to: "/discover" });
  };

  return (
    <AppShell
      title="Help us plan for your family"
      subtitle={`${step} of 5 · answering as ${me.name}`}
      back={{ to: "/family", label: "Back to family" }}
    >
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted" aria-hidden>
        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${(step / 5) * 100}%` }} />
      </div>

      <label className="block">
        <span className="text-sm font-semibold">Answering as</span>
        <select
          className={cn(inputClass, "mt-1.5")}
          value={state.activeTravellerId}
          onChange={(e) => {
            const id = e.target.value;
            setState((prev) => ({ ...prev, activeTravellerId: id }));
            const t = state.travellers.find((x) => x.id === id);
            if (t) setDraft(t.preferences);
          }}
        >
          {state.travellers.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </label>

      <Card className="space-y-4">
        {step === 1 ? (
          <>
            <h2 className="text-lg">What interests your family?</h2>
            <div className="flex flex-wrap gap-2">
              {INTERESTS.map((i) => {
                const on = draft.interests.includes(i);
                return (
                  <button
                    key={i}
                    onClick={() =>
                      setDraft((d) => ({
                        ...d,
                        interests: on ? d.interests.filter((x) => x !== i) : [...d.interests, i],
                      }))
                    }
                    className={cn(
                      "min-h-12 rounded-full border px-4 font-semibold",
                      on ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card",
                    )}
                    aria-pressed={on}
                  >
                    {i}
                  </button>
                );
              })}
            </div>
          </>
        ) : null}

        {step === 2 ? (
          <>
            <h2 className="text-lg">What's your preferred pace?</h2>
            <Options
              options={["relaxed", "balanced", "packed"] as Pace[]}
              value={draft.pace}
              onChange={(v) => setDraft((d) => ({ ...d, pace: v }))}
            />
          </>
        ) : null}

        {step === 3 ? (
          <>
            <h2 className="text-lg">How much walking feels comfortable?</h2>
            <Options
              options={["low", "moderate", "high"] as Walking[]}
              value={draft.walking}
              onChange={(v) => setDraft((d) => ({ ...d, walking: v }))}
            />
          </>
        ) : null}

        {step === 4 ? (
          <>
            <h2 className="text-lg">Must-dos and things to avoid</h2>
            <Field label="Must-dos (optional)">
              <input
                className={inputClass}
                value={draft.mustDo}
                onChange={(e) => setDraft((d) => ({ ...d, mustDo: e.target.value }))}
              />
            </Field>
            <Field label="Prefer to avoid (optional)">
              <input
                className={inputClass}
                value={draft.avoid}
                onChange={(e) => setDraft((d) => ({ ...d, avoid: e.target.value }))}
              />
            </Field>
          </>
        ) : null}

        {step === 5 ? (
          <>
            <h2 className="text-lg">Anything important we should plan around?</h2>
            <p className="text-sm text-muted-foreground">
              For example accessibility, dietary needs, rest needs or fixed timings.
            </p>
            <textarea
              rows={4}
              className={cn(inputClass, "py-3")}
              value={draft.constraints}
              onChange={(e) => setDraft((d) => ({ ...d, constraints: e.target.value }))}
            />
          </>
        ) : null}

        <div className="flex flex-wrap gap-2">
          {step > 1 ? (
            <Button variant="outline" onClick={() => setStep((s) => s - 1)}>
              Back
            </Button>
          ) : null}
          {step < 5 ? (
            <>
              <Button onClick={() => setStep((s) => s + 1)}>Next</Button>
              {step >= 4 ? (
                <Button variant="ghost" onClick={() => setStep(5)}>
                  Skip optional questions
                </Button>
              ) : null}
            </>
          ) : (
            <Button onClick={save}>Save my preferences</Button>
          )}
        </div>
      </Card>
    </AppShell>
  );
}

function Options<T extends string>({
  options,
  value,
  onChange,
}: {
  options: T[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-3">
      {options.map((o) => (
        <button
          key={o}
          onClick={() => onChange(o)}
          aria-pressed={value === o}
          className={cn(
            "min-h-14 rounded-xl border font-semibold capitalize",
            value === o ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card",
          )}
        >
          {o}
        </button>
      ))}
    </div>
  );
}
