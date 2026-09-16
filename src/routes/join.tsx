import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/kintrip/AppShell";
import { Button, Card, Field, inputClass } from "@/components/kintrip/ui";
import { setState, useKintrip } from "@/lib/kintrip/store";
import type { AgeGroup } from "@/lib/kintrip/types";

export const Route = createFileRoute("/join")({
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
