import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { LogIn, Sparkles, Ticket, Users, MapPinned, CalendarCheck } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { useServerFn } from "@tanstack/react-start";
import { myApprovalStatus } from "@/lib/kintrip/account.functions";
import { signOutEverything } from "@/lib/kintrip/auth";
import symbol from "@/assets/commonroute-symbol.png.asset.json";
import { Button, Card } from "@/components/kintrip/ui";
import { useAccount } from "@/lib/kintrip/auth";
import { startDemoTrip, useTripSetupStatus } from "@/lib/kintrip/store";
import { LanguageToggle } from "@/lib/i18n";

/**
 * Planning needs an account. Only the local-only demo trip stays open without
 * one. The /join page handles its own sign-in, then organiser approval.
 */
const PUBLIC_PREFIXES = [
  "/auth",
  "/join",
  "/invite",
  "/about",
  "/guide",
  "/pricing",
  "/ops/console",
  "/admin",
];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export function AccountGate({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { session, loading } = useAccount();
  const { demoActive } = useTripSetupStatus();

  const check = useServerFn(myApprovalStatus);
  const [approval, setApproval] = useState<"approved" | "pending" | "rejected" | null>(null);
  const [tick, setTick] = useState(0);
  const userId = session?.user?.id ?? null;
  useEffect(() => {
    if (!userId) {
      setApproval(null);
      return;
    }
    let live = true;
    check()
      .then((r) => live && setApproval(r.status))
      .catch(() => live && setApproval("approved"));
    return () => {
      live = false;
    };
  }, [userId, tick, check]);

  if (isPublicPath(pathname) || demoActive) return <>{children}</>;
  if (session) {
    if (approval === null) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-background">
          <p className="text-sm text-muted-foreground">Loading…</p>
        </div>
      );
    }
    if (approval !== "approved") return <Waiting status={approval} onRetry={() => setTick((t) => t + 1)} />;
    return <>{children}</>;
  }
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }
  return <Welcome pathname={pathname} />;
}

function Welcome({ pathname }: { pathname: string }) {
  const navigate = useNavigate();
  return (
    <main className="flex min-h-screen flex-col items-center bg-background px-4 py-10">
      <div className="w-full max-w-lg space-y-5">
        <div className="flex justify-end">
          <LanguageToggle />
        </div>
        <div className="flex flex-col items-center gap-3 text-center">
          <img src={symbol.url} alt="CommonRoute symbol" className="size-16 object-contain" />
          <h1 className="text-3xl font-extrabold text-secondary">Welcome to CommonRoute</h1>
          <p className="text-base text-muted-foreground">
            Plan one trip together. Everyone shares what matters to them, and CommonRoute turns it
            into a single realistic day-by-day plan.
          </p>
        </div>

        <Card className="space-y-3">
          <p className="flex items-start gap-3 text-sm">
            <Users className="mt-0.5 size-5 shrink-0 text-secondary" aria-hidden />
            <span>Invite your group and collect everyone's preferences and practical needs.</span>
          </p>
          <p className="flex items-start gap-3 text-sm">
            <MapPinned className="mt-0.5 size-5 shrink-0 text-secondary" aria-hidden />
            <span>Vote on places, then see one plan that actually works for the whole group.</span>
          </p>
          <p className="flex items-start gap-3 text-sm">
            <CalendarCheck className="mt-0.5 size-5 shrink-0 text-secondary" aria-hidden />
            <span>Re-plan a day when the weather, energy levels or bookings change.</span>
          </p>
        </Card>

        <Card className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Create your account or sign in to start planning. It's a one-tap email link — no
            password to remember.
          </p>
          <Link
            to="/auth"
            search={{ next: pathname }}
            className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-primary px-5 font-bold text-primary-foreground"
          >
            <LogIn className="size-5" aria-hidden /> Register or sign in
          </Link>
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => {
              startDemoTrip();
              void navigate({ to: "/" });
            }}
          >
            <Sparkles className="size-5" aria-hidden /> Try the demo trip first
          </Button>
          <Link
            to="/join"
            className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-border bg-card px-5 font-bold text-secondary"
          >
            <Ticket className="size-5" aria-hidden /> I have an invite code
          </Link>
        </Card>

        <p className="text-center text-sm">
          <Link to="/about" className="font-semibold text-secondary">
            About CommonRoute
          </Link>
          {" · "}
          <Link to="/guide" className="font-semibold text-secondary">
            User guide
          </Link>
        </p>
      </div>
    </main>
  );
}

function Waiting({ status, onRetry }: { status: "pending" | "rejected"; onRetry: () => void }) {
  const navigate = useNavigate();
  return (
    <main className="flex min-h-screen flex-col items-center bg-background px-4 py-10">
      <div className="w-full max-w-lg space-y-5">
        <div className="flex justify-end">
          <LanguageToggle />
        </div>
        <div className="flex flex-col items-center gap-3 text-center">
          <img src={symbol.url} alt="CommonRoute symbol" className="size-16 object-contain" />
          <h1 className="text-2xl font-extrabold text-secondary">
            {status === "pending" ? "Thanks for signing up" : "This account wasn't approved"}
          </h1>
          <p className="text-base text-muted-foreground">
            {status === "pending"
              ? "Your account is waiting for approval. You'll be able to start planning as soon as it's approved."
              : "Please contact the people who run CommonRoute if you think this is a mistake."}
          </p>
        </div>
        <Card className="space-y-3">
          {status === "pending" && (
            <Button type="button" className="w-full" onClick={onRetry}>
              Check again
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => {
              startDemoTrip();
              void navigate({ to: "/" });
            }}
          >
            <Sparkles className="size-5" aria-hidden /> Try the demo trip meanwhile
          </Button>
          <Button type="button" variant="outline" className="w-full" onClick={() => void signOutEverything()}>
            Sign out
          </Button>
        </Card>
      </div>
    </main>
  );
}
