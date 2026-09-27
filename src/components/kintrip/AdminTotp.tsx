import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button, Card, Field, inputClass } from "@/components/kintrip/ui";

/**
 * Operator-only authenticator step (TOTP). Travellers never see this; it runs
 * only inside the operations console. The server independently refuses every
 * admin action unless the session has completed this step (aal2).
 */
export function AdminTotp({ onDone }: { onDone: () => void }) {
  const [factorId, setFactorId] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { data, error } = await supabase.auth.mfa.listFactors();
        if (error) throw error;
        const verified = data.totp.find((f) => f.status === "verified");
        if (verified) {
          setFactorId(verified.id);
        } else {
          // Clear half-finished enrolments, then start a fresh one.
          for (const f of data.all.filter((x) => x.factor_type === "totp" && x.status !== "verified")) {
            await supabase.auth.mfa.unenroll({ factorId: f.id });
          }
          const en = await supabase.auth.mfa.enroll({
            factorType: "totp",
            friendlyName: `CommonRoute ops ${Date.now()}`,
          });
          if (en.error) throw en.error;
          setFactorId(en.data.id);
          setQr(en.data.totp.qr_code);
          setSecret(en.data.totp.secret);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not start the authenticator step.");
      } finally {
        setReady(true);
      }
    })();
  }, []);

  async function verify() {
    if (!factorId) return;
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: code.trim() });
    setBusy(false);
    if (error) {
      setError("That code didn't work. Check your authenticator app and try again.");
      return;
    }
    onDone();
  }

  if (!ready) return <Card>Checking…</Card>;

  return (
    <Card>
      <h1 className="text-xl font-extrabold">Authenticator code required</h1>
      {qr ? (
        <div className="mt-3 space-y-2 text-sm">
          <p>Scan this with an authenticator app (Google Authenticator, 1Password, Authy…) to set up operator access.</p>
          <img src={qr} alt="Authenticator setup QR code" className="h-48 w-48 rounded bg-card" />
          {secret && (
            <p className="break-all text-muted-foreground">
              Or enter this key manually: <code>{secret}</code>
            </p>
          )}
        </div>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">Enter the 6-digit code from your authenticator app.</p>
      )}
      <form
        className="mt-4 flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void verify();
        }}
      >
        <Field label="6-digit code">
          <input
            className={inputClass}
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          />
        </Field>
        <Button type="submit" disabled={busy || code.length !== 6}>
          {busy ? "Checking…" : "Verify"}
        </Button>
      </form>
      {error && <p className="mt-2 text-sm text-destructive" role="alert">{error}</p>}
    </Card>
  );
}
