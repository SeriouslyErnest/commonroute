import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Copy, Mail, MessageCircle, RefreshCw, Trash2 } from "lucide-react";
import { AppShell } from "@/components/kintrip/AppShell";
import { Button, Card, Chip, LinkButton } from "@/components/kintrip/ui";
import { formatDate } from "@/lib/kintrip/engine";
import { deleteTripForEveryone, rotateInviteCode, useKintrip, useTripSetupStatus } from "@/lib/kintrip/store";
import { isOrganiser } from "@/lib/kintrip/governance";

export const Route = createFileRoute("/invite")({
  head: () => ({
    meta: [
      { title: "Invite your group — CommonRoute" },
      {
        name: "description",
        content: "Share one link and get everyone's preferences without chasing messages.",
      },
      { property: "og:title", content: "Invite your group — CommonRoute" },
      {
        property: "og:description",
        content: "Share one link and get everyone's preferences without chasing messages.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: InvitePage,
});

function InvitePage() {
  const state = useKintrip();
  const [copied, setCopied] = useState(false);
  // Resolved after mount so the server and first client render always match.
  const [link, setLink] = useState("/join");
  const shareCode = state.trip.shareCode;
  useEffect(() => {
    setLink(`${window.location.origin}/join${shareCode ? `?code=${shareCode}` : ""}`);
  }, [shareCode]);
  const message = `Join our trip on CommonRoute — ${state.trip.title}: ${link}`;


  return (
    <AppShell
      title="Travel is better together"
      subtitle={`${state.trip.title} · ${state.trip.destination} · ${formatDate(state.trip.startDate)} – ${formatDate(state.trip.endDate)}`}
      back={{ to: "/", label: "Back to trip" }}
    >
      <Card className="space-y-3">
        <p className="rounded-xl bg-muted px-4 py-3 text-sm break-all">{link}</p>
        <div className="flex flex-wrap gap-2">
          <a
            className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-collaboration px-5 font-semibold text-collaboration-foreground"
            href={`https://wa.me/?text=${encodeURIComponent(message)}`}
            target="_blank"
            rel="noreferrer"
          >
            <MessageCircle className="size-5" aria-hidden /> Share via WhatsApp
          </a>
          <Button
            variant="outline"
            onClick={() => {
              void navigator.clipboard?.writeText(link);
              setCopied(true);
            }}
          >
            <Copy className="size-5" aria-hidden /> {copied ? "Copied" : "Copy link"}
          </Button>
          <a
            className="inline-flex min-h-12 items-center gap-2 rounded-full border border-border bg-card px-5 font-semibold"
            href={`mailto:?subject=${encodeURIComponent(state.trip.title)}&body=${encodeURIComponent(message)}`}
          >
            <Mail className="size-5" aria-hidden /> Email invite
          </a>
        </div>
      </Card>

      <Card>
        <h2 className="text-lg">Who's on board</h2>
        <ul className="mt-3 space-y-2">
          {state.travellers.map((t) => (
            <li key={t.id} className="flex items-center justify-between gap-2 border-b border-border pb-2 last:border-0">
              <span>
                <span className="block font-semibold">{t.name}</span>
                <span className="block text-sm text-muted-foreground">{t.relationship}</span>
              </span>
              <Chip tone={t.prefStatus === "complete" ? "lime" : t.joined ? "sunny" : "neutral"}>
                {t.prefStatus === "complete"
                  ? "Preferences complete"
                  : t.joined
                    ? "Preferences not started"
                    : "Invited"}
              </Chip>
            </li>
          ))}
        </ul>
      </Card>

      <OrganiserControls />

      <div className="flex justify-center pb-4">
        <LinkButton to="/preferences">Share my preferences</LinkButton>
      </div>
    </AppShell>
  );
}

function OrganiserControls() {
  const state = useKintrip();
  const navigate = useNavigate();
  const { demoActive } = useTripSetupStatus();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  if (demoActive || !state.trip.shareCode || !isOrganiser(state)) return null;

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setNote("");
    try {
      await fn();
    } catch (err) {
      setNote(err instanceof Error && /sign/i.test(err.message) ? "Please sign in to do this." : "That didn't work — check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="space-y-3">
      <h2 className="text-lg">Organiser controls</h2>
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">
          Change the invite code if the link has spread further than intended. The old link stops working straight away, for everyone who used it — send the new link to the people who should stay.
        </p>
        <Button
          variant="outline"
          disabled={busy}
          onClick={() => {
            if (!window.confirm("Change the invite code? The old link stops working for everyone, including people already in the trip.")) return;
            void run(async () => {
              await rotateInviteCode();
              setNote("New invite code ready — share the new link above.");
            });
          }}
        >
          <RefreshCw className="size-5" aria-hidden /> Change invite code
        </Button>
      </div>
      <div className="space-y-2 border-t border-border pt-3">
        <p className="text-sm text-muted-foreground">
          Deleting the trip removes the shared plan for everyone. This can't be undone.
        </p>
        <Button
          variant="outline"
          disabled={busy}
          onClick={() => {
            if (!window.confirm(`Delete “${state.trip.title}” for everyone? The shared plan is erased and can't be recovered.`)) return;
            void run(async () => {
              await deleteTripForEveryone();
              void navigate({ to: "/trips" });
            });
          }}
        >
          <Trash2 className="size-5" aria-hidden /> Delete trip for everyone
        </Button>
      </div>
      {note ? <p role="status" className="text-sm font-semibold">{note}</p> : null}
    </Card>
  );
}
