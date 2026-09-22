import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Check, CloudOff, Download, Info, Trash2, X } from "lucide-react";
import { AppShell } from "@/components/kintrip/AppShell";
import { Button, Card, Chip } from "@/components/kintrip/ui";
import { useKintrip } from "@/lib/kintrip/store";
import {
  buildPack,
  defaultDates,
  loadPack,
  packSizeKb,
  removePack,
  savePack,
  type ManifestItem,
  type OfflinePack,
} from "@/lib/kintrip/offline";

export const Route = createFileRoute("/offline")({
  head: () => ({
    meta: [
      { title: "Save days to this phone — CommonRoute" },
      {
        name: "description",
        content:
          "Keep the next couple of days, your address and contact cards on this device, so they open with no connection.",
      },
      { property: "og:title", content: "Save days to this phone — CommonRoute" },
      {
        property: "og:description",
        content: "Save the plan to this device and see exactly what was kept and what was not.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: OfflineScreen,
});

function ManifestRow({ item }: { item: ManifestItem }) {
  const icon =
    item.state === "saved" ? (
      <Check className="size-4 text-secondary" aria-hidden />
    ) : item.state === "missing" ? (
      <X className="size-4 text-coral" aria-hidden />
    ) : (
      <Info className="size-4 text-muted-foreground" aria-hidden />
    );
  const label =
    item.state === "saved"
      ? "On this device"
      : item.state === "missing"
        ? "Nothing to save yet"
        : "Not kept here";
  return (
    <li className="flex items-start gap-3 border-t border-border py-3 first:border-0">
      <span className="mt-0.5">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">{item.label}</span>
        <span className="block text-sm text-muted-foreground">
          {label}
          {item.detail ? ` · ${item.detail}` : ""}
        </span>
      </span>
    </li>
  );
}

function OfflineScreen() {
  const state = useKintrip();
  const days = state.itinerary?.days ?? [];
  const [dates, setDates] = useState<string[]>([]);
  const [pack, setPack] = useState<OfflinePack | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setPack(loadPack());
    setDates(defaultDates(state));
    // Only on first render: the person's own choice must not be overwritten.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleDate = (date: string) =>
    setDates((prev) => (prev.includes(date) ? prev.filter((d) => d !== date) : [...prev, date]));

  const save = () => {
    setError(null);
    setMessage(null);
    if (dates.length === 0) {
      setError("Choose at least one day to save.");
      return;
    }
    const result = savePack(buildPack(state, [...dates].sort()));
    if (!result.ok || !result.pack) {
      setPack(loadPack());
      setError(result.error ?? "Nothing could be saved on this device.");
      return;
    }
    setPack(result.pack);
    setMessage("Saved and checked. These days now open with no connection.");
  };

  const clear = () => {
    removePack();
    setPack(null);
    setMessage("The saved days were removed from this device.");
  };

  return (
    <AppShell title="Save days to this phone" subtitle="For when there is no signal">
      <Card className="space-y-2">
        <p className="inline-flex items-center gap-2 text-sm font-bold">
          <CloudOff className="size-4 text-secondary" aria-hidden /> What this does
        </p>
        <p className="text-sm text-muted-foreground">
          The days you choose are kept on this device only. Nothing is sent anywhere, and nobody is
          told what you saved. Map directions still need a connection — save the area in your maps
          app too.
        </p>
      </Card>

      {days.length === 0 ? (
        <Card>
          <p className="text-sm">
            There is nothing to save yet. Once the plan is shared with the group, come back here.
          </p>
        </Card>
      ) : (
        <Card className="space-y-3">
          <h2 className="text-lg">Which days</h2>
          <div className="flex flex-wrap gap-2">
            {days.map((d) => (
              <Button
                key={d.date}
                type="button"
                variant={dates.includes(d.date) ? "secondary" : "outline"}
                className="min-h-11 px-3 text-sm"
                aria-pressed={dates.includes(d.date)}
                onClick={() => toggleDate(d.date)}
              >
                Day {d.day} · {d.date}
              </Button>
            ))}
          </div>
          <Button type="button" onClick={save}>
            <Download className="size-4" aria-hidden /> Save these days to this phone
          </Button>
          {error ? <p className="text-sm font-semibold text-coral">{error}</p> : null}
          {message ? <p className="text-sm font-semibold text-secondary">{message}</p> : null}
        </Card>
      )}

      {pack ? (
        <Card className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg">What is on this device</h2>
            <Chip tone="secondary">
              Plan version {pack.planVersion} · {packSizeKb(pack)} KB
            </Chip>
          </div>
          <p className="text-sm text-muted-foreground">
            Saved {new Date(pack.savedAt).toLocaleString("en-GB")} · {pack.dates.join(", ")}
          </p>
          <ul>
            {pack.manifest.map((item) => (
              <ManifestRow key={item.id} item={item} />
            ))}
          </ul>
          {pack.planVersion !== (state.itinerary?.version ?? 0) ? (
            <p className="rounded-xl bg-sunny-soft p-3 text-sm font-semibold">
              The plan has changed since you saved. Save again to keep up to date.
            </p>
          ) : null}
          <Button type="button" variant="outline" onClick={clear}>
            <Trash2 className="size-4" aria-hidden /> Remove the saved trip from this device
          </Button>
        </Card>
      ) : null}
    </AppShell>
  );
}
