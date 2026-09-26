import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AlertTriangle, ArrowRight, X } from "lucide-react";
import { Card } from "@/components/kintrip/ui";
import { useKintrip } from "@/lib/kintrip/store";
import { pickUpCards, type PickUpCard } from "@/lib/kintrip/enhancements";
import { dismissCue, pickUpState } from "@/lib/kintrip/enhancements.actions";

/**
 * "Pick up planning" — at most three current, actionable cues. Derived from
 * the trip's own records every render, so resolved items disappear on their
 * own. Opening this never acknowledges a plan change.
 */
export function PickUpPlanning({ secondary = false }: { secondary?: boolean }) {
  const state = useKintrip();
  const me = state.activeTravellerId;
  const [seen, setSeen] = useState<{ version?: number | undefined; dismissed: string[] } | null>(null);

  useEffect(() => {
    setSeen(pickUpState(state.trip.id, me));
  }, [state.trip.id, me]);

  if (!seen) return null;
  const all = pickUpCards(state, { viewerId: me, lastSeenVersion: seen.version });
  // Critical items can never be dismissed away.
  const open = all.filter((c) => c.critical || !seen.dismissed.includes(c.id));
  if (open.length === 0) return null;
  const top = open.slice(0, 3);
  const blocking = all.filter((c) => c.tier === 1).length;

  const dismiss = (c: PickUpCard) => {
    dismissCue(state.trip.id, me, c.id);
    setSeen(pickUpState(state.trip.id, me));
  };

  return (
    <Card className={secondary ? "p-4" : "p-5"}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg">Pick up planning</h2>
        <Link to="/readiness" className="text-sm font-semibold underline">
          See all{open.length > 3 ? ` ${open.length}` : ""}
          {blocking > 0 ? ` · ${blocking} need attention` : ""}
        </Link>
      </div>
      <ul className="mt-3 grid gap-2 sm:grid-cols-3">
        {top.map((c) => (
          <li key={c.id} className="kin-card flex items-start gap-2 p-3">
            <Link to={c.to} className="flex min-h-11 min-w-0 flex-1 items-start gap-2">
              {c.critical || c.tier === 1 ? <AlertTriangle className="mt-0.5 size-4 shrink-0 text-secondary" aria-hidden /> : null}
              <span className="min-w-0">
                <span className="block font-semibold leading-snug">{c.title}</span>
                <span className="block text-xs text-muted-foreground">{c.hint}</span>
              </span>
              <ArrowRight className="ml-auto mt-0.5 size-4 shrink-0" aria-hidden />
            </Link>
            {!c.critical ? (
              <button type="button" className="grid size-11 shrink-0 place-items-center rounded-full" aria-label={`Hide: ${c.title}`} onClick={() => dismiss(c)}>
                <X className="size-4" aria-hidden />
              </button>
            ) : null}
          </li>
        ))}
      </ul>
    </Card>
  );
}
