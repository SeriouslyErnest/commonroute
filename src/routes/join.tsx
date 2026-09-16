import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/kintrip/AppShell";
import { Button, Card, Field, LinkButton, inputClass } from "@/components/kintrip/ui";
import { joinTripByCode, setState, useKintrip, useTripSetupStatus } from "@/lib/kintrip/store";
import type { AgeGroup } from "@/lib/kintrip/types";

export const Route = createFileRoute("/join")({
  validateSearch: (search: Record<string, unknown>): { code?: string } =>
    typeof search["code"] === "string" && search["code"] ? { code: search["code"] } : {},
  head: () => ({
    meta: [
      { title: "Join a family trip — Kintrip" },
      {
        name: "description",
        content: "Join your family's trip with your name and relationship — no account needed.",
      },
      { property: "og:title", content: "Join a family trip — Kintrip" },
      {
        property: "og:description",
        content: "Join your family's trip with your name and relationship — no account needed.",
      },
    ],
  }),
  component: JoinTrip,
});

function JoinTrip() {
  const { hasTrips } = useTripSetupStatus();
  const { code } = Route.useSearch();
  const state = useKintrip();
  const [status, setStatus] = useState<"idle" | "loading" | "notfound">("idle");

  const alreadyHere = !!code && state.trip.shareCode === code;
  useEffect(() => {
    if (!code || alreadyHere) return;
    setStatus("loading");
    void joinTripByCode(code).then((id) => setStatus(id ? "idle" : "notfound"));
  }, [code, alreadyHere]);

  if (code && status === "loading") {
    return (
      <AppShell title="Opening your family's trip…">
        <Card className="py-7 text-center text-muted-foreground">One moment while we load the latest plan.</Card>
      </AppShell>
    );
  }
  if (code && status === "notfound") {
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
  if (!hasTrips) return <JoinWithoutInvite />;
  return <JoinKnownTrip />;
}

function JoinWithoutInvite() {
  return (
    <AppShell
      title="Join a family trip"
      subtitle="Your organiser’s invite link connects you to the right trip."
      back={{ to: "/", label: "Back" }}
    >
      <Card className="py-7 text-center">
        <h2 className="text-xl">Open your Kintrip invite</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          Ask the trip organiser to send you their shareable link, then open it on this device. You won’t need an account.
        </p>
      </Card>
      <div className="text-center">
        <LinkButton to="/create" variant="outline">Create your own trip instead</LinkButton>
      </div>
    </AppShell>
  );
}

function JoinKnownTrip() {
  const state = useKintrip();
  const navigate = useNavigate();

  return (
    <AppShell
      title={`You're joining ${state.trip.title}`}
      subtitle={`${state.trip.destination} · ${state.travellers.filter((t) => t.joined).length} family members already here`}
      back={{ to: "/", label: "Back to trip" }}
    >
      <Card>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            const id = `t${Date.now()}`;
            setState((prev) => ({
              ...prev,
              activeTravellerId: id,
              travellers: [
                ...prev.travellers,
                {
                  id,
                  name: String(f.get("name")),
                  relationship: String(f.get("relationship")),
                  ageGroup: String(f.get("age")) as AgeGroup,
                  role: "member",
                  joined: true,
                  prefStatus: "not_started",
                  preferences: {
                    interests: [],
                    pace: "balanced",
                    walking: "moderate",
                    mustDo: "",
                    avoid: "",
                    constraints: "",
                  },
                },
              ],
            }));
            void navigate({ to: "/preferences" });
          }}
        >
          <Field label="Your name">
            <input name="name" className={inputClass} required />
          </Field>
          <Field label="Relationship to the organiser">
            <input name="relationship" placeholder="e.g. Cousin" className={inputClass} required />
          </Field>
          <Field label="Age group">
            <select name="age" className={inputClass} defaultValue="adult">
              <option value="child">Child</option>
              <option value="teen">Teen</option>
              <option value="adult">Adult</option>
              <option value="senior">Senior</option>
            </select>
          </Field>
          <Button type="submit" className="w-full">
            Join trip
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="w-full"
            onClick={() => void navigate({ to: "/" })}
          >
            Skip preferences for now
          </Button>
        </form>
      </Card>
    </AppShell>
  );
}
