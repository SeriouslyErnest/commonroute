import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useState } from "react";
import { Clock, Lock, Mail, ShieldCheck } from "lucide-react";
import { AppShell } from "@/components/kintrip/AppShell";
import { Button, Card, Field, LinkButton, inputClass } from "@/components/kintrip/ui";
import { joinTripByCode } from "@/lib/kintrip/store";
import { sendSignInLink, useAccount } from "@/lib/kintrip/auth";
import {
  cancelJoinRequest,
  myInviteAccess,
  peekInvite,
  requestToJoin,
} from "@/lib/kintrip/trip-access.functions";

export const Route = createFileRoute("/join")({
  validateSearch: (search: Record<string, unknown>): { code?: string } =>
    typeof search["code"] === "string" && search["code"] ? { code: search["code"] } : {},
  head: () => ({
    meta: [
      { title: "Join a group trip — CommonRoute" },
      {
        name: "description",
        content: "Sign in with your email, then ask the organiser to let you into the group's trip.",
      },
      { property: "og:title", content: "Join a group trip — CommonRoute" },
      {
        property: "og:description",
        content: "Sign in with your email, then ask the organiser to let you into the group's trip.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: JoinTrip,
});

function PrivacyNote() {
  return (
    <Card className="space-y-2 text-sm">
      <p className="flex items-start gap-2 font-semibold">
        <ShieldCheck className="mt-0.5 size-5 shrink-0 text-secondary" aria-hidden /> How your group's privacy is protected
      </p>
      <ul className="list-disc space-y-1 pl-6 text-muted-foreground">
        <li>An invite link on its own shows only the trip's name.</li>
        <li>You sign in with your email so the organiser knows who is asking.</li>
        <li>The organiser approves each person before they can see who's going, the plan, votes or anyone's needs.</li>
        <li>Only the organiser sees your request, with your email partly hidden.</li>
      </ul>
    </Card>
  );
}

function JoinTrip() {
  const { code } = Route.useSearch();
  const { session, loading } = useAccount();
  if (!code) return <JoinWithoutInvite />;
  if (loading) {
    return (
      <AppShell title="Opening your invite…">
        <Card className="py-7 text-center text-muted-foreground">One moment.</Card>
      </AppShell>
    );
  }
  return session ? <SignedInJoin code={code} /> : <SignedOutJoin code={code} />;
}

function NotFound() {
  return (
    <AppShell title="We couldn't find that trip" back={{ to: "/", label: "Back" }}>
      <Card className="py-7 text-center">
        <p className="text-muted-foreground">
          This invite link may have expired or been typed incorrectly. Ask the organiser to send it again.
        </p>
      </Card>
    </AppShell>
  );
}

function SignedOutJoin({ code }: { code: string }) {
  const peek = useServerFn(peekInvite);
  const [title, setTitle] = useState<string | null | undefined>(undefined);
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    peek({ data: { code } })
      .then((r) => setTitle(r?.title ?? null))
      .catch(() => setTitle(null));
  }, [code, peek]);

  if (title === undefined) {
    return (
      <AppShell title="Opening your invite…">
        <Card className="py-7 text-center text-muted-foreground">One moment.</Card>
      </AppShell>
    );
  }
  if (title === null) return <NotFound />;

  return (
    <AppShell title={`You're invited to ${title}`} subtitle="Sign in with your email to ask to join.">
      <Card>
        {sent ? (
          <div className="space-y-3 text-center" role="status">
            <Mail className="mx-auto size-10 text-secondary" aria-hidden />
            <h2 className="text-xl">Check your email</h2>
            <p className="text-sm text-muted-foreground">
              We sent a sign-in link to <strong>{email}</strong>. Open it on this device to continue your invite. It can take a minute to arrive — check spam too.
            </p>
            <Button variant="ghost" onClick={() => setSent(false)}>Use a different email</Button>
          </div>
        ) : (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              const value = email.trim();
              if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) || value.length > 255) {
                setError("Please enter a valid email address.");
                return;
              }
              setBusy(true);
              setError("");
              sendSignInLink(value, `/join?code=${encodeURIComponent(code)}`)
                .then(() => setSent(true))
                .catch(() => setError("We couldn't send the email. Please try again in a moment."))
                .finally(() => setBusy(false));
            }}
          >
            <Field label="Your email">
              <input
                type="email"
                autoComplete="email"
                className={inputClass}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </Field>
            {error ? <p className="text-sm font-semibold text-destructive">{error}</p> : null}
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? "Sending…" : "Email me a sign-in link"}
            </Button>
            <p className="text-center text-xs text-muted-foreground">No password needed — just tap the link we send.</p>
          </form>
        )}
      </Card>
      <PrivacyNote />
    </AppShell>
  );
}

