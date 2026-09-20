import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  CalendarCheck,
  CloudRain,
  Heart,
  Link2,
  MapPin,
  Sparkles,
  Users,
  WifiOff,
} from "lucide-react";
import logo from "@/assets/commonroute-logo.png.asset.json";
import symbol from "@/assets/commonroute-symbol.png.asset.json";
import coast from "@/assets/kintrip-family-coast.jpg";
import shotStart from "@/assets/app-start.jpg";
import shotDiscover from "@/assets/app-discover.jpg";
import shotItinerary from "@/assets/app-itinerary.jpg";
import shotReplan from "@/assets/app-replan.jpg";

export const Route = createFileRoute("/welcome")({
  head: () => ({
    meta: [
      { title: "CommonRoute — Collaborative trip planning for everyone" },
      {
        name: "description",
        content:
          "Plan family and group trips together. Share preferences, vote on places and build one practical itinerary that works for the whole group.",
      },
      { property: "og:title", content: "CommonRoute — Collaborative trip planning for everyone" },
      {
        property: "og:description",
        content:
          "Share preferences, vote on places and build one practical itinerary that works for the whole group.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: WelcomePage,
});

const STEPS = [
  {
    icon: MapPin,
    title: "Start the trip",
    body: "Destination, dates, group size. That's it — no account, no setup call.",
    image: shotStart,
    alt: "CommonRoute trip setup screen",
  },
  {
    icon: Users,
    title: "Invite and gather",
    body: "One link. Everyone answers five short questions about pace, walking and rest.",
    image: shotDiscover,
    alt: "CommonRoute Discover screen with places and simple voting buttons",
  },
  {
    icon: CalendarCheck,
    title: "Get one clear plan",
    body: "Places grouped by area, meals and rests built in, and a plain-language reason for every choice.",
    image: shotItinerary,
    alt: "CommonRoute itinerary screen showing a recommended group plan",
  },
  {
    icon: CloudRain,
    title: "Re-plan on the day",
    body: "Rain, tiredness, running late — say what changed and get one revised plan in seconds.",
    image: shotReplan,
    alt: "CommonRoute re-plan screen offering a revised afternoon",
  },
];

const FEATURES = [
  {
    icon: Heart,
    title: "Care comes before votes",
    body: "Walking limits, rest needs and opening hours outrank a popular vote — so nobody is quietly left behind.",
  },
  {
    icon: Sparkles,
    title: "One plan, not ten options",
    body: "CommonRoute recommends a single realistic itinerary first, then lets you move, replace or remove anything.",
  },
  {
    icon: Link2,
    title: "Share one living link",
    body: "The plan everyone opens is always the current one. No screenshots, no version confusion.",
  },
  {
    icon: WifiOff,
    title: "Works without signal",
    body: "Today's stops, times, addresses and notes stay readable offline while you're out.",
  },
];

const FAQS = [
  {
    q: "Does everyone need an account?",
    a: "No. Family members open your invite link, add their name and preferences, and start voting.",
  },
  {
    q: "Can grandparents use it?",
    a: "Yes — large buttons, plain wording, and only five short questions to answer.",
  },
  {
    q: "What if plans change mid-trip?",
    a: "Tell CommonRoute what changed and it rebuilds the rest of the day while keeping what still works.",
  },
  {
    q: "Can I plan more than one trip?",
    a: "Yes. Every trip lives in My trips, and you can switch between them anytime.",
  },
];

function WelcomePage() {
  return (
    <main className="min-h-screen bg-background pb-16">
      <header className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-4">
        <span className="flex items-center gap-2">
          <img src={symbol.url} alt="" className="size-11 object-contain" />
          <span className="font-display text-xl font-extrabold text-secondary">CommonRoute</span>
        </span>
        <Link
          to="/"
          className="inline-flex min-h-11 items-center gap-2 rounded-2xl bg-primary px-4 text-sm font-bold text-primary-foreground shadow-sm"
        >
          Plan a trip <ArrowRight className="size-4" aria-hidden />
        </Link>
      </header>

      <section className="relative mx-auto max-w-5xl overflow-hidden px-0 sm:px-4">
        <div className="relative min-h-[520px] overflow-hidden sm:rounded-3xl">
          <img
            src={coast}
            alt="A family of several generations walking together on a coastal path"
            className="absolute inset-0 size-full object-cover"
          />
          <div className="absolute inset-0 bg-foreground/55" />
          <div className="relative px-5 py-12 text-card sm:px-10 sm:py-16">
            <span className="inline-flex items-center gap-2 rounded-full bg-card/20 px-3 py-1 text-xs font-bold">
              <Sparkles className="size-4" aria-hidden /> For families and friends
            </span>
            <h1 className="mt-4 max-w-2xl text-4xl leading-tight sm:text-5xl">
              Plan a trip that works for everyone.
            </h1>
            <p className="mt-4 max-w-xl text-lg font-semibold">
              CommonRoute brings everyone&apos;s ideas, preferences and practical needs into one shared
              plan that the whole group can enjoy.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                to="/"
                className="inline-flex min-h-13 items-center gap-2 rounded-2xl bg-primary px-6 text-base font-bold text-primary-foreground shadow-lg"
              >
                Start planning — it&apos;s free <ArrowRight className="size-5" aria-hidden />
              </Link>
              <a
                href="#how"
                className="inline-flex min-h-13 items-center gap-2 rounded-2xl border border-card/50 bg-card/15 px-6 text-base font-bold text-card"
              >
                See how it works
              </a>
            </div>
            <p className="mt-4 text-sm font-semibold opacity-90">
               Plan together. Find your common route.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-4 pt-14">
        <h2 className="text-2xl sm:text-3xl">Different ages, different needs, one trip</h2>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {[
            "Grandpa can walk, but not for hours without a rest.",
            "The 12-year-old fades by mid-afternoon.",
            "Everyone has a place they'd hate to miss.",
          ].map((line) => (
            <p key={line} className="kin-card p-4 text-base font-semibold">
              {line}
            </p>
          ))}
        </div>
        <p className="mt-5 text-lg text-muted-foreground">
          Group chats, spreadsheets and screenshots don&apos;t solve that. CommonRoute does — clearly, and
          without anyone feeling like the difficult one.
        </p>
      </section>

      <section id="how" className="mx-auto max-w-5xl px-4 pt-16">
        <h2 className="text-2xl sm:text-3xl">From scattered wishes to one workable plan</h2>
        <div className="mt-8 space-y-4 sm:space-y-2">
          {STEPS.map((s, i) => (
            <div
              key={s.title}
              className={`grid items-center gap-6 sm:grid-cols-2 ${i % 2 ? "sm:[&>figure]:order-first" : ""}`}
            >
              <div>
                <span className="inline-flex items-center gap-2 rounded-full bg-primary-soft px-3 py-1 text-xs font-bold">
                  <s.icon className="size-4" aria-hidden /> Step {i + 1}
                </span>
                <h3 className="mt-3 text-xl">{s.title}</h3>
                <p className="mt-2 text-base text-muted-foreground">{s.body}</p>
              </div>
              <figure className="flex justify-center">
                <img
                  src={s.image}
                  alt={s.alt}
                  loading="lazy"
                  width={747}
                  height={1600}
                  className="h-[340px] w-auto rounded-3xl border border-border object-cover object-top shadow-lg"
                />
              </figure>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 pt-16">
        <h2 className="text-2xl sm:text-3xl">Why families stick with it</h2>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {FEATURES.map((f) => (
            <div key={f.title} className="kin-card p-5">
              <f.icon className="size-6 text-primary" aria-hidden />
              <h3 className="mt-3 text-lg">{f.title}</h3>
              <p className="mt-1.5 text-base text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-4 pt-16">
        <h2 className="text-2xl sm:text-3xl">Questions families ask</h2>
        <dl className="mt-6 space-y-3">
          {FAQS.map((f) => (
            <div key={f.q} className="kin-card p-5">
              <dt className="text-lg font-bold">{f.q}</dt>
              <dd className="mt-1.5 text-base text-muted-foreground">{f.a}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="mx-auto max-w-4xl px-4 pt-16">
        <div className="kin-card bg-primary-soft p-8 text-center">
          <h2 className="text-2xl sm:text-3xl">Your next family trip starts with one destination</h2>
          <p className="mt-3 text-base text-muted-foreground">
            Add where you&apos;re going and the dates. CommonRoute takes it from there.
          </p>
          <Link
            to="/"
            className="mt-6 inline-flex min-h-13 items-center gap-2 rounded-2xl bg-primary px-7 text-base font-bold text-primary-foreground shadow-lg"
          >
            Start planning — it&apos;s free <ArrowRight className="size-5" aria-hidden />
          </Link>
        </div>
      </section>

      <footer className="mx-auto mt-14 max-w-4xl px-4 text-center">
        <img src={logo.url} alt="CommonRoute — Plan together. Find your common route." className="mx-auto h-auto w-full max-w-[360px]" />
        <p className="mt-3 text-sm font-semibold text-muted-foreground">
          Plan together. Find your common route.
        </p>
      </footer>
    </main>
  );
}
