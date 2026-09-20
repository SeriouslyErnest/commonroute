import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight, CalendarDays, ChevronDown, MapPin, Sparkles, Users } from "lucide-react";
import logo from "@/assets/commonroute-logo.png.asset.json";
import santoriniStart from "@/assets/kintrip-santorini-start.jpg";
import { Button } from "@/components/kintrip/ui";
import { cn } from "@/lib/utils";
import { createNewTrip, startDemoTrip, useTripSetupStatus } from "@/lib/kintrip/store";

/**
 * The CommonRoute setup card.
 * Shown full-screen on the start page, and as an embedded card on /create.
 */
export function StartTripCard({ embedded = false }: { embedded?: boolean | undefined }) {
  const navigate = useNavigate();
  const { hasDemo } = useTripSetupStatus();

  return (
    <section
      className={cn(
        "kin-rise mx-auto max-w-md overflow-hidden bg-card",
        embedded ? "rounded-3xl shadow-lift" : "min-h-screen sm:min-h-0 sm:rounded-3xl sm:shadow-lift",
      )}
    >
      <div className="px-6 pt-8 text-center sm:px-9 sm:pt-9">
        <img src={logo.url} alt="CommonRoute — Plan together. Find your common route." className="commonroute-lockup mx-auto h-auto w-full max-w-[330px]" />
        <h1 className="mx-auto mt-5 max-w-sm text-3xl leading-tight sm:text-4xl">Plan a trip that works for everyone.</h1>
        <p className="mt-2 text-base font-semibold text-muted-foreground">Bring every idea and practical need into one shared plan.</p>
      </div>

      <div className="relative mt-5 h-48 overflow-hidden sm:h-52">
        <img
          src={santoriniStart}
          alt="Whitewashed Santorini overlooking the Aegean Sea"
          width={1536}
          height={768}
          className="size-full object-cover object-center"
        />
        <div className="absolute inset-x-0 bottom-0 h-10 bg-linear-to-t from-card to-transparent" />
      </div>

      <div className="-mt-1 px-6 pb-8 sm:px-9 sm:pb-9">
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            const destination = String(form.get("destination") || "").trim();
            createNewTrip({
              title: `${destination} group trip`,
              destination,
              startDate: String(form.get("start") || ""),
              endDate: String(form.get("end") || ""),
              travellerCount: Number(form.get("count") || 2),
            });
            void navigate({ to: "/invite" });
          }}
        >
          <label className="block">
            <span className="mb-1.5 block text-base font-extrabold">Destination</span>
            <span className="flex min-h-14 items-center gap-3 rounded-2xl border border-input bg-card px-4 shadow-sm focus-within:border-primary focus-within:ring-2 focus-within:ring-ring/30">
              <MapPin className="size-5 shrink-0 text-secondary" aria-hidden />
              <input
                name="destination"
                required
                placeholder="Where would you like to go?"
                className="min-w-0 flex-1 bg-transparent text-base font-semibold outline-none placeholder:font-medium placeholder:text-muted-foreground"
              />
            </span>
          </label>

          <fieldset>
            <legend className="mb-1.5 text-base font-extrabold">Dates</legend>
            <div className="grid grid-cols-[auto_1fr_auto_1fr] items-center gap-2 rounded-2xl border border-input bg-card px-4 py-2 shadow-sm focus-within:border-primary focus-within:ring-2 focus-within:ring-ring/30">
              <CalendarDays className="size-5 shrink-0 text-secondary" aria-hidden />
              <label className="min-w-0">
                <span className="block text-[11px] font-bold text-muted-foreground">START</span>
                <input
                  type="date"
                  name="start"
                  required
                  aria-label="Start date"
                  className="w-full min-w-0 bg-transparent text-sm font-semibold outline-none"
                />
              </label>
              <span className="text-muted-foreground" aria-hidden>
                –
              </span>
              <label className="min-w-0">
                <span className="block text-[11px] font-bold text-muted-foreground">END</span>
                <input
                  type="date"
                  name="end"
                  required
                  aria-label="End date"
                  className="w-full min-w-0 bg-transparent text-sm font-semibold outline-none"
                />
              </label>
            </div>
          </fieldset>

          <label className="block">
            <span className="mb-1.5 block text-base font-extrabold">Group size</span>
            <span className="relative flex min-h-14 items-center gap-3 rounded-2xl border border-input bg-card px-4 shadow-sm focus-within:border-primary focus-within:ring-2 focus-within:ring-ring/30">
              <Users className="size-5 shrink-0 text-secondary" aria-hidden />
              <select
                name="count"
                defaultValue="4"
                className="min-h-12 min-w-0 flex-1 appearance-none bg-transparent pr-8 text-base font-semibold outline-none"
              >
                {Array.from({ length: 12 }, (_, index) => index + 1).map((count) => (
                  <option value={count} key={count}>
                    {count} {count === 1 ? "person" : "people"}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-4 size-5 text-secondary" aria-hidden />
            </span>
          </label>

          <Button type="submit" className="w-full text-lg">
            Start a trip <ArrowRight className="size-6" aria-hidden />
          </Button>
        </form>

        <p className="mt-4 text-center text-sm text-muted-foreground">
          Have an invite?{" "}
          <Link to="/join" className="font-bold text-secondary">
            Join a trip
          </Link>
          {" · "}
          <Link to="/welcome" className="font-bold text-secondary">
             Why CommonRoute?
          </Link>
        </p>


        {!hasDemo ? (
          <div className="mt-5 border-t border-border pt-4 text-center">
            <Button
              type="button"
              variant="ghost"
              className="mx-auto min-h-11 text-sm"
              onClick={() => {
                window.scrollTo({ top: 0, behavior: "instant" });
                startDemoTrip();
              }}
            >
              <Sparkles className="size-4" aria-hidden /> Explore Japan in Demo mode
            </Button>
          </div>
        ) : null}

        <p className="mt-4 text-center text-xs font-extrabold leading-5 text-secondary">
           Plan together. Find your common route.
        </p>
      </div>
    </section>
  );
}
