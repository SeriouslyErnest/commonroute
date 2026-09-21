import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState, useCallback } from "react";
import {
  CalendarDays,
  ChevronDown,
  Download,
  FileSpreadsheet,
  FileText,
  Globe,
  MapPin,
  Navigation,
  Users,
} from "lucide-react";
import { AppShell } from "@/components/kintrip/AppShell";
import { Button, Card, Chip, Field } from "@/components/kintrip/ui";
import { useKintrip } from "@/lib/kintrip/store";
import { exportTrip } from "@/lib/kintrip/export.functions";
import { useLocale } from "@/lib/i18n";
import type { ExportOptions, ExportResult } from "@/lib/kintrip/export";

export const Route = createFileRoute("/export")({
  head: () => ({
    meta: [
      { title: "Export plan — CommonRoute" },
      {
        name: "description",
        content: "Export your group's plan as a spreadsheet or calendar file.",
      },
      { property: "og:title", content: "Export plan — CommonRoute" },
      {
        property: "og:description",
        content: "Export your group's plan as a spreadsheet or calendar file.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ExportScreen,
});

const presets = [
  { value: "readable" as const, label: "Readable itinerary", icon: FileText },
  { value: "mymaps" as const, label: "Google My Maps import", icon: MapPin },
];

const formats = [
  { value: "csv" as const, label: "Spreadsheet (CSV)", icon: FileSpreadsheet },
  { value: "ics" as const, label: "Calendar (ICS)", icon: CalendarDays },
];

const scopes = [
  { value: "all" as const, label: "Full trip" },
  { value: "me" as const, label: "My activities only" },
  { value: "managed" as const, label: "A managed traveller" },
  { value: "bookings" as const, label: "Bookings and transport" },
];

const navOptions = [
  { value: "both" as const, label: "Coordinates and links" },
  { value: "coordinates" as const, label: "Coordinates only" },
  { value: "links" as const, label: "Map links only" },
];

const mapProviders = [
  { value: "both" as const, label: "Google and Apple" },
  { value: "google" as const, label: "Google Maps" },
  { value: "apple" as const, label: "Apple Maps" },
];

const alarms = [
  { value: null as null, label: "None" },
  { value: 15, label: "15 minutes before" },
  { value: 30, label: "30 minutes before" },
  { value: 60, label: "1 hour before" },
];

function ExportScreen() {
  const state = useKintrip();
  const navigate = useNavigate();
  const { t } = useLocale();

  const [format, setFormat] = useState<ExportOptions["format"]>("csv");
  const [csvPreset, setCsvPreset] = useState<ExportOptions["csvPreset"]>("readable");
  const [scope, setScope] = useState<ExportOptions["audienceScope"]>("all");
  const [managedId, setManagedId] = useState<string>("");
  const [categories, setCategories] = useState<Set<string>>(new Set(["activity", "meal", "rest", "travel"]));
  const [dateStart, setDateStart] = useState<string>(state.trip.startDate);
  const [dateEnd, setDateEnd] = useState<string>(state.trip.endDate);
  const [nav, setNav] = useState<ExportOptions["navigationOutput"]>("both");
  const [mapProvider, setMapProvider] = useState<ExportOptions["mapProvider"]>("both");
  const [alarm, setAlarm] = useState<number | null>(null);
  const [includeRestTransfer, setIncludeRestTransfer] = useState(true);
  const [includeAccessPoints, setIncludeAccessPoints] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<ExportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const managedTravellers = useMemo(() => {
    const active = state.travellers.find((t) => t.id === state.activeTravellerId);
    const canManage =
      active && (active.roles.includes("owner") || active.roles.includes("organiser"));
    return state.travellers.filter(
      (t) =>
        t.id !== state.activeTravellerId &&
        canManage &&
        (t.managed || t.managementMode === "assisted"),
    );
  }, [state.travellers, state.activeTravellerId]);

  const options: ExportOptions = useMemo(
    () => ({
      revision: state.itinerary?.published ? state.itinerary.version : state.itinerary?.version || 1,
      format,
      csvPreset: format === "csv" ? csvPreset : undefined,
      dateRange: { start: dateStart, end: dateEnd },
      categories: Array.from(categories) as ExportOptions["categories"],
      audienceScope: scope,
      managedTravellerId: scope === "managed" ? managedId : undefined,
      includeAccessPoints,
      navigationOutput: nav,
      mapProvider,
      alarmMinutes: format === "ics" ? alarm : undefined,
      includeRestTransfer: format === "ics" ? includeRestTransfer : undefined,
    }),
    [
      state.itinerary,
      format,
      csvPreset,
      dateStart,
      dateEnd,
      categories,
      scope,
      managedId,
      includeAccessPoints,
      nav,
      mapProvider,
      alarm,
      includeRestTransfer,
    ],
  );

  const toggleCategory = useCallback((cat: string) => {
    setCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  }, []);

  const generate = useCallback(async () => {
    setGenerating(true);
    setError(null);
    setResult(null);
    try {
      const payload: { shareCode?: string; state?: typeof state; options: ExportOptions } = {
        options,
      };
      if (state.trip.shareCode) {
        payload.shareCode = state.trip.shareCode;
      } else {
        payload.state = state;
      }
      const generated = await exportTrip({ data: payload });
      setResult(generated);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed");
    } finally {
      setGenerating(false);
    }
  }, [options, state]);

  const download = useCallback(() => {
    if (!result) return;
    const blob = new Blob([result.content], { type: result.mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = result.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [result]);

  return (
    <AppShell title="Export plan" subtitle="Take your plan into a spreadsheet or calendar" back={{ to: "/itinerary", label: "Back to plan" }}>
      <div className="grid gap-4">
        <Card>
          <h2 className="mb-3 flex items-center gap-2 text-lg font-bold">
            <Globe className="size-5 text-secondary" aria-hidden />
            {t("Format")}
          </h2>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {formats.map((f) => (
              <label
                key={f.value}
                className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition-colors ${format === f.value ? "border-primary bg-primary-soft" : "border-border bg-card"}`}
              >
                <input
                  type="radio"
                  name="format"
                  value={f.value}
                  checked={format === f.value}
                  onChange={() => setFormat(f.value)}
                  className="sr-only"
                />
                <f.icon className="size-5 text-secondary" aria-hidden />
                <span className="font-semibold">{t(f.label)}</span>
              </label>
            ))}
          </div>
        </Card>

        {format === "csv" && (
          <Card>
            <h2 className="mb-3 flex items-center gap-2 text-lg font-bold">
              <FileText className="size-5 text-secondary" aria-hidden />
              {t("CSV purpose")}
            </h2>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {presets.map((p) => (
                <label
                  key={p.value}
                  className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition-colors ${csvPreset === p.value ? "border-primary bg-primary-soft" : "border-border bg-card"}`}
                >
                  <input
                    type="radio"
                    name="csvPreset"
                    value={p.value}
                    checked={csvPreset === p.value}
                    onChange={() => setCsvPreset(p.value)}
                    className="sr-only"
                  />
                  <p.icon className="size-5 text-secondary" aria-hidden />
                  <span className="font-semibold">{t(p.label)}</span>
                </label>
              ))}
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              {csvPreset === "mymaps"
                ? t("One row per stop with separate latitude and longitude columns for Google My Maps.")
                : t("One row per item, sorted by day and time, with map links and notes.")}
            </p>
          </Card>
        )}

        <Card>
          <h2 className="mb-3 flex items-center gap-2 text-lg font-bold">
            <Users className="size-5 text-secondary" aria-hidden />
            {t("What to include")}
          </h2>
          <label className="block text-sm font-semibold">{t("Scope")}</label>
          <select
            className="w-full min-h-12 rounded-xl border border-input bg-card px-4 text-base text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-ring/40"
            value={scope}
            onChange={(e) => setScope(e.target.value as ExportOptions["audienceScope"])}
          >
            {scopes.map((s) => (
              <option key={s.value} value={s.value}>
                {t(s.label)}
              </option>
            ))}
          </select>
          {scope === "managed" && (
            <div className="mt-3">
              <label className="block text-sm font-semibold">{t("Traveller")}</label>
              <select
                className="w-full min-h-12 rounded-xl border border-input bg-card px-4 text-base text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-ring/40"
                value={managedId}
                onChange={(e) => setManagedId(e.target.value)}
              >
                <option value="">{t("Choose a traveller")}</option>
                {managedTravellers.map((t_) => (
                  <option key={t_.id} value={t_.id}>
                    {t_.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              { id: "activity", label: "Activities" },
              { id: "meal", label: "Meals" },
              { id: "rest", label: "Rests" },
              { id: "travel", label: "Travel" },
            ].map((cat) => (
              <label
                key={cat.id}
                className={`flex cursor-pointer items-center gap-2 rounded-xl border p-3 text-sm font-semibold transition-colors ${categories.has(cat.id) ? "border-primary bg-primary-soft" : "border-border bg-card"}`}
              >
                <input
                  type="checkbox"
                  checked={categories.has(cat.id)}
                  onChange={() => toggleCategory(cat.id)}
                  className="size-4 accent-secondary"
                />
                {t(cat.label)}
              </label>
            ))}
          </div>
        </Card>

        <Card>
          <h2 className="mb-3 flex items-center gap-2 text-lg font-bold">
            <CalendarDays className="size-5 text-secondary" aria-hidden />
            {t("Date range")}
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label={t("From")}>
              <input
                type="date"
                value={dateStart}
                min={state.trip.startDate}
                max={state.trip.endDate}
                onChange={(e) => setDateStart(e.target.value)}
                className="w-full min-h-12 rounded-xl border border-input bg-card px-4 text-base text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-ring/40"
              />
            </Field>
            <Field label={t("To")}>
              <input
                type="date"
                value={dateEnd}
                min={state.trip.startDate}
                max={state.trip.endDate}
                onChange={(e) => setDateEnd(e.target.value)}
                className="w-full min-h-12 rounded-xl border border-input bg-card px-4 text-base text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-ring/40"
              />
            </Field>
          </div>
        </Card>

        <Card>
          <h2 className="mb-3 flex items-center gap-2 text-lg font-bold">
            <Navigation className="size-5 text-secondary" aria-hidden />
            {t("Map output")}
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-semibold">{t("Include")}</label>
              <select
                className="w-full min-h-12 rounded-xl border border-input bg-card px-4 text-base text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-ring/40"
                value={nav}
                onChange={(e) => setNav(e.target.value as ExportOptions["navigationOutput"])}
              >
                {navOptions.map((n) => (
                  <option key={n.value} value={n.value}>
                    {t(n.label)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold">{t("Map provider")}</label>
              <select
                className="w-full min-h-12 rounded-xl border border-input bg-card px-4 text-base text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-ring/40"
                value={mapProvider}
                onChange={(e) => setMapProvider(e.target.value as ExportOptions["mapProvider"])}
              >
                {mapProviders.map((m) => (
                  <option key={m.value} value={m.value}>
                    {t(m.label)}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {format === "csv" && csvPreset === "mymaps" && (
            <p className="mt-2 text-sm text-muted-foreground">
              {t("Google My Maps requires latitude and longitude coordinates. Choose Coordinates only if you are importing there.")}
            </p>
          )}
        </Card>

        {format === "ics" && (
          <Card>
            <h2 className="mb-3 flex items-center gap-2 text-lg font-bold">
              <CalendarDays className="size-5 text-secondary" aria-hidden />
              {t("Calendar options")}
            </h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-semibold">{t("Reminder alarm")}</label>
                <select
                  className="w-full min-h-12 rounded-xl border border-input bg-card px-4 text-base text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-ring/40"
                  value={alarm ?? ""}
                  onChange={(e) => setAlarm(e.target.value === "" ? null : Number(e.target.value))}
                >
                  {alarms.map((a) => (
                    <option key={String(a.value)} value={a.value ?? ""}>
                      {t(a.label)}
                    </option>
                  ))}
                </select>
              </div>
              <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-border bg-card p-3 text-sm font-semibold">
                <input
                  type="checkbox"
                  checked={includeRestTransfer}
                  onChange={(e) => setIncludeRestTransfer(e.target.checked)}
                  className="size-4 accent-secondary"
                />
                {t("Include rest and transfer blocks")}
              </label>
            </div>
          </Card>
        )}

        {format === "csv" && (
          <Card>
            <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold">
              <input
                type="checkbox"
                checked={includeAccessPoints}
                onChange={(e) => setIncludeAccessPoints(e.target.checked)}
                className="size-4 accent-secondary"
              />
              {t("Include parking and transfer access points (where available)")}
            </label>
          </Card>
        )}

        <Button onClick={generate} disabled={generating || (scope === "managed" && !managedId)}>
          {generating ? t("Generating…") : t("Preview export")}
        </Button>

        {error && (
          <Card className="border-coral/50 bg-coral-soft">
            <p className="text-sm font-semibold text-coral-foreground">{error}</p>
          </Card>
        )}

        {result && (
          <Card className="border-lime/50 bg-lime-soft">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-bold">{t("Preview")}</p>
                <p className="text-sm text-muted-foreground">
                  {t(`${result.includedCount} rows included`)}
                </p>
                {result.omitted.length > 0 && (
                  <details className="mt-2 text-sm text-muted-foreground">
                    <summary className="cursor-pointer font-semibold">
                      {t(`${result.omitted.length} omitted`)}
                    </summary>
                    <ul className="mt-1 space-y-1 pl-4">
                      {result.omitted.slice(0, 20).map((o, i) => (
                        <li key={i}>
                          {o.name}: {o.reason}
                        </li>
                      ))}
                      {result.omitted.length > 20 && <li>…</li>}
                    </ul>
                  </details>
                )}
                <p className="mt-1 text-xs text-muted-foreground">
                  {t("Revision")} {result.revision} · {result.generatedAt.slice(0, 16).replace("T", " ")} UTC
                </p>
              </div>
              <Button onClick={download}>
                <Download className="size-5" aria-hidden /> {t("Download")}
              </Button>
            </div>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
