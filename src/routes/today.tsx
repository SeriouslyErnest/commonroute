import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Copy,
  Hotel,
  MapPin,
  Phone,
  Footprints,
  Ticket,
  Train,
  Type,
  UserCheck,
} from "lucide-react";
import { AppShell } from "@/components/kintrip/AppShell";
import { Button, Card, Chip } from "@/components/kintrip/ui";
import { acknowledgeChange, attendanceFor, setAttendance, unacknowledgedFor } from "@/lib/kintrip/actions";
import { editableTravellers } from "@/lib/kintrip/governance";
import { useKintrip } from "@/lib/kintrip/store";
import { travelGaps } from "@/lib/kintrip/travel";
import type { Booking, ItineraryDay, ItineraryItem } from "@/lib/kintrip/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/today")({
  head: () => ({
    meta: [
      { title: "Today — CommonRoute" },
      {
        name: "description",
        content: "What happens next today: meeting time, address, map link and where you are staying.",
      },
      { property: "og:title", content: "Today — CommonRoute" },
      {
        property: "og:description",
        content: "The next thing, the rest of the day and how to find your stay.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TodayScreen,
});

const SIMPLE_KEY = "commonroute.simpleView";

function useSimpleView() {
  const [simple, setSimple] = useState(false);
  useEffect(() => {
    setSimple(window.localStorage.getItem(SIMPLE_KEY) === "1");
  }, []);
  const toggle = () => {
    setSimple((prev) => {
      const next = !prev;
      window.localStorage.setItem(SIMPLE_KEY, next ? "1" : "0");
      return next;
    });
  };
  return { simple, toggle };
}

/** Minutes since midnight at the destination, so "next" means next for the group. */
function nowMinutesIn(timeZone: string | undefined) {
  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: timeZone || undefined,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(new Date());
    const h = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
    const m = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
    return h * 60 + m;
  } catch {
    const d = new Date();
    return d.getHours() * 60 + d.getMinutes();
  }
}

function dateKeyIn(timeZone: string | undefined) {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: timeZone || undefined }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};

function mapsLink(query: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

function StopCard({
  item,
  day,
  booking,
  simple,
  tone,
}: {
  item: ItineraryItem;
  day: ItineraryDay;
  booking: Booking | undefined;
  simple: boolean;
  tone: "next" | "later" | "done";
}) {
  const state = useKintrip();
  const address = item.address ?? `${item.title}, ${day.city}`;
  const mine = editableTravellers(state);
  const counts = attendanceFor(state, item.id);
  return (
    <Card
      className={cn(
        "space-y-2",
        tone === "next" && "border-primary bg-primary-soft",
        tone === "done" && "opacity-70",
        simple && "space-y-3",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className={cn("font-extrabold text-secondary", simple ? "text-2xl" : "text-lg")}>{item.title}</p>
          <p className={cn("flex items-center gap-1.5 text-muted-foreground", simple ? "text-lg" : "text-sm")}>
            <Clock className="size-4" aria-hidden /> Meet at {item.start} local time
          </p>
        </div>
        {tone === "next" ? <Chip tone="primary">Next</Chip> : null}
        {tone === "done" ? (
          <span className="inline-flex items-center gap-1 text-xs font-bold text-muted-foreground">
            <CheckCircle2 className="size-4" aria-hidden /> Done
          </span>
        ) : null}
      </div>

      <p className={cn("flex items-start gap-1.5", simple ? "text-lg" : "text-sm")}>
        <MapPin className="mt-0.5 size-4 shrink-0 text-secondary" aria-hidden /> {address}
      </p>

      {booking ? (
        <p className={cn("rounded-xl bg-muted px-3 py-2", simple ? "text-base" : "text-sm")}>
          <Ticket className="mr-1 inline size-4" aria-hidden />
          {booking.title} — {booking.status === "confirmed" ? "booked by your group" : booking.status}
          {booking.startLocal ? ` · ${booking.startLocal.replace("T", " ")}` : ""}
          <span className="block text-xs text-muted-foreground">
            This is your group&apos;s own record. The venue has not confirmed anything here.
          </span>
        </p>
      ) : null}

      {tone !== "done" ? (
        <div className="space-y-2">
          <p className={cn("flex items-center gap-1.5 font-semibold text-secondary", simple ? "text-base" : "text-sm")}>
            <UserCheck className="size-4" aria-hidden /> {counts.coming} coming
            {counts.out > 0 ? ` · ${counts.out} sitting this one out` : ""}
            {counts.unanswered > 0 ? ` · ${counts.unanswered} yet to say` : ""}
          </p>
          {mine.map((t) => {
            const current = counts.records.find((r) => r.travellerId === t.id)?.state;
            return (
              <div key={t.id} className="flex flex-wrap items-center gap-2">
                {mine.length > 1 ? (
                  <span className="text-xs font-bold text-muted-foreground">{t.name}</span>
                ) : null}
                <Button
                  type="button"
                  variant={current === "coming" ? "secondary" : "outline"}
                  className={simple ? "min-h-12 text-base" : "min-h-10 px-3 text-sm"}
                  onClick={() => setAttendance(t.id, item.id, "coming")}
                >
                  Coming
                </Button>
                <Button
                  type="button"
                  variant={current === "sitting_out" ? "secondary" : "outline"}
                  className={simple ? "min-h-12 text-base" : "min-h-10 px-3 text-sm"}
                  onClick={() => setAttendance(t.id, item.id, "sitting_out")}
                >
                  Sitting this one out
                </Button>
              </div>
            );
          })}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <a
          href={mapsLink(address)}
          target="_blank"
          rel="noreferrer"
          className={cn(
            "inline-flex items-center gap-1.5 rounded-2xl border border-border bg-card px-4 font-bold text-secondary shadow-sm",
            simple ? "min-h-12 text-base" : "min-h-11 text-sm",
          )}
        >
          <MapPin className="size-4" aria-hidden /> Open the map
        </a>
      </div>
    </Card>
  );
}

function TravelLine({ minutes, mode, tight, assumed, simple }: { minutes: number; mode: "walk" | "transport"; tight: boolean; assumed: boolean; simple: boolean }) {
  const Icon = mode === "walk" ? Footprints : Train;
  return (
    <p
      className={cn(
        "flex items-center gap-1.5 px-2 font-semibold",
        simple ? "text-base" : "text-sm",
        tight ? "text-coral-foreground" : "text-muted-foreground",
      )}
    >
      <Icon className="size-4 shrink-0" aria-hidden />
      About {minutes} min to get there{mode === "walk" ? " on foot" : ""}
      {assumed ? " (rough guess)" : ""}
      {tight ? " — that is tight, leave early" : ""}
    </p>
  );
}

function StayCard({ booking, simple }: { booking: Booking; simple: boolean }) {
  const [copied, setCopied] = useState(false);
  const address = booking.addressLocal ?? booking.addressTranslated ?? booking.location ?? booking.title;
  return (
    <Card className="space-y-2 bg-secondary-soft">
      <h2 className={cn("flex items-center gap-2", simple ? "text-2xl" : "text-lg")}>
        <Hotel className="size-5 text-secondary" aria-hidden /> Find our stay
      </h2>
      <p className={cn("font-extrabold", simple ? "text-xl" : "text-base")}>{booking.title}</p>
      {booking.addressLocal ? (
        <p className={cn("font-semibold", simple ? "text-xl" : "text-base")} lang="ja">
          {booking.addressLocal}
        </p>
      ) : null}
      {booking.addressTranslated ? (
        <p className={cn("text-muted-foreground", simple ? "text-lg" : "text-sm")}>{booking.addressTranslated}</p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          className={simple ? "min-h-12 text-base" : ""}
          onClick={() => {
            void navigator.clipboard?.writeText(address).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            });
          }}
        >
          <Copy className="size-4" aria-hidden /> {copied ? "Address copied" : "Copy the address"}
        </Button>
        <a
          href={mapsLink(booking.addressTranslated ?? address)}
          target="_blank"
          rel="noreferrer"
          className={cn(
            "inline-flex items-center gap-1.5 rounded-2xl border border-border bg-card px-4 font-bold text-secondary shadow-sm",
            simple ? "min-h-12 text-base" : "min-h-11 text-sm",
          )}
        >
          <MapPin className="size-4" aria-hidden /> Show on the map
        </a>
        {booking.contact ? (
          <a
            href={`tel:${booking.contact.replace(/\s/g, "")}`}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-2xl border border-border bg-card px-4 font-bold text-secondary shadow-sm",
              simple ? "min-h-12 text-base" : "min-h-11 text-sm",
            )}
          >
            <Phone className="size-4" aria-hidden /> Call the stay
          </a>
        ) : null}
      </div>
      <p className="text-xs text-muted-foreground">
        Calling opens your phone&apos;s dialler. This is not a monitored help line.
      </p>
    </Card>
  );
}

function TodayScreen() {
  const state = useKintrip();
  const { simple, toggle } = useSimpleView();
  const published = state.itinerary?.published ? state.itinerary : null;
  const tz = state.trip.timeZone;

  const days = published?.days ?? [];
  const todayKey = dateKeyIn(tz);
  const naturalIndex = Math.max(
    0,
    days.findIndex((d) => d.date === todayKey),
  );
  const [index, setIndex] = useState(naturalIndex);
  useEffect(() => setIndex(naturalIndex), [naturalIndex]);

  const day = days[Math.min(index, Math.max(0, days.length - 1))];
  const isRealToday = !!day && day.date === todayKey;
  const nowMin = nowMinutesIn(tz);

  const pending = unacknowledgedFor(state, state.activeTravellerId);

  const stay = useMemo(
    () => state.bookings.find((b) => b.type === "stay" && b.status !== "cancelled"),
    [state.bookings],
  );
  const bookingFor = (item: ItineraryItem) =>
    state.bookings.find(
      (b) => b.status !== "cancelled" && b.attractionId && b.attractionId === item.attractionId,
    );

  if (!published || days.length === 0) {
    return (
      <AppShell title="Today" subtitle="The day at a glance">
        <Card className="space-y-3">
          <p className="text-sm">
            Today appears once your group&apos;s plan has been shared with everyone. Until then, the
            plan can still change.
          </p>
          <Link to="/itinerary" className="font-semibold text-secondary">
            Open the plan →
          </Link>
        </Card>
      </AppShell>
    );
  }

  const gaps = day ? travelGaps(state, day) : [];
  const gapAfter = (id: string) => gaps.find((g) => g.afterItemId === id);
  const items = [...(day?.items ?? [])].sort((a, b) => toMinutes(a.start) - toMinutes(b.start));
  const done = isRealToday ? items.filter((i) => toMinutes(i.start) + i.durationMin <= nowMin) : [];
  const remaining = items.filter((i) => !done.includes(i));
  const next = remaining[0];
  const later = remaining.slice(1);

  return (
    <AppShell title="Today" subtitle={day ? `Day ${day.day} · ${day.city}` : ""}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            aria-label="Previous day"
            onClick={() => setIndex((i) => Math.max(0, i - 1))}
          >
            <ChevronLeft className="size-4" aria-hidden />
          </Button>
          <span className="inline-flex items-center gap-1.5 text-sm font-bold text-secondary">
            <CalendarDays className="size-4" aria-hidden /> {day?.date}
            {isRealToday ? " · today" : ""}
          </span>
          <Button
            type="button"
            variant="outline"
            aria-label="Next day"
            onClick={() => setIndex((i) => Math.min(days.length - 1, i + 1))}
          >
            <ChevronRight className="size-4" aria-hidden />
          </Button>
        </div>
        <Button type="button" variant={simple ? "secondary" : "outline"} onClick={toggle}>
          <Type className="size-4" aria-hidden /> {simple ? "Standard view" : "Larger, simpler view"}
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        Plan version {published.version}
        {state.cachedAt ? ` · saved ${new Date(state.cachedAt).toLocaleString("en-GB")}` : ""}
        {tz ? ` · times shown in ${tz}` : " · times are local to the destination"}
      </p>

      {pending.length > 0 ? (
        <Card className="space-y-2 border-sunny bg-sunny-soft">
          <p className="text-sm font-bold">The plan changed since you last looked.</p>
          <ul className="space-y-1 text-sm">
            {pending[0]!.changes.slice(0, 4).map((ch, i) => (
              <li key={i}>· {ch.text}</li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={() => acknowledgeChange(pending[0]!.id)}>
              Got it
            </Button>
            <Link to="/changes" className="inline-flex items-center font-semibold text-secondary">
              See every change →
            </Link>
          </div>
        </Card>
      ) : null}

      {items.length === 0 ? (
        <Card>
          <p className="text-sm">Nothing is planned for this day. It is a free day — enjoy it.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {next ? (
            <>
              <StopCard item={next} day={day!} booking={bookingFor(next)} simple={simple} tone="next" />
              {gapAfter(next.id) ? (
                <TravelLine
                  minutes={gapAfter(next.id)!.estimate.minutes}
                  mode={gapAfter(next.id)!.estimate.mode}
                  assumed={gapAfter(next.id)!.estimate.assumed}
                  tight={gapAfter(next.id)!.tight}
                  simple={simple}
                />
              ) : null}
            </>
          ) : (
            <Card>
              <p className="text-sm">That is everything for today. Rest well.</p>
            </Card>
          )}

          {later.length > 0 ? (
            <div className="space-y-2">
              <h2 className={simple ? "text-2xl" : "text-lg"}>Later today</h2>
              {later.map((i) => (
                <div key={i.id} className="space-y-2">
                  <StopCard item={i} day={day!} booking={bookingFor(i)} simple={simple} tone="later" />
                  {gapAfter(i.id) ? (
                    <TravelLine
                      minutes={gapAfter(i.id)!.estimate.minutes}
                      mode={gapAfter(i.id)!.estimate.mode}
                      assumed={gapAfter(i.id)!.estimate.assumed}
                      tight={gapAfter(i.id)!.tight}
                      simple={simple}
                    />
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}

          {done.length > 0 ? (
            <div className="space-y-2">
              <h2 className={simple ? "text-2xl" : "text-lg"}>Done</h2>
              {done.map((i) => (
                <StopCard key={i.id} item={i} day={day!} booking={bookingFor(i)} simple={simple} tone="done" />
              ))}
            </div>
          ) : null}
        </div>
      )}

      {stay ? <StayCard booking={stay} simple={simple} /> : null}

      <p className="pb-4 text-center text-sm text-muted-foreground">
        <Link to="/bookings" className="font-semibold text-secondary">
          Bookings and stay
        </Link>{" "}
        ·{" "}
        <Link to="/getting-ready" className="font-semibold text-secondary">
          Getting ready
        </Link>
      </p>
    </AppShell>
  );
}
