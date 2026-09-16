import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { CloudRain, Clock3, DoorClosed, BatteryLow, Check } from "lucide-react";
import { AppShell } from "@/components/kintrip/AppShell";
import { Button, Card, Chip, inputClass } from "@/components/kintrip/ui";
import { pretty, replanDay, type ReplanResult } from "@/lib/kintrip/engine";
import { setState, useKintrip } from "@/lib/kintrip/store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/replan")({
  head: () => ({
    meta: [
      { title: "Re-plan my day — Kintrip" },
      {
        name: "description",
        content:
          "Rain, tiredness or running late? Kintrip reshapes the rest of the day and keeps the must-dos.",
      },
      { property: "og:title", content: "Re-plan my day — Kintrip" },
      {
        property: "og:description",
        content: "Tell Kintrip what changed and get one revised plan for the rest of today.",
      },
    ],
  }),
  component: ReplanPage,
});

const REASONS = [
  { label: "Rain", hint: "Bad weather", icon: CloudRain },
  { label: "Running late", hint: "Behind schedule", icon: Clock3 },
  { label: "Too tired", hint: "Need a slower day", icon: BatteryLow },
  { label: "Attraction unavailable", hint: "Now closed", icon: DoorClosed },
];

function ReplanPage() {
  const state = useKintrip();
  const navigate = useNavigate();
  const [selected, setSelected] = useState<string[]>([]);
  const [text, setText] = useState("");
  const [result, setResult] = useState<ReplanResult | null>(null);
  const [day, setDay] = useState(state.currentDay);

  if (!state.itinerary) {
    return (
      <AppShell title="Re-plan my day" back={{ to: "/", label: "Back to today" }}>
        <Card>Generate an itinerary first, then Kintrip can adjust it while you travel.</Card>
      </AppShell>
    );
  }

  if (result) {
    const revisedDay = result.itinerary.days.find((d) => d.day === day)!;
    return (
      <AppShell
        title={result.message}
        subtitle={`Day ${day} · revised plan`}
        back={{ to: "/", label: "Back to today" }}
      >
        <Card className="bg-primary-soft">
          <h2 className="text-lg">What changed</h2>
          <ul className="mt-2 space-y-1.5 text-sm">
            {result.changes.map((c) => (
              <li key={c} className="flex gap-2">
                <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden /> {c}
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <h2 className="text-lg">Revised timeline</h2>
          <ol className="mt-3 space-y-3">
            {revisedDay.items.map((item) => (
              <li key={item.id} className="flex gap-3">
                <span className="w-16 shrink-0 text-sm font-semibold text-muted-foreground">
                  {pretty(item.start)}
                </span>
                <span className="flex-1 border-l border-border pl-3">
                  <span className="block font-semibold">{item.title}</span>
                  <span className="block text-sm text-muted-foreground">
                    {item.durationMin} min{item.address ? ` · ${item.address}` : ""}
                    {item.transport ? ` · ${item.transport}` : ""}
                  </span>
                  {item.note ? (
                    <span className="mt-1 block text-sm text-muted-foreground">{item.note}</span>
                  ) : null}
                </span>
              </li>
            ))}
          </ol>
        </Card>

        <div className="flex flex-wrap gap-2 pb-6">
          <Button
            onClick={() => {
              setState((prev) => ({
                ...prev,
                itinerary: result.itinerary,
                trip: { ...prev.trip, status: "travelling" },
                replanLog: [
                  ...prev.replanLog,
                  {
                    day,
                    at: new Date().toISOString(),
                    reason: [...selected, text].filter(Boolean).join(", "),
                    changes: result.changes,
                  },
                ],
              }));
              void navigate({ to: "/" });
            }}
          >
            Use revised plan
          </Button>
          <Button
            variant="outline"
            onClick={() => setResult(replanDay(state, day, selected, `${text} alternative`))}
          >
            Try another option
          </Button>
          <Button variant="ghost" onClick={() => setResult(null)}>
            Start over
          </Button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Life happens. Let's re-plan."
      subtitle={`Day ${day} · we'll keep as much of your plan as we can`}
      back={{ to: "/", label: "Back to today" }}
    >
      <Card className="space-y-4">
        <label className="block space-y-1.5">
          <span className="text-sm font-semibold">Which day are we adjusting?</span>
          <select
            className={cn(inputClass)}
            value={day}
            onChange={(e) => setDay(Number(e.target.value))}
          >
            {state.itinerary!.days.map((d) => (
              <option key={d.day} value={d.day}>
                Day {d.day} — {d.areaLabel}
              </option>
            ))}
          </select>
        </label>

        <h2 className="text-lg">What changed?</h2>
        <div className="grid grid-cols-2 gap-2">
          {REASONS.map(({ label, hint, icon: Icon }) => {
            const on = selected.includes(label);
            return (
              <button
                key={label}
                aria-pressed={on}
                onClick={() =>
                  setSelected((s) => (on ? s.filter((x) => x !== label) : [...s, label]))
                }
                className={cn(
                  "flex min-h-20 flex-col items-center justify-center gap-1 rounded-xl border px-3 text-center text-sm font-semibold",
                  on ? "border-primary bg-primary-soft" : "border-border bg-card",
                )}
              >
                <Icon className="size-5 text-secondary" aria-hidden />
                {label}
                <span className="text-xs font-normal text-muted-foreground">{hint}</span>
              </button>
            );
          })}
        </div>

        <label className="block space-y-1.5">
          <span className="text-sm font-semibold">Or tell us what you need</span>
          <textarea
            rows={3}
            className={cn(inputClass, "py-3")}
            placeholder="It started raining, Grandma is tired, and we're running about 45 minutes late."
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </label>

        <div className="flex flex-wrap gap-2">
          <Chip tone="secondary">Keeps hard constraints</Chip>
          <Chip tone="lime">Protects must-dos</Chip>
          <Chip tone="sunny">Fewer movements</Chip>
        </div>

        <Button className="w-full" onClick={() => setResult(replanDay(state, day, selected, text))}>
          Re-plan my day
        </Button>
      </Card>
    </AppShell>
  );
}
