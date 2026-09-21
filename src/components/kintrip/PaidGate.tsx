import type { ReactNode } from "react";
import { Lock, Sparkles } from "lucide-react";
import { Card, Chip, LinkButton } from "@/components/kintrip/ui";
import { FEATURE_LABEL, type FeatureCode } from "@/lib/kintrip/offers";
import { useCommerce } from "@/lib/kintrip/useCommerce";

/**
 * Shows an advanced tool when the trip is covered, and an honest explanation
 * when it is not. Prompts appear on the action itself, never while someone is
 * simply moving around the app. Remixed from the original Kintrip project.
 */
export function PaidGate({
  feature,
  children,
  preview,
}: {
  feature: FeatureCode;
  children: ReactNode;
  /** A short, real description of what the tool would produce. */
  preview?: ReactNode;
}) {
  const { commerce, loading, has, isDemo } = useCommerce();
  if (loading) return null;
  if (isDemo || has(feature)) return <>{children}</>;

  return (
    <Card className="p-5">
      <Chip tone="neutral">
        <Lock className="size-4" aria-hidden /> Trip Plus
      </Chip>
      <h2 className="mt-2 text-lg">{FEATURE_LABEL[feature]}</h2>
      <div className="mt-2 text-sm leading-6 text-muted-foreground">
        {preview ?? "This tool is part of the one-time Trip Plus pass for this trip."}
      </div>
      {commerce.previewAvailable ? (
        <p className="mt-2 text-sm font-semibold">
          You can try it once for free on this trip before deciding.
        </p>
      ) : null}
      <LinkButton to="/pricing" className="mt-4 w-full sm:w-auto">
        <Sparkles className="size-5" aria-hidden /> See what Trip Plus adds
      </LinkButton>
    </Card>
  );
}

/** A compact line showing how much of the shared allowance is left. */
export function AllowanceNote() {
  const { commerce, isDemo } = useCommerce();
  if (isDemo) return <p className="text-sm text-muted-foreground">Demo trip — nothing is counted or charged.</p>;
  if (commerce.jobQuota === 0) return null;
  const left = Math.max(0, commerce.jobQuota - commerce.jobsUsed);
  return (
    <p className="text-sm text-muted-foreground">
      {left} of {commerce.jobQuota} advanced comparisons left for this trip. Each comparison uses one.
    </p>
  );
}
