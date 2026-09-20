import { createFileRoute, Link } from "@tanstack/react-router";
import { Printer } from "lucide-react";
import { Button } from "@/components/kintrip/ui";
import { formatDate, pretty } from "@/lib/kintrip/engine";
import { dayEnergy } from "@/lib/kintrip/governance";
import { useKintrip } from "@/lib/kintrip/store";

export const Route = createFileRoute("/print")({
  head: () => ({
    meta: [
      { title: "Printable itinerary — CommonRoute" },
      {
        name: "description",
        content: "A clean, printable version of your group itinerary you can save as a PDF or hand out on paper.",
      },
      { property: "og:title", content: "Printable itinerary — CommonRoute" },
      {
        property: "og:description",
        content: "Print the plan or save it as a PDF so everyone has a copy, even without a phone.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PrintScreen,
});

function PrintScreen() {
  const state = useKintrip();
  const itinerary = state.itinerary;

  return (
    <div className="mx-auto min-h-screen max-w-3xl bg-background px-5 py-6 print:px-0 print:py-0">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-2 print:hidden">
        <Link to="/itinerary" className="text-sm font-semibold text-secondary">
          ← Back to the plan
        </Link>
        <Button onClick={() => window.print()}>
          <Printer className="size-5" aria-hidden /> Print or save as PDF
        </Button>
      </div>

      {!itinerary ? (
        <p className="text-sm text-muted-foreground">There is no plan to print yet.</p>
      ) : (
        <article className="space-y-5">
          <header className="space-y-1 border-b border-border pb-4">
            <h1 className="text-2xl">{state.trip.name || state.trip.destination}</h1>
            <p className="text-muted-foreground">
              {state.trip.destination} · {formatDate(itinerary.days[0]?.date ?? "")} –{" "}
              {formatDate(itinerary.days.at(-1)?.date ?? "")} · {state.travellers.length} travellers
            </p>
            <p className="text-sm text-muted-foreground">{itinerary.summary}</p>
          </header>

          {itinerary.days.map((day) => (
            <section key={day.day} className="break-inside-avoid space-y-2 border-b border-border pb-4">
              <h2 className="text-lg">
                Day {day.day} — {day.areaLabel}
              </h2>
              <p className="text-sm text-muted-foreground">
                {formatDate(day.date)} · {dayEnergy(state, day).label} day · {dayEnergy(state, day).explanation}
              </p>
              {day.split ? (
                <p className="text-sm">
                  Two groups today. Meeting at {day.split.meetingPoint}, {day.split.meetingTime}.
                </p>
              ) : null}
              <ol className="space-y-1.5 text-sm">
                {day.items.map((item) => (
                  <li key={item.id} className="flex gap-3">
                    <span className="w-14 shrink-0 font-semibold">{pretty(item.start)}</span>
                    <span>
                      <span className="font-semibold">{item.title}</span>
                      <span className="block text-muted-foreground">
                        {item.durationMin} min{item.address ? ` · ${item.address}` : ""}
                      </span>
                    </span>
                  </li>
                ))}
              </ol>
            </section>
          ))}

          <section className="space-y-1">
            <h2 className="text-lg">Who&apos;s travelling</h2>
            <p className="text-sm text-muted-foreground">
              {state.travellers.map((t) => `${t.name} (${t.relationship})`).join(", ")}
            </p>
          </section>
        </article>
      )}
    </div>
  );
}
