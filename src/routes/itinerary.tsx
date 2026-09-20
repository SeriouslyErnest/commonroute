import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Check, Download, Share2, Sparkles, TriangleAlert } from "lucide-react";
import { AppShell } from "@/components/kintrip/AppShell";
import { Button, Card, Chip, LinkButton } from "@/components/kintrip/ui";
import { formatDate, generateItinerary, pretty } from "@/lib/kintrip/engine";
import { setState, useKintrip } from "@/lib/kintrip/store";

export const Route = createFileRoute("/itinerary")({
  head: () => ({
    meta: [
      { title: "Your group itinerary — CommonRoute" },
      {
        name: "description",
        content:
          "One recommended family itinerary, with a plain-language explanation of why it works for everyone.",
      },
      { property: "og:title", content: "Your group itinerary — CommonRoute" },
      {
        property: "og:description",
        content: "One recommended plan, grouped geographically, with meals, rests and must-dos kept in.",
      },
    ],
  }),
  component: ItineraryTab,
});

function ItineraryTab() {
  const state = useKintrip();
  const [openDay, setOpenDay] = useState<number | null>(1);
  const [shared, setShared] = useState(false);
  const itinerary = state.itinerary;

  if (!itinerary) {
    return (
      <AppShell title="Your itinerary" subtitle="Nothing generated yet">
        <Card className="space-y-3">
          <p>
            Once the group has voted, CommonRoute builds one recommended plan that balances everyone&apos;s
            must-dos with walking limits, meals and rest.
          </p>
          <LinkButton to="/consensus">Review and build our itinerary</LinkButton>
        </Card>
      </AppShell>
    );
  }

  const activities = itinerary.days.flatMap((d) => d.items.filter((i) => i.kind === "activity"));

  return (
    <AppShell
      title="Here's the plan we recommend"
      subtitle={`${itinerary.days.length} days · ${activities.length} activities · balanced pace`}
    >
      <Card className="border-primary/40 bg-primary-soft">
        <div className="flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-lg">
            <Sparkles className="size-5 text-primary" aria-hidden /> Strong group fit
          </h2>
          {itinerary.finalised ? <Chip tone="lime">Final / ready</Chip> : null}
        </div>
        <ul className="mt-3 space-y-1.5 text-sm">
          {itinerary.fit.good.map((g) => (
            <li key={g} className="flex gap-2">
              <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden /> {g}
            </li>
          ))}
          {itinerary.fit.watch.map((w) => (
            <li key={w} className="flex gap-2">
              <TriangleAlert className="mt-0.5 size-4 shrink-0 text-sunny" aria-hidden /> {w}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-sm text-muted-foreground">{itinerary.summary}</p>
      </Card>

      <div className="space-y-3">
        {itinerary.days.map((day) => {
          const stops = day.items.filter((i) => i.kind === "activity").length;
          const heavy = day.items.some((i) => i.walking === "high");
          const open = openDay === day.day;
          return (
            <Card key={day.day} className="space-y-2">
              <button
                className="flex w-full items-start justify-between gap-3 text-left"
                onClick={() => setOpenDay(open ? null : day.day)}
                aria-expanded={open}
              >
                <span>
                  <span className="block text-lg font-extrabold">
                    Day {day.day} — {day.areaLabel}
                  </span>
                  <span className="block text-sm text-muted-foreground">
                    {formatDate(day.date)} · {stops} {stops === 1 ? "stop" : "stops"} · {heavy ? "higher" : "moderate"} walking
                  </span>
                </span>
                <span className="text-sm font-semibold text-secondary">{open ? "Hide" : "View"}</span>
              </button>
              {day.timingNote ? <Chip tone="sunny">1 timing note</Chip> : null}
              {open ? (
                <ol className="space-y-3 pt-2">
                  {day.items.map((item) => (
                    <li key={item.id} className="flex gap-3">
                      <span className="w-16 shrink-0 text-sm font-semibold text-muted-foreground">
                        {pretty(item.start)}
                      </span>
                      <span className="flex-1 border-l border-border pl-3">
                        <span className="block font-semibold">{item.title}</span>
                        <span className="block text-sm text-muted-foreground">
                          {item.kind === "travel"
                            ? `${item.durationMin} min · ${item.transport}`
                            : `${item.durationMin} min${item.address ? ` · ${item.address}` : ""}`}
                        </span>
                        {item.note ? (
                          <span className="mt-1 block text-sm text-muted-foreground">{item.note}</span>
                        ) : null}
                        {item.kind === "activity" ? (
                          <span className="mt-2 flex flex-wrap gap-2">
                            <Button
                              variant="outline"
                              className="min-h-10 px-3 text-sm"
                              onClick={() => moveItem(day.day, item.id, 1)}
                            >
                              Move to next day
                            </Button>
                            <Button
                              variant="outline"
                              className="min-h-10 px-3 text-sm"
                              onClick={() => removeItem(day.day, item.id)}
                            >
                              Remove
                            </Button>
                          </span>
                        ) : null}
                      </span>
                    </li>
                  ))}
                </ol>
              ) : null}
            </Card>
          );
        })}
      </div>

      <Card className="flex flex-wrap gap-2">
        <Button
          onClick={() =>
            setState((prev) => ({
              ...prev,
              trip: { ...prev.trip, status: "final" },
              itinerary: prev.itinerary ? { ...prev.itinerary, finalised: true } : prev.itinerary,
            }))
          }
        >
          <Check className="size-5" aria-hidden /> Use this itinerary
        </Button>
        <Button
          variant="outline"
          onClick={() =>
            setState((prev) => ({ ...prev, itinerary: generateItinerary(prev, prev.itinerary!.version) }))
          }
        >
          Try another plan
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            void navigator.clipboard?.writeText(window.location.href);
            setShared(true);
          }}
        >
          <Share2 className="size-5" aria-hidden /> {shared ? "Link copied" : "Share live link"}
        </Button>
        <Button variant="ghost" onClick={() => setState((prev) => ({ ...prev }))}>
          <Download className="size-5" aria-hidden /> Save for offline
        </Button>
      </Card>
      <p className="pb-4 text-center text-sm text-muted-foreground">
        Saved on this device
        {state.cachedAt ? ` · ${new Date(state.cachedAt).toLocaleString("en-GB")}` : ""}
      </p>
    </AppShell>
  );
}

function moveItem(day: number, itemId: string, offset: number) {
  setState((prev) => {
    if (!prev.itinerary) return prev;
    const days = prev.itinerary.days.map((d) => ({ ...d, items: [...d.items] }));
    const from = days.find((d) => d.day === day);
    const to = days.find((d) => d.day === day + offset);
    if (!from || !to) return prev;
    const idx = from.items.findIndex((i) => i.id === itemId);
    if (idx === -1) return prev;
    const [item] = from.items.splice(idx, 1);
    const last = to.items.at(-1);
    to.items.push({
      ...item!,
      start: last ? addMinutes(last.start, last.durationMin + 15) : "15:00",
    });
    return { ...prev, itinerary: { ...prev.itinerary, days } };
  });
}

function addMinutes(start: string, minutes: number) {
  const [h, m] = start.split(":").map(Number);
  const total = (h ?? 0) * 60 + (m ?? 0) + minutes;
  return `${String(Math.floor(total / 60) % 24).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function removeItem(day: number, itemId: string) {
  setState((prev) =>
    prev.itinerary
      ? {
          ...prev,
          itinerary: {
            ...prev.itinerary,
            days: prev.itinerary.days.map((d) =>
              d.day === day ? { ...d, items: d.items.filter((i) => i.id !== itemId) } : d,
            ),
          },
        }
      : prev,
  );
}
