import { useMemo } from "react";
import { Coins, TriangleAlert } from "lucide-react";
import { Card, Chip } from "@/components/kintrip/ui";
import { PaidGate } from "@/components/kintrip/PaidGate";
import { costImpact } from "@/lib/kintrip/compare";
import type { ItineraryDay, KintripState } from "@/lib/kintrip/types";

/**
 * The money side of a replan (P08). Remixed from the original Kintrip project.
 *
 * Amounts come only from what the group recorded. A stop with no refund policy
 * recorded is shown as unknown — never assumed refundable — and nothing here
 * cancels or buys anything.
 */
export function CostImpact({
  state,
  original,
  revised,
}: {
  state: KintripState;
  original: ItineraryDay;
  revised: ItineraryDay;
}) {
  const dropped = useMemo(() => {
    const kept = new Set(
      revised.items.map((i) => i.attractionId).filter((id): id is string => Boolean(id)),
    );
    return original.items
      .map((i) => i.attractionId)
      .filter((id): id is string => Boolean(id) && !kept.has(id));
  }, [original, revised]);

  const impact = useMemo(() => costImpact(state, dropped), [state, dropped]);
  if (dropped.length === 0) return null;

  const money = (minor: number) => `${impact.currency} ${(minor / 100).toFixed(0)}`;

  return (
    <PaidGate
      feature="cost_replan"
      preview="Shows what has already been paid for the stops this change drops, what is known to be refundable, and who would need to approve again."
    >
      <Card className="p-5">
        <Chip tone="sunny">
          <Coins className="size-4" aria-hidden /> Money already committed
        </Chip>
        <p className="mt-3 text-sm">
          Already paid for the dropped stops: <strong>{money(impact.alreadyPaidMinor)}</strong>
        </p>
        <p className="text-sm">
          Known to be refundable: <strong>{money(impact.refundableMinor)}</strong>
        </p>
        {impact.unknownPolicy.length > 0 ? (
          <p className="mt-2 flex items-start gap-2 text-sm text-secondary">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
            No refund policy recorded for {impact.unknownPolicy.join(", ")}. Treat these as not refundable
            until someone checks.
          </p>
        ) : null}
        {impact.sponsorReapproval.length > 0 ? (
          <p className="mt-2 text-sm">
            Whoever is paying would need to approve again: {impact.sponsorReapproval.join(", ")}.
          </p>
        ) : null}
        <p className="mt-3 text-sm text-muted-foreground">
          CommonRoute never cancels or buys anything. This only shows what the change would mean.
        </p>
      </Card>
    </PaidGate>
  );
}
