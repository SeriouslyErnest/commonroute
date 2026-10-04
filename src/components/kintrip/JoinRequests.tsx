import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useState } from "react";
import { Check, ShieldCheck, UserMinus, UserPlus, X } from "lucide-react";
import { Button, Card, Chip } from "@/components/kintrip/ui";
import { decideTripAccess, listTripAccess } from "@/lib/kintrip/trip-access.functions";
import { pullActiveTrip, useKintrip, useTripSetupStatus } from "@/lib/kintrip/store";
import { isOrganiser } from "@/lib/kintrip/governance";

type Row = Awaited<ReturnType<typeof listTripAccess>>[number];

function useAccessList() {
  const state = useKintrip();
  const { demoActive } = useTripSetupStatus();
  const list = useServerFn(listTripAccess);
  const enabled = !demoActive && !!state.trip.shareCode && isOrganiser(state);
  const tripId = state.trip.id;
  const [rows, setRows] = useState<Row[] | null>(null);
  const [failed, setFailed] = useState(false);
  const refresh = useCallback(() => {
    if (!enabled) return;
    list({ data: { tripId } })
      .then((r) => {
        setRows(r);
        setFailed(false);
      })
      .catch(() => setFailed(true));
  }, [enabled, list, tripId]);
  useEffect(refresh, [refresh]);
  return { enabled, rows, failed, refresh, tripId };
}

/** Home-screen nudge for organisers when people are waiting. */
export function JoinRequestsBanner() {
  const { enabled, rows } = useAccessList();
  const pending = rows?.filter((r) => r.status === "pending").length ?? 0;
  if (!enabled || !pending) return null;
  return (
    <Link to="/invite" className="kin-card flex items-center gap-3 border-2 border-primary p-4">
      <UserPlus className="size-6 shrink-0 text-secondary" aria-hidden />
      <span className="flex-1">
        <span className="block font-bold">
          {pending === 1 ? "1 person is asking to join" : `${pending} people are asking to join`}
        </span>
        <span className="block text-sm text-muted-foreground">Review join requests</span>
      </span>
    </Link>
  );
}

/** Organiser mini-dashboard: requests to approve, and people with access. */
export function JoinRequestsPanel() {
  const { enabled, rows, failed, refresh, tripId } = useAccessList();
  const decide = useServerFn(decideTripAccess);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState("");
  if (!enabled) return null;

  async function act(userId: string, decision: "approve" | "decline" | "remove") {
    setBusy(userId);
    setNote("");
    try {
      await decide({ data: { tripId, userId, decision } });
      refresh();
      if (decision === "approve") void pullActiveTrip();
    } catch {
      setNote("That didn't work — check your connection and try again.");
    } finally {
      setBusy(null);
    }
  }

  const pending = rows?.filter((r) => r.status === "pending") ?? [];
  const members = rows?.filter((r) => r.status === "approved") ?? [];

  return (
    <Card className="space-y-4">
      <div>
        <h2 className="text-lg">Join requests</h2>
        <p className="mt-1 flex items-start gap-2 text-sm text-muted-foreground">
          <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
          People who open your invite link sign in with their email and wait here. They see only the trip's name until you approve them.
        </p>
      </div>
      {failed ? (
        <div className="space-y-2">
          <p className="text-sm">Couldn't load requests.</p>
          <Button variant="outline" onClick={refresh}>Try again</Button>
        </div>
      ) : rows === null ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <>
          {pending.length === 0 ? (
            <p className="text-sm text-muted-foreground">No one is waiting right now.</p>
          ) : (
            <ul className="space-y-3">
              {pending.map((r) => (
                <li key={r.userId} className="rounded-xl border border-border p-3">
                  <p className="font-semibold">{r.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {r.relationship} · {r.ageGroup} · {r.email}
                  </p>
                  <p className="text-xs text-muted-foreground">Asked {new Date(r.requestedAt).toLocaleString()}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button disabled={busy === r.userId} onClick={() => void act(r.userId, "approve")}>
                      <Check className="size-5" aria-hidden /> Approve
                    </Button>
                    <Button variant="outline" disabled={busy === r.userId} onClick={() => void act(r.userId, "decline")}>
                      <X className="size-5" aria-hidden /> Decline
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <div className="border-t border-border pt-3">
            <h3 className="font-bold">People with access</h3>
            <ul className="mt-2 space-y-2">
              {members.map((r) => (
                <li key={r.userId} className="flex flex-wrap items-center justify-between gap-2">
                  <span>
                    <span className="block font-semibold">{r.name}{r.self ? " (you)" : ""}</span>
                    {r.email ? <span className="block text-xs text-muted-foreground">{r.email}</span> : null}
                  </span>
                  {r.role === "organiser" ? (
                    <Chip tone="lime">Organiser</Chip>
                  ) : (
                    <Button
                      variant="ghost"
                      disabled={busy === r.userId}
                      onClick={() => {
                        if (!window.confirm(`Remove ${r.name}? They will stop seeing this trip straight away.`)) return;
                        void act(r.userId, "remove");
                      }}
                    >
                      <UserMinus className="size-5" aria-hidden /> Remove
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
      {note ? <p role="status" className="text-sm font-semibold">{note}</p> : null}
    </Card>
  );
}
