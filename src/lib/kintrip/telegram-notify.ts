import { notifyTripTelegram, type TripNotifyKind } from "./telegram.functions";
import { activeSyncInfo } from "./store";

/**
 * Fire-and-forget Telegram trip notification. Called after the underlying
 * action has already succeeded; delivery failure never affects the app.
 * The demo trip and unsynced trips are never notified.
 */
export function notifyTrip(kind: TripNotifyKind, eventId: string): void {
  const info = activeSyncInfo();
  if (!info) return;
  void notifyTripTelegram({
    data: { tripId: info.tripId, shareCode: info.shareCode, kind, eventId },
  }).catch(() => undefined);
}
