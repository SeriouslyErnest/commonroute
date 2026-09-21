import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Check, Gift, Lock, Sparkles } from "lucide-react";
import { AppShell } from "@/components/kintrip/AppShell";
import { Button, Card, Chip, Field, inputClass } from "@/components/kintrip/ui";
import { OFFERS } from "@/lib/kintrip/offers";
import { useCommerce } from "@/lib/kintrip/useCommerce";
import { useKintrip } from "@/lib/kintrip/store";
import { startCheckout, redeemPromotion, trackEvent } from "@/lib/kintrip/commerce.functions";

/**
 * Plans and prices (P16). Remixed from the original Kintrip project.
 *
 * Everything listed here is a function that exists today. Ideas still being
 * explored are labelled as planned and are never sold.
 */

const title = "Plans and prices — CommonRoute";
const description =
  "Free group planning for everyone, with an optional one-time pass for advanced comparisons on a trip.";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PricingScreen,
});

function PricingScreen() {
  const state = useKintrip();
  const { commerce, isDemo, refresh } = useCommerce();
  const [code, setCode] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void trackEvent({ data: { name: "pricing_viewed", props: { surface: "pricing" } } }).catch(() => {});
  }, []);

  const covered = commerce.offerCode !== "free" && commerce.offerCode !== "preview";

  async function buy(offerCode: string) {
    setBusy(true);
    setMessage(null);
    try {
      const result = await startCheckout({
        data: { tripId: state.trip.id, offerCode, tripEnd: state.trip.endDate },
      });
      if (result.status === "already_covered") setMessage("This trip already has a pass.");
      else if (result.status === "provider_unavailable")
        setMessage(
          "Payments are not switched on for this site yet, so nothing was charged. Your request is saved and you can finish it once payment is available.",
        );
      else setMessage("Your payment is being set up.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
      void refresh();
    }
  }

  async function redeem() {
    setBusy(true);
    setMessage(null);
    try {
      const result = await redeemPromotion({
        data: { tripId: state.trip.id, code, tripEnd: state.trip.endDate },
      });
      setMessage(result.ok ? "Code applied. This trip now has a pass." : result.reason);
      setCode("");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
      void refresh();
    }
  }

  return (
    <AppShell title="Plans and prices" subtitle="Free to plan together. Pay once only if you want the advanced comparisons.">
      {isDemo ? (
        <Card className="bg-primary-soft p-5">
          <Chip tone="primary">Demo trip</Chip>
          <p className="mt-2 text-sm leading-6">
            You are exploring the sample Japan trip. It stays on this device, nothing is charged, and the
            advanced tools are unlocked here so you can see what they do.
          </p>
        </Card>
      ) : covered ? (
        <Card className="bg-primary-soft p-5">
          <Chip tone="primary">Trip Plus active</Chip>
          <p className="mt-2 text-sm leading-6">
            {commerce.jobQuota - commerce.jobsUsed} of {commerce.jobQuota} advanced comparisons left for this
            trip{commerce.expiresAt ? `, until ${new Date(commerce.expiresAt).toLocaleDateString()}` : ""}.
          </p>
        </Card>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        {OFFERS.map((offer) => (
          <Card key={offer.code} className="flex flex-col p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-xl">{offer.name}</h2>
              {offer.available ? null : <Chip tone="neutral">Planned</Chip>}
            </div>
            <p className="mt-1 text-2xl font-extrabold">{offer.priceLabel}</p>
            <p className="mt-2 text-sm text-muted-foreground">{offer.summary}</p>
            <ul className="mt-4 flex-1 space-y-2 text-sm">
              {offer.includes.map((line) => (
                <li key={line} className="flex gap-2">
                  <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
            {offer.code === "free" ? (
              <p className="mt-5 text-sm font-semibold text-muted-foreground">Always included</p>
            ) : offer.available ? (
              <Button
                className="mt-5"
                disabled={busy || covered || isDemo}
                onClick={() => void buy(offer.code)}
              >
                <Sparkles className="size-5" aria-hidden /> Get {offer.name}
              </Button>
            ) : (
              <p className="mt-5 flex items-center gap-2 text-sm text-muted-foreground">
                <Lock className="size-4" aria-hidden /> Not on sale yet
              </p>
            )}
          </Card>
        ))}
      </div>

      <Card className="p-5">
        <h2 className="text-lg">Have a code?</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Pilot and thank-you codes apply a pass to the trip you are viewing.
        </p>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <Field label="Code">
              <input
                className={inputClass}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="e.g. PILOT2026"
                autoCapitalize="characters"
              />
            </Field>
          </div>
          <Button variant="outline" disabled={busy || !code.trim() || isDemo} onClick={() => void redeem()}>
            <Gift className="size-5" aria-hidden /> Apply code
          </Button>
        </div>
        {message ? <p className="mt-3 text-sm font-semibold">{message}</p> : null}
      </Card>

      <Card className="p-5">
        <h2 className="text-lg">What you can count on</h2>
        <ul className="mt-2 space-y-2 text-sm leading-6 text-muted-foreground">
          <li>A pass covers one trip and every traveller in it. Invited travellers never pay.</li>
          <li>Paying never changes anyone’s role, and never overrides an approval.</li>
          <li>Spreadsheet and calendar exports stay free, whatever plan you are on.</li>
          <li>If a pass ends, your plan stays exactly as it is — only the advanced tools stop.</li>
          <li>The Japan demo is free, stays on your device, and is never linked to an account.</li>
        </ul>
      </Card>
    </AppShell>
  );
}
