import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import symbol from "@/assets/commonroute-symbol.png.asset.json";
import { LanguageToggle } from "@/lib/i18n";
import welcome from "@/assets/guide/welcome.jpg";
import signin from "@/assets/guide/signin.jpg";
import join from "@/assets/guide/join.jpg";
import trips from "@/assets/guide/acct-trips.jpg";
import create from "@/assets/guide/acct-create.jpg";
import invite from "@/assets/guide/acct-newtrip.jpg";
import prefs from "@/assets/guide/demo-preferences.jpg";
import discover from "@/assets/guide/demo-discover.jpg";
import ideas from "@/assets/guide/demo-ideas.jpg";
import consensus from "@/assets/guide/demo-consensus.jpg";
import itinerary from "@/assets/guide/demo-itinerary.jpg";
import family from "@/assets/guide/demo-family.jpg";
import ready from "@/assets/guide/demo-getting-ready.jpg";
import home from "@/assets/guide/demo-home.jpg";
import replan from "@/assets/guide/demo-replan.jpg";
import arrangements from "@/assets/guide/demo-arrangements.jpg";
import exportShot from "@/assets/guide/demo-export.jpg";
import account from "@/assets/guide/acct-account.jpg";

export const Route = createFileRoute("/guide")({
  head: () => ({
    meta: [
      { title: "CommonRoute user guide — How to plan a group trip" },
      {
        name: "description",
        content:
          "Illustrated step-by-step help for organisers and travellers: signing in, inviting, sharing needs, voting, building and publishing the plan, getting ready and re-planning on the trip.",
      },
      { property: "og:title", content: "CommonRoute user guide" },
      {
        property: "og:description",
        content: "Illustrated guide to signing in, inviting your group, building one plan and coordinating during the trip.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: GuidePage,
});

type Shot = { src: string; alt: string };
type Section = { id: string; title: string; intro: string; steps: string[]; tip?: string; shots: Shot[] };

const SECTIONS: Section[] = [
  {
    id: "sign-in",
    title: "1. Get started and sign in",
    intro: "Planning a real trip needs an account, so your trips follow you to any device.",
    steps: [
      "Open CommonRoute and tap \"Register or sign in\".",
      "Enter your email and tap \"Email me a sign-in link\".",
      "Open the email on the same device and tap the link. You are signed in — there is no password to remember.",
      "Just curious? Tap \"Try the demo trip first\" to explore a sample Japan trip. It stays on this device and is never shared.",
    ],
    shots: [
      { src: welcome, alt: "Welcome screen with sign-in, demo and invite code options" },
      { src: signin, alt: "Sign-in screen asking for an email address" },
    ],
  },
  {
    id: "join",
    title: "2. Join a trip someone invited you to",
    intro: "Travellers can join with an invite link or code, even without an account.",
    steps: [
      "Open the invite link your organiser shared, or tap \"I have an invite code\" on the welcome screen.",
      "Pick who you are from the traveller list, or add yourself.",
      "Sign in later if you want the trip on your other devices too.",
    ],
    shots: [{ src: join, alt: "Join a group trip screen" }],
  },
  {
    id: "create",
    title: "3. Create a trip and invite your group",
    intro: "Organisers set up the trip once, then share one link.",
    steps: [
      "From My trips, tap \"Create a new trip\".",
      "Type the destination, choose the start and end dates, then create the trip.",
      "Share the invite by WhatsApp, email or by copying the link.",
      "Everyone who joins appears under \"Who's on board\" with their progress.",
    ],
    shots: [
      { src: trips, alt: "My trips list with a Penang trip" },
      { src: create, alt: "New trip form with destination filled in" },
      { src: invite, alt: "Invite screen with share buttons and who's on board" },
    ],
  },
  {
    id: "needs",
    title: "4. Share what matters to you",
    intro: "Each person answers a few short questions so the plan fits the whole group.",
    steps: [
      "Tap \"Share my preferences\" and choose your interests, pace and how much walking suits you.",
      "Something only for a few days? Add a trip setting instead of changing your usual answers.",
      "Helpers can answer for a traveller they look after, such as a child or an older relative. Settings entered by someone else need confirming.",
      "Private needs are only seen by organisers and the person's helper.",
    ],
    shots: [
      { src: prefs, alt: "Preferences questions with interest choices" },
      { src: family, alt: "Travel group screen showing what the plan respects" },
    ],
  },
  {
    id: "discover",
    title: "5. Find places and vote",
    intro: "Everyone suggests places and votes only for themselves.",
    steps: [
      "On Discover, search for places at your destination and open them on the map.",
      "Vote Must go, Would like, Don't mind or Skip for each place.",
      "Found something while browsing? Save an idea with just a name, note or link. Ideas without a location stay out of the plan until one is picked.",
      "The group summary shows strong favourites and places people disagree on.",
    ],
    shots: [
      { src: discover, alt: "Discover screen with places and voting buttons" },
      { src: ideas, alt: "Save an idea form" },
      { src: consensus, alt: "Where the group stands summary" },
    ],
  },
  {
    id: "plan",
    title: "6. Build and publish the plan",
    intro: "CommonRoute turns the votes and needs into one realistic day-by-day plan.",
    steps: [
      "Tap \"Build our itinerary\" from the group summary.",
      "Check the group fit notes, then move, remove or lock stops for each day.",
      "Organisers review any warnings and tap \"Publish to the group\". Everyone then sees the latest published plan.",
      "Try another plan anytime, or print it and save it as a PDF.",
    ],
    shots: [{ src: itinerary, alt: "Recommended plan with group fit notes and day cards" }],
  },
  {
    id: "ready",
    title: "7. Get ready",
    intro: "Keep jobs, packing and bookings in one place.",
    steps: [
      "Getting ready holds jobs, packing lists and anything waiting for a reply.",
      "Assign a job to someone, add a due date and mark it done.",
      "Use More tools on the trip home for bookings, stays, rooms and vehicles, starter lists and saving days offline.",
    ],
    shots: [{ src: ready, alt: "Getting ready screen with jobs and packing" }],
  },
  {
    id: "trip",
    title: "8. On the trip",
    intro: "The trip home shows today's plan and the next stop.",
    steps: [
      "Check the next activity, navigate there, or skip it.",
      "Plans change? Tap Re-plan, pick what happened — rain, running late, too tired — and CommonRoute keeps as much of the day as it can.",
      "Propose a temporary change, like a later start or a taxi for one stop. Organisers decide what goes into the plan.",
      "Ask quietly for a rest. Only organisers and a named helper see the reason.",
    ],
    shots: [
      { src: home, alt: "Trip home showing today's next activity" },
      { src: replan, alt: "Re-plan my day screen" },
      { src: arrangements, alt: "Temporary arrangements screen" },
    ],
  },
  {
    id: "after",
    title: "9. Afterwards",
    intro: "Keep a copy and learn for next time.",
    steps: [
      "Export the plan as a spreadsheet or a calendar file.",
      "Answer three optional questions about what worked. Nothing is shared unless you tick it.",
    ],
    shots: [{ src: exportShot, alt: "Export plan screen with spreadsheet and calendar formats" }],
  },
  {
    id: "account",
    title: "10. Your account",
    intro: "Manage your name and sign-in email.",
    steps: [
      "Change the name your group sees, or your sign-in email.",
      "Sign out of every device, or delete your account.",
    ],
    shots: [{ src: account, alt: "Account settings screen" }],
  },
];

function GuidePage() {
  return (
    <main className="min-h-screen bg-background pb-16">
      <header className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-4">
        <Link to="/about" className="inline-flex min-h-11 items-center gap-2 text-sm font-bold text-secondary">
          <ArrowLeft className="size-4" aria-hidden /> About
        </Link>
        <img src={symbol.url} alt="CommonRoute symbol" className="size-10 object-contain" />
        <LanguageToggle />
      </header>
      <section className="mx-auto max-w-5xl px-4">
        <h1 className="text-3xl sm:text-4xl">User guide</h1>
        <p className="mt-2 text-base text-muted-foreground">
          Everything you need to plan a trip together, in the order you will need it.
        </p>
        <nav aria-label="Guide contents" className="kin-card mt-6 p-5">
          <h2 className="text-lg">Contents</h2>
          <ol className="mt-2 grid gap-1 sm:grid-cols-2">
            {SECTIONS.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className="inline-flex min-h-11 items-center font-semibold text-secondary">
                  {s.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>
        <div className="mt-6 space-y-5">
          {SECTIONS.map((s) => (
            <article key={s.id} id={s.id} className="kin-card scroll-mt-4 p-5 sm:p-6">
              <h2 className="text-xl sm:text-2xl">{s.title}</h2>
              <p className="mt-1 text-base text-muted-foreground">{s.intro}</p>
              <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-base">
                {s.steps.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ol>
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {s.shots.map((shot) => (
                  <figure key={shot.src} className="min-w-0">
                    <img
                      src={shot.src}
                      alt={shot.alt}
                      loading="lazy"
                      width={390}
                      height={844}
                      className="h-auto w-full rounded-2xl border border-border shadow-sm"
                    />
                  </figure>
                ))}
              </div>
            </article>
          ))}
        </div>
        <p className="mt-6 text-xs text-muted-foreground">
          Screenshots show the sample Japan demo trip and a sample Penang trip. Last updated: 26 September 2026.
        </p>
      </section>
    </main>
  );
}
