import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Copy, Mail, MessageCircle } from "lucide-react";
import { AppShell } from "@/components/kintrip/AppShell";
import { Button, Card, Chip, LinkButton } from "@/components/kintrip/ui";
import { formatDate } from "@/lib/kintrip/engine";
import { useKintrip } from "@/lib/kintrip/store";

export const Route = createFileRoute("/invite")({
  head: () => ({
    meta: [
      { title: "Invite your family — Kintrip" },
      {
        name: "description",
        content: "Share one link and get everyone's preferences without chasing messages.",
      },
      { property: "og:title", content: "Invite your family — Kintrip" },
      {
        property: "og:description",
        content: "Share one link and get everyone's preferences without chasing messages.",
      },
    ],
  }),
  component: InvitePage,
});

function InvitePage() {
  const state = useKintrip();
  const [copied, setCopied] = useState(false);
  // Resolved after mount so the server and first client render always match.
  const [link, setLink] = useState("https://kintrip.app/join");
  const shareCode = state.trip.shareCode;
  useEffect(() => {
    setLink(`${window.location.origin}/join${shareCode ? `?code=${shareCode}` : ""}`);
  }, [shareCode]);
  const message = `Join our family trip on Kintrip — ${state.trip.title}: ${link}`;


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
            className="inline-flex min-h-12 items-center gap-2 rounded-full bg-primary px-5 font-semibold text-primary-foreground"
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

      <div className="flex justify-center pb-4">
        <LinkButton to="/preferences">Share my preferences</LinkButton>
      </div>
    </AppShell>
  );
}
