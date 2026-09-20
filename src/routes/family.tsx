import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2, Footprints, Gauge, Heart, ShieldCheck } from "lucide-react";
import { AppShell } from "@/components/kintrip/AppShell";
import { Card, Chip, LinkButton } from "@/components/kintrip/ui";
import { familyWalkingLimit } from "@/lib/kintrip/engine";
import { useKintrip } from "@/lib/kintrip/store";

export const Route = createFileRoute("/family")({
  head: () => ({
    meta: [
      { title: "Your travel group — CommonRoute" },
      {
        name: "description",
        content: "See who has joined the trip, what matters to each traveller and what to plan around.",
      },
      { property: "og:title", content: "Your travel group — CommonRoute" },
      {
        property: "og:description",
        content: "Who has joined, what each traveller enjoys, and the needs the plan respects.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: FamilyTab,
});

function FamilyTab() {
  const state = useKintrip();
  const limit = familyWalkingLimit(state);

  return (
    <AppShell title="Your travel group" subtitle={`${state.travellers.length} ${state.travellers.length === 1 ? "traveller" : "travellers"} on this trip`}>
      <Card className="bg-secondary-soft">
        <h2 className="flex items-center gap-2 text-lg">
          <ShieldCheck className="size-5 text-secondary" aria-hidden /> What the plan respects
        </h2>
        <p className="mt-1 text-sm">
          Walking is kept to a <strong>{limit}</strong> level overall, with rests after busier
          stretches and a slower afternoon on the fuller days.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <LinkButton to="/preferences" variant="secondary">
            Update preferences
          </LinkButton>
          <LinkButton to="/invite" variant="outline">
            Invite more people
          </LinkButton>
          <LinkButton to="/roles" variant="outline">
            Roles and decisions
          </LinkButton>
          <LinkButton to="/review" variant="outline">
            Review suggestions
          </LinkButton>
          <LinkButton to="/sponsor" variant="outline">
            Money decisions
          </LinkButton>
          <LinkButton to="/fairness" variant="outline">
            Everyone gets a win
          </LinkButton>
          <LinkButton to="/bookings" variant="outline">
            Bookings and stay
          </LinkButton>
          <LinkButton to="/getting-ready" variant="outline">
            Getting ready
          </LinkButton>
          <LinkButton to="/updates" variant="outline">
            What&apos;s changed
          </LinkButton>
        </div>
      </Card>

      <HelpPanel />

      <div className="grid gap-3 sm:grid-cols-2">
        {state.travellers.map((t) => (
          <Card key={t.id} className="space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="text-lg">{t.name}</h2>
                <p className="text-sm text-muted-foreground">
                  {t.relationship} · {t.ageGroup}
                </p>
              </div>
               {t.prefStatus === "complete" ? (
                 <span className="inline-flex shrink-0 items-center gap-1 text-xs font-bold text-muted-foreground" aria-label="Preferences complete">
                   <CheckCircle2 className="size-4 text-primary" aria-hidden /> Complete
                 </span>
               ) : (
                 <Chip tone="sunny">Preferences not started</Chip>
               )}
            </div>
            <p className="flex flex-wrap gap-2">
              {t.responsibleAdultId && t.managementMode === "assisted" ? (
                <Chip tone="primary">
                  {t.assistAccepted === false
                    ? `Waiting for ${t.name} to accept help`
                    : `Helped by ${state.travellers.find((x) => x.id === t.responsibleAdultId)?.name ?? "an adult"}`}
                </Chip>
              ) : null}
              {t.canVote === false ? <Chip tone="sunny">No vote · needs still counted</Chip> : null}
            </p>
            <p className="flex flex-wrap gap-2 text-sm">
              {t.preferences.interests.map((i) => (
                <Chip key={i} tone="primary">
                  <Heart className="size-3" aria-hidden /> {i}
                </Chip>
              ))}
            </p>
            <p className="flex flex-wrap gap-3 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Gauge className="size-4" aria-hidden /> {t.preferences.pace} pace
              </span>
              <span className="inline-flex items-center gap-1">
                <Footprints className="size-4" aria-hidden /> {t.preferences.walking} walking
              </span>
            </p>
            {t.preferences.constraints ? (
              <p className="rounded-xl bg-muted px-3 py-2 text-sm">{t.preferences.constraints}</p>
            ) : null}
          </Card>
        ))}
      </div>

      <p className="pb-4 text-center text-sm text-muted-foreground">
        Starting a different trip?{" "}
        <Link to="/create" className="font-semibold text-secondary">
          Create a new trip
        </Link>
      </p>
    </AppShell>
  );
}

/** Add and manage people who need someone to answer on their behalf. */
function HelpPanel() {
  const state = useKintrip();
  const me = state.activeTravellerId;
  const organiser = isOrganiser(state);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    relationship: "",
    ageGroup: "child" as Traveller["ageGroup"],
    canVote: false,
    confirmed: false,
  });

  const adults = state.travellers.filter((t) => t.ageGroup === "adult" || t.ageGroup === "senior");

  return (
    <Card className="space-y-3">
      <h2 className="flex items-center gap-2 text-lg">
        <UserPlus className="size-5 text-primary" aria-hidden /> People who need a hand
      </h2>
      <p className="text-sm text-muted-foreground">
        A child or a relative without their own sign-in can still be part of the trip. A named adult
        enters their needs and answers, and every entry says who made it. Helping someone never gives
        that adult extra say over the trip or the money.
      </p>

      {organiser ? (
        <Button type="button" variant="outline" onClick={() => setOpen((o) => !o)}>
          <UserPlus className="size-4" aria-hidden /> Add someone I look after
        </Button>
      ) : null}

      {open ? (
        <div className="space-y-3 rounded-xl bg-muted p-3">
          <Field label="Their name">
            <input
              className={inputClass}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </Field>
          <Field label="Relationship to you">
            <input
              className={inputClass}
              value={form.relationship}
              onChange={(e) => setForm({ ...form, relationship: e.target.value })}
              placeholder="Daughter"
            />
          </Field>
          <Field label="Age group">
            <select
              className={inputClass}
              value={form.ageGroup}
              onChange={(e) => setForm({ ...form, ageGroup: e.target.value as Traveller["ageGroup"] })}
            >
              <option value="child">Child</option>
              <option value="teen">Teenager</option>
              <option value="adult">Adult</option>
              <option value="senior">Older adult</option>
            </select>
          </Field>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-1 size-5"
              checked={form.canVote}
              onChange={(e) => setForm({ ...form, canVote: e.target.checked })}
            />
            They should have a vote on places
          </label>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-1 size-5"
              checked={form.confirmed}
              onChange={(e) => setForm({ ...form, confirmed: e.target.checked })}
            />
            I confirm I look after this person on this trip and may answer for them.
          </label>
          <Button
            type="button"
            disabled={!form.name.trim() || !form.confirmed}
            onClick={() => {
              addAssistedTraveller({
                name: form.name,
                relationship: form.relationship,
                ageGroup: form.ageGroup,
                managerId: me,
                canVote: form.canVote,
                responsibilityConfirmed: form.confirmed,
              });
              setForm({ name: "", relationship: "", ageGroup: "child", canVote: false, confirmed: false });
              setOpen(false);
            }}
          >
            Add them
          </Button>
        </div>
      ) : null}

      <ul className="space-y-2">
        {state.travellers.map((t) => {
          const helped = t.managementMode === "assisted" && !!t.responsibleAdultId;
          const iAmHelper = helped && t.responsibleAdultId === me;
          const canChange = organiser || t.id === me || iAmHelper;
          if (!helped && !organiser) return null;
          return (
            <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-muted px-3 py-2">
              <div>
                <p className="font-semibold">{t.name}</p>
                <p className="text-xs text-muted-foreground">
                  {helped
                    ? t.assistAccepted === false
                      ? "Help offered — not accepted yet"
                      : `Helped by ${state.travellers.find((x) => x.id === t.responsibleAdultId)?.name ?? "an adult"}`
                    : "Answers for themselves"}
                  {t.canVote === false ? " · no vote" : ""}
                </p>
              </div>
              <span className="flex flex-wrap gap-2">
                {!helped && organiser ? (
                  <select
                    className={inputClass}
                    value=""
                    aria-label={`Choose who helps ${t.name}`}
                    onChange={(e) => e.target.value && assignHelper(t.id, e.target.value)}
                  >
                    <option value="">Who helps them?</option>
                    {adults
                      .filter((a) => a.id !== t.id)
                      .map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                  </select>
                ) : null}
                {helped && t.assistAccepted === false && t.id === me ? (
                  <Button type="button" onClick={() => acceptHelp(t.id)}>
                    Yes, they can help me
                  </Button>
                ) : null}
                {helped && canChange ? (
                  <Button type="button" variant="outline" onClick={() => revokeHelp(t.id)}>
                    Stop the help
                  </Button>
                ) : null}
                {organiser ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setVotingEligibility(t.id, t.canVote === false)}
                  >
                    {t.canVote === false ? "Give them a vote" : "No vote for them"}
                  </Button>
                ) : null}
              </span>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