type Standing = { tripId: string; title: string; status: string } | null | undefined;

function SignedInJoin({ code }: { code: string }) {
  const navigate = useNavigate();
  const check = useServerFn(myInviteAccess);
  const request = useServerFn(requestToJoin);
  const cancel = useServerFn(cancelJoinRequest);
  const [standing, setStanding] = useState<Standing>(undefined);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const refresh = useCallback(() => {
    check({ data: { code } })
      .then((r) => setStanding(r))
      .catch(() => setStanding(null));
  }, [check, code]);

  useEffect(refresh, [refresh]);

  useEffect(() => {
    if (standing?.status !== "approved") return;
    void joinTripByCode(code).then((id) => {
      if (id) void navigate({ to: "/preferences" });
      else setStanding(null);
    });
  }, [standing, code, navigate]);

  // While waiting, quietly check every 20 seconds so approval opens the trip.
  useEffect(() => {
    if (standing?.status !== "pending") return;
    const id = setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, 20000);
    return () => clearInterval(id);
  }, [standing, refresh]);

  if (standing === undefined || standing?.status === "approved") {
    return (
      <AppShell title="Opening your group's trip…">
        <Card className="py-7 text-center text-muted-foreground">One moment while we check your access.</Card>
      </AppShell>
    );
  }
  if (standing === null) return <NotFound />;

  if (standing.status === "pending") {
    return (
      <AppShell title="Waiting for the organiser" subtitle={standing.title}>
        <Card className="space-y-3 text-center">
          <Clock className="mx-auto size-10 text-secondary" aria-hidden />
          <h2 className="text-xl">Your request has been sent</h2>
          <p className="text-sm text-muted-foreground">
            Please ask the organiser to approve you. You'll be able to see and vote on this trip once they do. Nothing about the trip is shared with you until then.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Button onClick={refresh}>Check again</Button>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => {
                setBusy(true);
                cancel({ data: { code } })
                  .then(refresh)
                  .finally(() => setBusy(false));
              }}
            >
              Cancel my request
            </Button>
          </div>
        </Card>
        <PrivacyNote />
      </AppShell>
    );
  }

  if (standing.status === "declined" || standing.status === "removed") {
    return (
      <AppShell title={standing.title} back={{ to: "/trips", label: "My trips" }}>
        <Card className="space-y-2 py-6 text-center">
          <Lock className="mx-auto size-10 text-muted-foreground" aria-hidden />
          <p className="text-muted-foreground">
            {standing.status === "declined"
              ? "The organiser hasn't added you to this trip. If you think this is a mistake, please contact them directly."
              : "You no longer have access to this trip. Please contact the organiser if you think this is a mistake."}
          </p>
        </Card>
      </AppShell>
    );
  }

  return (
    <AppShell title={`Ask to join ${standing.title}`} subtitle="Tell the organiser who you are.">
      <Card>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            setBusy(true);
            setError("");
            request({
              data: {
                code,
                name: String(f.get("name") ?? ""),
                relationship: String(f.get("relationship") ?? ""),
                ageGroup: String(f.get("age") ?? "adult"),
              },
            })
              .then(refresh)
              .catch(() => setError("We couldn't send your request. Please try again."))
              .finally(() => setBusy(false));
          }}
        >
          <Field label="Your name">
            <input name="name" className={inputClass} maxLength={60} required />
          </Field>
          <Field label="Relationship to the organiser">
            <input name="relationship" placeholder="e.g. Cousin" className={inputClass} maxLength={60} required />
          </Field>
          <Field label="Age group">
            <select name="age" className={inputClass} defaultValue="adult">
              <option value="child">Child</option>
              <option value="teen">Teen</option>
              <option value="adult">Adult</option>
              <option value="senior">Senior</option>
            </select>
          </Field>
          {error ? <p className="text-sm font-semibold text-destructive">{error}</p> : null}
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? "Sending…" : "Ask to join"}
          </Button>
        </form>
      </Card>
      <PrivacyNote />
    </AppShell>
  );
}

function JoinWithoutInvite() {
  return (
    <AppShell
      title="Join a group trip"
      subtitle="Your organiser’s invite link connects you to the right trip."
      back={{ to: "/", label: "Back" }}
    >
      <Card className="py-7 text-center">
        <h2 className="text-xl">Open your CommonRoute invite</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          Ask the trip organiser to send you their shareable link, then open it on this device. You’ll sign in with your email and the organiser approves you before the trip opens.
        </p>
      </Card>
      <div className="text-center">
        <LinkButton to="/create" variant="outline">Create your own trip instead</LinkButton>
      </div>
    </AppShell>
  );
}
