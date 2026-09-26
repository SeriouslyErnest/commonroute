import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Send, Unlink } from "lucide-react";
import { Button, Card } from "@/components/kintrip/ui";
import {
  disconnectTelegram,
  getTelegramStatus,
  sendTelegramTest,
  startTelegramLink,
  updateTelegramPrefs,
  type TelegramStatus,
} from "@/lib/kintrip/telegram.functions";
import type { TelegramPrefs } from "@/lib/kintrip/telegram.server";

const PREF_LABELS: { key: keyof TelegramPrefs; label: string }[] = [
  { key: "vote_reminders", label: "Voting and decision reminders" },
  { key: "itinerary_changes", label: "Itinerary changes" },
  { key: "organiser_updates", label: "Organiser updates" },
  { key: "travel_day", label: "Travel-day reminders (optional)" },
];

/**
 * Account → Telegram notifications. Optional by design: CommonRoute works
 * fully without Telegram, and voting/editing always stays in the app.
 */
export function TelegramSettings() {
  const fetchStatus = useServerFn(getTelegramStatus);
  const [status, setStatus] = useState<TelegramStatus | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  function refresh() {
    fetchStatus()
      .then(setStatus)
      .catch(() => setStatus(null));
  }

  useEffect(refresh, [fetchStatus]);

  if (!status) return null;
  if (!status.configured) return null;

  async function connect() {
    setMessage(null);
    try {
      const { url } = await startTelegramLink();
      setConnecting(true);
      window.open(url, "_blank", "noopener");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Couldn't start the connection");
    }
  }

  async function toggle(key: keyof TelegramPrefs) {
    if (!status) return;
    const prefs = { ...status.prefs, [key]: !status.prefs[key] };
    setStatus({ ...status, prefs });
    try {
      await updateTelegramPrefs({ data: { prefs } });
    } catch {
      refresh();
    }
  }

  return (
    <Card className="space-y-3">
      <h2 className="text-lg font-bold text-foreground">Telegram notifications</h2>

      {status.status === "disconnected" && !connecting && (
        <>
          <p className="text-sm text-muted-foreground">
            Connect the CommonRoute Telegram bot to receive trip updates, decision reminders and
            optional travel-day prompts.
          </p>
          <Button type="button" variant="outline" onClick={() => void connect()}>
            <Send className="size-4" aria-hidden /> Connect Telegram
          </Button>
          <p className="text-xs text-muted-foreground">
            Optional. CommonRoute works normally without Telegram.
          </p>
        </>
      )}

      {status.status === "disconnected" && connecting && (
        <>
          <p className="text-sm text-muted-foreground">
            Finish connecting in Telegram: tap <b>START</b> in the CommonRoute bot, then come back
            here.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={() => void connect()}>
              Open Telegram again
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setConnecting(false);
                refresh();
              }}
            >
              I've finished
            </Button>
          </div>
        </>
      )}

      {status.status !== "disconnected" && (
        <>
          {status.status === "needs_attention" ? (
            <p className="text-sm font-semibold text-foreground">
              Telegram notifications are paused. Delivery needs attention — your trips and
              itineraries are unaffected.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Telegram connected. Selected trip updates can now be delivered through Telegram.
            </p>
          )}

          <fieldset className="space-y-2">
            <legend className="text-sm font-semibold text-foreground">
              Notification preferences
            </legend>
            {PREF_LABELS.map(({ key, label }) => (
              <label key={key} className="flex min-h-11 items-center gap-3 text-sm text-foreground">
                <input
                  type="checkbox"
                  className="size-5"
                  checked={status.prefs[key]}
                  onChange={() => void toggle(key)}
                />
                {label}
              </label>
            ))}
          </fieldset>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={async () => {
                setMessage(null);
                try {
                  await sendTelegramTest();
                  setMessage("Test message sent — check Telegram.");
                } catch (err) {
                  setMessage(err instanceof Error ? err.message : "Couldn't send the test");
                  refresh();
                }
              }}
            >
              <Send className="size-4" aria-hidden /> Send test notification
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={async () => {
                setMessage(null);
                try {
                  if (status.status === "needs_attention") {
                    await connect();
                    return;
                  }
                  await disconnectTelegram();
                  setConnecting(false);
                  refresh();
                } catch (err) {
                  setMessage(err instanceof Error ? err.message : "Couldn't disconnect");
                }
              }}
            >
              <Unlink className="size-4" aria-hidden />
              {status.status === "needs_attention" ? "Reconnect Telegram" : "Disconnect Telegram"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Voting and planning always stay inside CommonRoute. Trip details are only sent while
            you're a member of the trip.
          </p>
        </>
      )}

      {message ? <p className="text-sm font-semibold text-muted-foreground">{message}</p> : null}
    </Card>
  );
}
