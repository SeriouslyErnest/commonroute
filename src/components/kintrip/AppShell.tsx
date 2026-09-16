import { Link, useRouterState } from "@tanstack/react-router";
import { CalendarRange, Compass, Map, Users, WifiOff } from "lucide-react";
import type { ReactNode } from "react";
import logo from "@/assets/kintrip-logo.png.asset.json";
import { useKintrip, useOnline } from "@/lib/kintrip/store";
import { cn } from "@/lib/utils";

const tabs = [
  { to: "/", label: "Trip", icon: CalendarRange },
  { to: "/discover", label: "Discover", icon: Compass },
  { to: "/itinerary", label: "Itinerary", icon: Map },
  { to: "/family", label: "Family", icon: Users },
] as const;

export function OfflineBar() {
  const online = useOnline();
  const state = useKintrip();
  if (online) return null;
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

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-20 border-b border-border bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
          <Link to="/" className="flex items-center gap-2">
            <img src={logo.url} alt="Kintrip" className="h-9 w-auto" />
          </Link>
          <p className="hidden text-sm text-muted-foreground sm:block">
            Many generations. One journey. Shared memories.
          </p>
          <Link
            to="/trips"
            className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-border px-4 text-sm font-semibold text-secondary"
          >
            <Layers className="size-4" aria-hidden /> My trips
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl px-4 py-5">
        <div className="space-y-4">
          <OfflineBar />
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

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card">
        <ul className="mx-auto flex max-w-5xl">
          {tabs.map(({ to, label, icon: Icon }) => {
            const active = to === "/" ? pathname === "/" : pathname.startsWith(to);
            return (
              <li key={to} className="flex-1">
                <Link
                  to={to}
                  className={cn(
                    "flex min-h-16 flex-col items-center justify-center gap-1 py-2 text-xs font-semibold",
                    active ? "text-primary" : "text-muted-foreground",
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
    </div>
  );
}
