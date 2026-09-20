import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Handshake, Sparkles, Users } from "lucide-react";
import { AppShell } from "@/components/kintrip/AppShell";
import { Button, Card, Chip } from "@/components/kintrip/ui";
import { consensusFor, generateItinerary, VOTE_LABEL } from "@/lib/kintrip/engine";
import { setState, useKintrip } from "@/lib/kintrip/store";

export const Route = createFileRoute("/consensus")({
  head: () => ({
    meta: [
      { title: "Where the group stands — CommonRoute" },
      {
        name: "description",
        content:
          "Strong favourites, mixed preferences and key considerations — turned into something you can act on.",
      },
      { property: "og:title", content: "Where the group stands — CommonRoute" },
      {
        property: "og:description",
        content: "Strong favourites, mixed preferences and key considerations in one summary.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ConsensusPage,
});

function ConsensusPage() {
  const state = useKintrip();
  const navigate = useNavigate();
  const rows = consensusFor(state);
  const strong = rows.filter((r) => r.group === "strong");
  const mixed = rows.filter((r) => r.group === "mixed");
  const alignment = rows.filter((r) => r.group === "alignment");

  return (
    <AppShell
       title="Where the group stands"
      subtitle={`${rows.length} places reviewed`}
      back={{ to: "/discover", label: "Back to discover" }}
    >
      <div className="grid grid-cols-3 gap-3">
        <Summary label="Strong favourites" value={strong.length} tone="lime" />
        <Summary label="Mixed preferences" value={mixed.length} tone="sunny" />
        <Summary label="Thoughtful planning" value={alignment.length} tone="secondary" />
      </div>

      <Section
        icon={<Sparkles className="size-5 text-primary" aria-hidden />}
         title="Strong group favourites"
        rows={strong}
      />
      <Section
        icon={<Users className="size-5 text-secondary" aria-hidden />}
        title="Mixed preferences"
        rows={mixed}
      />
      <Section
        icon={<Handshake className="size-5 text-secondary" aria-hidden />}
        title="Thoughtful planning"
        rows={alignment}
        actions
      />

      <div className="flex justify-center pb-6">
        <Button
          onClick={() => {
            setState((prev) => ({ ...prev, itinerary: generateItinerary(prev) }));
            void navigate({ to: "/itinerary" });
          }}
        >
          Build our itinerary
        </Button>
      </div>
    </AppShell>
  );
}

function Summary({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "lime" | "sunny" | "secondary";
}) {
  const bg = { lime: "bg-lime-soft", sunny: "bg-sunny-soft", secondary: "bg-secondary-soft" }[tone];
  return (
    <div className={`rounded-2xl ${bg} p-4 text-center`}>
      <p className="text-3xl font-extrabold">{value}</p>
      <p className="text-xs font-semibold">{label}</p>
    </div>
  );
}

function Section({
  icon,
  title,
  rows,
  actions,
}: {
  icon: React.ReactNode;
  title: string;
  rows: ReturnType<typeof consensusFor>;
  actions?: boolean;
}) {
  const state = useKintrip();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  if (rows.length === 0) return null;
  return (
    <section className="space-y-3">
      <h2 className="flex items-center gap-2 text-xl">
        {icon} {title}
      </h2>
      <div className="grid gap-3 lg:grid-cols-2">
        {rows.map((r) => (
        <Card key={r.attraction.id} className="space-y-2 lg:flex lg:flex-col">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="text-lg font-bold">{r.attraction.name}</h3>
              <p className="text-sm text-muted-foreground">
                {r.attraction.area}, {r.attraction.city}
              </p>
            </div>
            <Chip tone="primary">{r.counts.MUST_GO} must go</Chip>
          </div>
          <p className="text-sm">{r.note}</p>
           <button
             type="button"
             className="w-fit text-sm font-bold text-secondary"
             aria-expanded={expanded[r.attraction.id] ?? false}
             onClick={() => setExpanded((current) => ({ ...current, [r.attraction.id]: !current[r.attraction.id] }))}
           >
             {expanded[r.attraction.id] ? "Hide individual votes" : `View all ${r.votesCast} votes`}
           </button>
           {expanded[r.attraction.id] ? (
             <div className="flex flex-wrap gap-1.5">
               {state.travellers.map((t) => {
                 const v = state.votes[t.id]?.[r.attraction.id];
                 if (!v) return null;
                 return (
                   <span key={t.id} className="rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">
                     {t.name.split(",")[0]}: {VOTE_LABEL[v]}
                   </span>
                 );
               })}
             </div>
           ) : null}
          {actions ? (
            <div className="flex flex-wrap gap-2 pt-1">
              <Chip tone="lime">Suggested: keep</Chip>
              <Chip tone="sunny">Shorten the route</Chip>
              <Chip tone="secondary">Replace with a gentler option</Chip>
            </div>
          ) : null}
        </Card>
        ))}
      </div>
    </section>
  );
}
