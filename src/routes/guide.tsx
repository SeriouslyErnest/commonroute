import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import symbol from "@/assets/commonroute-symbol.png.asset.json";
import { LanguageToggle } from "@/lib/i18n";

export const Route = createFileRoute("/guide")({
  head: () => ({
    meta: [
      { title: "CommonRoute user guide — How to plan a group trip" },
      {
        name: "description",
        content: "Step-by-step help for organisers and travellers: signing in, inviting, voting, building the plan, re-planning and coordinating on the trip.",
      },
      { property: "og:title", content: "CommonRoute user guide" },
      { property: "og:description", content: "How to sign in, invite your group, build one plan and coordinate during the trip." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: GuidePage,
});

const SECTIONS: { title: string; points: string[] }[] = [
  {
    title: "1. Sign in",
    points: [
      "Enter your email and tap the link we send you. There is no password to remember.",
      "Want to look around first? Open the Japan demo trip. It stays on this device and is never shared.",
      "Invited by someone? Use \"I have an invite code\" — you can join without an account.",
    ],
  },
  {
    title: "2. Start a trip and invite people",
    points: [
      "Add the destination and dates, then share the invite code from the Group tab.",
      "Organisers can give roles, and helpers can answer for a traveller they look after.",
    ],
  },
  {
    title: "3. Share needs and settings",
    points: [
      "Each person answers a few short questions about pace, walking and rest.",
      "Trip settings show who said them and for which days. A setting entered by someone else needs confirming.",
      "Private needs are only seen by organisers and the person's helper.",
    ],
  },
  {
    title: "4. Find and vote on places",
    points: [
      "Search places on the Discover tab, or save a quick idea with just a name or link.",
      "Everyone votes only for themselves. Ideas without a location stay out of the plan until one is picked.",
    ],
  },
  {
    title: "5. Build and publish the plan",
    points: [
      "The Itinerary tab builds one realistic plan with rests, meals and opening hours.",
      "Organisers review warnings, then publish. The group always sees the latest published plan.",
    ],
  },
  {
    title: "6. Get ready",
    points: [
      "Getting ready holds jobs, packing lists, bookings and anything waiting for a reply.",
      "Pick up planning on the home screen shows the next few things that need you.",
    ],
  },
  {
    title: "7. On the trip",
    points: [
      "Today shows the current day in a simple view. Save days to your phone for use without signal.",
      "Ask quietly for a rest, or propose a temporary change such as a later start. Organisers decide what goes into the plan.",
      "Re-plan when weather or tiredness changes the day.",
    ],
  },
  {
    title: "8. Afterwards",
    points: [
      "Export the plan to a calendar or spreadsheet, and answer three optional questions about what worked.",
    ],
  },
  {
    title: "Your account",
    points: [
      "On the Account page you can change your email, sign out everywhere, or delete your account.",
    ],
  },
];

function GuidePage() {
  return (
    <main className="min-h-screen bg-background pb-16">
      <header className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-4">
        <Link to="/about" className="inline-flex min-h-11 items-center gap-2 text-sm font-bold text-secondary">
          <ArrowLeft className="size-4" aria-hidden /> About
        </Link>
        <img src={symbol.url} alt="CommonRoute symbol" className="size-10 object-contain" />
        <LanguageToggle />
      </header>
      <section className="mx-auto max-w-3xl px-4">
        <h1 className="text-3xl sm:text-4xl">User guide</h1>
        <p className="mt-2 text-base text-muted-foreground">Everything you need to plan a trip together, in the order you will need it.</p>
        <div className="mt-6 space-y-3">
          {SECTIONS.map((s) => (
            <div key={s.title} className="kin-card p-5">
              <h2 className="text-xl">{s.title}</h2>
              <ul className="mt-2 list-disc space-y-1.5 pl-5 text-base text-muted-foreground">
                {s.points.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <p className="mt-6 text-xs text-muted-foreground">Last updated: 26 September 2026.</p>
      </section>
    </main>
  );
}
