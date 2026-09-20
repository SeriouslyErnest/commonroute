import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { LogOut, User } from "lucide-react";
import { AppShell } from "@/components/kintrip/AppShell";
import { Button, Card, Field, LinkButton, inputClass } from "@/components/kintrip/ui";
import { signOutEverything, useAccount } from "@/lib/kintrip/auth";
import { getProfile, updateProfile } from "@/lib/kintrip/account.functions";
import { linkAccountTrips, useTripList } from "@/lib/kintrip/store";

export const Route = createFileRoute("/account")({
  head: () => ({
    meta: [
      { title: "Your account — CommonRoute" },
      {
        name: "description",
        content:
          "Your CommonRoute account: the name your group sees, your sign-in email, and the trips saved to your account.",
      },
      { property: "og:title", content: "Your account — CommonRoute" },
      {
        property: "og:description",
        content: "Manage your CommonRoute profile and the trips saved to your account.",
      },
    ],
  }),
  component: AccountPage,
});

function AccountPage() {
  const { session, email, loading } = useAccount();
  const navigate = useNavigate();
  const trips = useTripList();
  const [name, setName] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!session) return;
    void getProfile()
      .then((p) => setName(p.displayName ?? ""))
      .catch(() => undefined);
  }, [session]);

  if (loading) {
    return (
      <AppShell title="Your account">
        <p className="text-muted-foreground">Loading…</p>
      </AppShell>
    );
  }

  if (!session) {
    return (
      <AppShell
        title="Your account"
        subtitle="Sign in with an email link to keep your trips on every device."
      >
        <Card className="space-y-3">
          <p className="text-sm text-muted-foreground">
            You're not signed in. Trips you create stay on this device until you sign in.
          </p>
          <LinkButton to="/auth">Sign in with an email link</LinkButton>
        </Card>
      </AppShell>
    );
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setStatus(null);
    try {
      await updateProfile({ data: { displayName: name } });
      setStatus("Saved");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Couldn't save your name");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell title="Your account" subtitle={email ?? undefined}>
      <div className="space-y-4">
        <Card>
          <form className="space-y-4" onSubmit={save}>
            <Field label="The name your group sees">
              <input
                className={inputClass}
                value={name}
                maxLength={60}
                placeholder="e.g. Ernest"
                onChange={(e) => setName(e.target.value)}
              />
            </Field>
            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" disabled={busy}>
                <User className="size-4" aria-hidden /> {busy ? "Saving…" : "Save"}
              </Button>
              {status ? (
                <span className="text-sm font-semibold text-muted-foreground">{status}</span>
              ) : null}
            </div>
          </form>
        </Card>

        <Card className="space-y-2">
          <h2 className="text-lg font-bold text-foreground">Trips on your account</h2>
          {trips.filter((t) => !t.isDemo).length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No shared trips yet. Create one or join with an invite code and it will be saved here.
            </p>
          ) : (
            <ul className="space-y-1 text-sm text-foreground">
              {trips
                .filter((t) => !t.isDemo)
                .map((t) => (
                  <li key={t.id}>
                    <span className="font-semibold">{t.title}</span>
                    {t.destination ? (
                      <span className="text-muted-foreground"> — {t.destination}</span>
                    ) : null}
                  </li>
                ))}
            </ul>
          )}
          <Button type="button" variant="outline" onClick={() => void linkAccountTrips()}>
            Refresh from my account
          </Button>
          <p className="text-xs text-muted-foreground">
            Demo mode stays on this device only and is never saved to your account.
          </p>
        </Card>

        <Card>
          <Button
            type="button"
            variant="outline"
            onClick={async () => {
              await signOutEverything();
              void navigate({ to: "/", replace: true });
            }}
          >
            <LogOut className="size-4" aria-hidden /> Sign out
          </Button>
        </Card>
      </div>
    </AppShell>
  );
}
