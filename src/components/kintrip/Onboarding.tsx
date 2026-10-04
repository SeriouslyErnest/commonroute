import { Link, useRouterState } from "@tanstack/react-router";
import { Lightbulb, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/kintrip/ui";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

// Device-only onboarding state. Nothing here is synced or sent anywhere.
const TOUR_KEY = "commonroute.onboarding.tour.v1";
const TIPS_KEY = "commonroute.onboarding.tips.v1";
const RESET_EVENT = "commonroute:onboarding-reset";

type TipState = { off?: boolean; seen: string[] };

function readTips(): TipState {
  try {
    const raw = window.localStorage.getItem(TIPS_KEY);
    return raw ? (JSON.parse(raw) as TipState) : { seen: [] };
  } catch {
    return { seen: [] };
  }
}
function writeTips(s: TipState) {
  try {
    window.localStorage.setItem(TIPS_KEY, JSON.stringify(s));
  } catch {
    /* storage unavailable — tips simply reappear */
  }
}

export function resetOnboarding() {
  try {
    window.localStorage.removeItem(TOUR_KEY);
    window.localStorage.removeItem(TIPS_KEY);
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event(RESET_EVENT));
}

const TOUR = [
  {
    title: "Welcome to CommonRoute",
    body: "CommonRoute helps a whole group — grandparents to kids — agree on one trip that works for everyone. Here is the journey in four steps.",
  },
  {
    title: "1. Start or join a trip",
    body: "Organisers create a trip and share its invite link. People who open the link sign in by email and ask to join; the organiser approves them before they see anything.",
  },
  {
    title: "2. Share needs and vote",
    body: "Everyone answers five short questions about pace, walking and rest, then rates places: Must go, Would like, Don't mind or Skip. You only ever vote as yourself.",
  },
  {
    title: "3. Review and plan",
    body: "Organisers review the group's choices. CommonRoute builds one realistic day-by-day plan, putting walking limits, rests and opening hours ahead of popularity.",
  },
  {
    title: "4. Travel and re-plan",
    body: "On the day, Today shows what's next. Save days to this phone for no-signal moments, and use Re-plan when rain or tiredness changes things. More tools holds rooms, bookings and extras.",
  },
];

const TIPS: Record<string, { title: string; body: string }> = {
  "/": {
    title: "Your trip home",
    body: "This page shows where your group is in planning and the next step to take. Tap the trip name at the top to switch trips; the bell shows group updates.",
  },
  "/trips": {
    title: "My trips",
    body: "Every trip you plan or join lives here. Organisers can delete a trip for everyone; others can tap Leave to remove it just for themselves.",
  },
  "/invite": {
    title: "Inviting people",
    body: "Share the link or code. Newcomers sign in and ask to join — approve or decline them below. Changing the code stops new requests but keeps approved people.",
  },
  "/preferences": {
    title: "Your needs",
    body: "Five quick questions about pace, walking and rest. Answers shape the plan for everyone, and you can change them anytime.",
  },
  "/discover": {
    title: "Finding and rating places",
    body: "Search for places, then rate each one. Must go means you'd be sad to miss it; Skip means you'd rather not. Add your own suggestions from here too.",
  },
  "/ideas": {
    title: "Quick ideas",
    body: "Jot down ideas before you know exactly where they are. Give an idea a location in Discover so the group can rate it.",
  },
  "/consensus": {
    title: "Group choices",
    body: "See what the group loves, what splits opinion and what needs care. Organisers approve, decline or keep places as backups before planning.",
  },
  "/itinerary": {
    title: "The plan",
    body: "One recommended plan, with a plain reason for each stop. Organisers can move, lock, split or replace anything, then publish it for the group.",
  },
  "/today": {
    title: "Today",
    body: "What's happening now and next, with directions. If the day changes, tap Re-plan and say what happened.",
  },
  "/replan": {
    title: "Re-planning the day",
    body: "Tell CommonRoute what changed — rain, tiredness, running late — and it rebuilds the rest of the day, keeping what still works.",
  },
  "/family": {
    title: "Your group",
    body: "Everyone travelling, with their needs and roles. You act only as yourself, or as someone you're explicitly helping.",
  },
  "/offline": {
    title: "No-signal mode",
    body: "Save days to this phone so stops, times and addresses stay readable without internet. Maps directions and documents need a connection.",
  },
  "/account": {
    title: "Your account",
    body: "Your email, language and optional Telegram notifications. CommonRoute never asks for a password.",
  },
};

/** One dismissible tip per screen, shown the first time a person visits it. */
export function GuideCard() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const tip = TIPS[pathname];
  const [state, setState] = useState<TipState | null>(null);

  useEffect(() => {
    setState(readTips());
    const onReset = () => setState(readTips());
    window.addEventListener(RESET_EVENT, onReset);
    return () => window.removeEventListener(RESET_EVENT, onReset);
  }, []);

  if (!tip || !state || state.off || state.seen.includes(pathname)) return null;

  const dismiss = (allOff = false) => {
    const next = allOff ? { ...state, off: true } : { ...state, seen: [...state.seen, pathname] };
    writeTips(next);
    setState(next);
  };

  return (
    <aside
      aria-label="Tip"
      className="flex gap-3 rounded-2xl border border-primary/30 bg-primary/5 p-4"
    >
      <Lightbulb className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="font-bold">{tip.title}</p>
        <p className="mt-1 text-sm text-muted-foreground">{tip.body}</p>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm font-bold">
          <button type="button" className="min-h-11 text-primary underline" onClick={() => dismiss()}>
            Got it
          </button>
          <button
            type="button"
            className="min-h-11 text-muted-foreground underline"
            onClick={() => dismiss(true)}
          >
            Hide all tips
          </button>
        </div>
      </div>
      <button
        type="button"
        aria-label="Close tip"
        onClick={() => dismiss()}
        className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl text-muted-foreground"
      >
        <X className="size-4" aria-hidden />
      </button>
    </aside>
  );
}

