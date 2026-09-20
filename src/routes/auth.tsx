import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Mail, CheckCircle2 } from "lucide-react";
import symbol from "@/assets/commonroute-symbol.png.asset.json";
import { Button, Card, Field, inputClass } from "@/components/kintrip/ui";
import { safeReturnPath, sendSignInLink, useAccount } from "@/lib/kintrip/auth";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — CommonRoute" },
      {
        name: "description",
        content:
          "Sign in to CommonRoute with a one-tap email link. No password, no codes — your trips follow you to any device.",
      },
      { property: "og:title", content: "Sign in — CommonRoute" },
      {
        property: "og:description",
        content: "One-tap email link sign-in for your CommonRoute trips.",
      },
    ],
  }),
  validateSearch: (search: Record<string, unknown>): { next?: string } =>
    typeof search['next'] === "string" ? { next: search['next'] as string } : {},
  component: AuthPage,
});

function AuthPage() {
  const { next } = Route.useSearch();
  const { session, loading } = useAccount();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && session) {
      void navigate({ to: safeReturnPath(next), replace: true });
    }
  }, [loading, session, next, navigate]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await sendSignInLink(email, next ?? "/trips");
      setSent(true);
    } catch (err) {
      setError(
        err instanceof Error && err.message
          ? err.message
          : "We couldn't send the link just now. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md space-y-5">
        <div className="flex flex-col items-center gap-2 text-center">
          <img src={symbol.url} alt="" className="size-14 object-contain" />
          <h1 className="text-2xl font-extrabold text-secondary">Sign in to CommonRoute</h1>
          <p className="text-sm text-muted-foreground">
            We'll email you a link that signs you straight in. No password, no code to type.
          </p>
        </div>

        <Card>
          {sent ? (
            <div className="space-y-3 text-center">
              <CheckCircle2 className="mx-auto size-8 text-success" aria-hidden />
              <h2 className="text-lg font-bold text-foreground">Check your email</h2>
              <p className="text-sm text-muted-foreground">
                We sent a sign-in link to <span className="font-semibold">{email}</span>. Open it on
                this device and you'll be signed in. The link works for a short time only.
              </p>
              <Button type="button" variant="outline" onClick={() => setSent(false)}>
                Use a different email
              </Button>
            </div>
          ) : (
            <form className="space-y-4" onSubmit={submit}>
              <Field label="Your email">
                <input
                  className={inputClass}
                  type="email"
                  required
                  autoComplete="email"
                  inputMode="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </Field>
              {error ? <p className="text-sm font-semibold text-destructive">{error}</p> : null}
              <Button type="submit" className="w-full" disabled={busy}>
                <Mail className="size-4" aria-hidden />
                {busy ? "Sending…" : "Email me a sign-in link"}
              </Button>
              <p className="text-xs text-muted-foreground">
                Signing in keeps your trips on your account, so they're there on your phone and your
                laptop. You can still join a trip with an invite code without signing in.
              </p>
            </form>
          )}
        </Card>

        <p className="text-center text-sm">
          <Link to="/" className="font-semibold text-secondary">
            ← Back to CommonRoute
          </Link>
        </p>
      </div>
    </div>
  );
}
