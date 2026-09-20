import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { Bell, History } from "lucide-react";
import { AppShell } from "@/components/kintrip/AppShell";
import { Card, Chip } from "@/components/kintrip/ui";
import { markNotificationsRead } from "@/lib/kintrip/actions";
import { visibleNotifications } from "@/lib/kintrip/governance";
import { useKintrip } from "@/lib/kintrip/store";

export const Route = createFileRoute("/updates")({
  head: () => ({
    meta: [
      { title: "Group updates — CommonRoute" },
      {
        name: "description",
        content: "Every decision, approval and change in your trip, in one place.",
      },
      { property: "og:title", content: "Group updates — CommonRoute" },
      {
        property: "og:description",
        content: "See what changed in the plan, who decided it and why.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: UpdatesScreen,
});

function UpdatesScreen() {
  const state = useKintrip();
  const items = visibleNotifications(state);

  useEffect(() => {
    const timer = setTimeout(() => markNotificationsRead(), 1200);
    return () => clearTimeout(timer);
  }, []);

  return (
    <AppShell title="What's changed" subtitle="Decisions and updates for your group">
      <Card className="space-y-3">
        <h2 className="flex items-center gap-2 text-lg">
          <Bell className="size-5 text-primary" aria-hidden /> Updates
        </h2>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing new yet. Updates appear here as decisions are made.</p>
        ) : (
          <ul className="space-y-2">
            {items.map((n) => (
              <li key={n.id} className="rounded-xl bg-muted px-3 py-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold">{n.text}</span>
                  {!n.read ? <Chip tone="lime">New</Chip> : null}
                </div>
                <p className="text-xs text-muted-foreground">{new Date(n.at).toLocaleString("en-GB")}</p>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="space-y-3">
        <h2 className="flex items-center gap-2 text-lg">
          <History className="size-5 text-secondary" aria-hidden /> Decision history
        </h2>
        {state.audit.length === 0 ? (
          <p className="text-sm text-muted-foreground">No decisions recorded yet.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {state.audit.slice(0, 40).map((e) => (
              <li key={e.id} className="border-b border-border pb-2 last:border-0">
                <span className="font-semibold">{e.action}</span> — {e.detail}
                <span className="block text-xs text-muted-foreground">
                  {e.actorName} · {new Date(e.at).toLocaleString("en-GB")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </AppShell>
  );
}