/** First-visit walkthrough, shown once per device. */
export function WelcomeTour() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    const check = () => {
      try {
        if (!window.localStorage.getItem(TOUR_KEY)) {
          setStep(0);
          setOpen(true);
        }
      } catch {
        /* ignore */
      }
    };
    check();
    window.addEventListener(RESET_EVENT, check);
    return () => window.removeEventListener(RESET_EVENT, check);
  }, []);

  const close = () => {
    try {
      window.localStorage.setItem(TOUR_KEY, "done");
    } catch {
      /* ignore */
    }
    setOpen(false);
  };

  const s = TOUR[step];
  const last = step === TOUR.length - 1;

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : close())}>
      <DialogContent className="max-w-md rounded-3xl">
        <DialogTitle className="text-xl">{s.title}</DialogTitle>
        <DialogDescription className="text-base text-foreground">{s.body}</DialogDescription>
        <div className="flex justify-center gap-1.5" aria-hidden>
          {TOUR.map((_, i) => (
            <span
              key={i}
              className={`h-2 rounded-full ${i === step ? "w-6 bg-primary" : "w-2 bg-border"}`}
            />
          ))}
        </div>
        <p className="text-center text-xs text-muted-foreground">
          {`Step ${step + 1} of ${TOUR.length}`}
        </p>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <button type="button" className="min-h-11 text-sm font-bold text-muted-foreground underline" onClick={close}>
            Skip tour
          </button>
          <div className="flex gap-2">
            {step > 0 ? (
              <Button variant="outline" onClick={() => setStep(step - 1)}>
                Back
              </Button>
            ) : null}
            {last ? (
              <Button onClick={close}>Start exploring</Button>
            ) : (
              <Button onClick={() => setStep(step + 1)}>Next</Button>
            )}
          </div>
        </div>
        {last ? (
          <p className="text-center text-sm">
            <Link to="/guide" className="font-bold text-primary underline" onClick={close}>
              Read the full user guide
            </Link>
          </p>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
