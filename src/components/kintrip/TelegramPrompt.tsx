import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Send, X } from "lucide-react";
import { Card } from "@/components/kintrip/ui";
import { useAccount } from "@/lib/kintrip/auth";
import { useTripList } from "@/lib/kintrip/store";
import { getTelegramStatus } from "@/lib/kintrip/telegram.functions";

const DISMISS_KEY = "commonroute.telegramPromptDismissed";

/**
 * Gentle, dismissible prompt suggesting optional Telegram notifications.
 * Shown once to signed-in people who have a real trip and haven't connected.
 */
export function TelegramPrompt() {
  const { session } = useAccount();
  const trips = useTripList();
  const fetchStatus = useServerFn(getTelegramStatus);
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!session || trips.filter((t) => !t.isDemo).length === 0) return;
    try {
      if (window.localStorage.getItem(DISMISS_KEY)) return;
    } catch {
      return;
    }
    fetchStatus()
      .then((s) => setShow(s.configured && s.status === "disconnected"))
      .catch(() => undefined);
  }, [session, trips, fetchStatus]);

  if (!show) return null;

  return (
    <Card className="flex items-start justify-between gap-3 border-primary/40 bg-primary-soft">
      <div className="space-y-1">
        <p className="flex items-center gap-2 text-sm font-bold text-foreground">
          <Send className="size-4" aria-hidden /> Get trip updates on Telegram
        </p>
        <p className="text-sm text-muted-foreground">
          Optional: the CommonRoute bot can deliver trip updates and reminders. Voting and planning
          always stay here.{" "}
          <Link to="/account" className="font-semibold text-primary underline">
            Connect in your account
          </Link>
        </p>
      </div>
      <button
        type="button"
        aria-label="Dismiss"
        className="rounded-lg p-2 text-muted-foreground hover:bg-background"
        onClick={() => {
          try {
            window.localStorage.setItem(DISMISS_KEY, "1");
          } catch {
            /* ignore */
          }
          setShow(false);
        }}
      >
        <X className="size-4" aria-hidden />
      </button>
    </Card>
  );
}
