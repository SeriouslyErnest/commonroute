import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { ArrowLeft, CalendarRange, Check, Cloud, CloudOff, Compass, Layers, Map, Users, WifiOff } from "lucide-react";
import type { ReactNode } from "react";
import symbol from "@/assets/commonroute-symbol.png.asset.json";
import { Button } from "@/components/kintrip/ui";
import { exitDemoTrip, useKintrip, useOnline, useTripSetupStatus, useTripSync } from "@/lib/kintrip/store";
import { cn } from "@/lib/utils";

function SyncBadge() {
  const status = useTripSync();
  if (status === "off") return null;
  const map = {
    saving: { icon: Cloud, text: "Saving for your group…" },
    synced: { icon: Check, text: "Shared with your group" },
    offline: { icon: CloudOff, text: "Offline — changes save when you reconnect" },
    error: { icon: CloudOff, text: "Couldn't reach your group's trip — retrying" },
  } as const;
  const entry = map[status];
  const Icon = entry.icon;
  return (
    <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
      <Icon className="size-4" aria-hidden /> {entry.text}
    </p>
  );
}

const tabs = [
  { to: "/", label: "Trip", icon: CalendarRange },
  { to: "/discover", label: "Discover", icon: Compass },
  { to: "/itinerary", label: "Itinerary", icon: Map },
  { to: "/family", label: "Group", icon: Users },
] as const;

export function OfflineBar() {
  const online = useOnline();
  const { hasTrips } = useTripSetupStatus();
  if (online || !hasTrips) return null;
  return <ActiveTripOfflineBar />;
}

function ActiveTripOfflineBar() {
  const state = useKintrip();
  return (
    <div className="flex items-start gap-2 rounded-xl bg-sunny-soft px-4 py-3 text-sm text-foreground">
      <WifiOff className="mt-0.5 size-4 shrink-0" aria-hidden />
      <p>
        <span className="font-semibold">Offline — showing your latest saved itinerary.</span>{" "}
        Connect to the internet to refresh live information.
        {state.cachedAt ? (
          <span className="block text-muted-foreground">
            Saved {new Date(state.cachedAt).toLocaleString("en-GB")}
          </span>
        ) : null}
      </p>
    </div>
  );
}

export function AppShell({
  title,
  subtitle,
  children,
  back,
}: {
  title?: string;
  subtitle?: string;
  children: ReactNode;
  back?: { to: string; label: string };
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const { hasTrips, demoActive } = useTripSetupStatus();

  return (
    <div className="min-h-screen bg-background pb-40 sm:pb-32">
      <header className="sticky top-0 z-20 border-b border-border bg-card/95">
        <div className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-4 py-3 sm:grid-cols-[1fr_auto_1fr] sm:px-6">
          <Link to="/" className="flex items-center gap-2">
            <img src={symbol.url} alt="" className="size-11 object-contain" />
            <span className="font-display text-xl font-extrabold text-secondary">CommonRoute</span>
          </Link>
          <p className="hidden text-sm text-muted-foreground sm:block">
            Plan together. Find your common route.
          </p>
          {demoActive ? (
            <Button
              type="button"
              variant="outline"
              className="min-h-11 shrink-0 px-3 text-sm sm:justify-self-end"
              onClick={() => {
                exitDemoTrip();
                void navigate({ to: "/" });
              }}
            >
              <ArrowLeft className="size-4" aria-hidden /> Back to start
            </Button>
          ) : (
            <Link
              to="/trips"
              className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-2xl border border-border bg-card px-4 text-sm font-bold text-secondary shadow-sm sm:justify-self-end"
            >
              <Layers className="size-4" aria-hidden /> My trips
            </Link>
          )}
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 py-5 sm:px-6 sm:py-7">
        <div className="space-y-4">
          <OfflineBar />
          <SyncBadge />
          {back ? (
            <Link to={back.to} className="inline-flex text-sm font-semibold text-secondary">
              ← {back.label}
            </Link>
          ) : null}
          {title ? (
            <div>
              <h1 className="text-2xl sm:text-3xl">{title}</h1>
              {subtitle ? <p className="mt-1 text-muted-foreground">{subtitle}</p> : null}
            </div>
          ) : null}
          {children}
        </div>
      </main>

      {hasTrips ? (
        <nav className="fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-30 mx-auto max-w-md rounded-2xl border border-border bg-secondary px-2 shadow-lift sm:bottom-5">
          <ul className="mx-auto flex">
            {tabs.map(({ to, label, icon: Icon }) => {
              const active = to === "/" ? pathname === "/" : pathname.startsWith(to);
              return (
                <li key={to} className="flex-1">
                  <Link
                    to={to}
                    className={cn(
                      "flex min-h-16 flex-col items-center justify-center gap-1 rounded-2xl py-2 text-[11px] font-bold transition-colors",
                       active ? "bg-card/10 text-success" : "text-secondary-foreground/70 hover:text-secondary-foreground",
                    )}
                  >
                    <Icon className="size-6" aria-hidden />
                    {label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      ) : null}
    </div>
  );
}
