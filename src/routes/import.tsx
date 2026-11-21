import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Check,
  ClipboardList,
  FileJson,
  FileSpreadsheet,
  Link2,
  Loader2,
  MapPin,
  Upload,
} from "lucide-react";
import { AppShell } from "@/components/kintrip/AppShell";
import { Button, Card, Chip, Field, LinkButton, inputClass } from "@/components/kintrip/ui";
import { useAccount } from "@/lib/kintrip/auth";
import { importPlaces } from "@/lib/kintrip/import.actions";
import { expandGoogleMapsLinks } from "@/lib/kintrip/import.functions";
import {
  beyondAllReferences,
  FILE_ROW_LIMIT,
  findImportDuplicates,
  IMPORT_FILE_BYTES,
  IMPORT_SELECTION_LIMIT,
  isShortGoogleMapsUrl,
  MAP_LOOKUP_LIMIT,
  parseGoogleMapsUrl,
  parseMyMapsCsv,
  parseQuickPaste,
  parseTakeoutJson,
  QUICK_PASTE_LIMIT,
  type ImportPlace,
  type ParsedImport,
} from "@/lib/kintrip/import";
import { searchPlaces, type PlaceProvider, type PlaceResult } from "@/lib/kintrip/places.functions";
import { useKintrip } from "@/lib/kintrip/store";
import { trackProduct } from "@/lib/kintrip/track";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/import")({
  head: () => ({
    meta: [
      { title: "Import travel spots — CommonRoute" },
      {
        name: "description",
        content:
          "Paste place names and Google Maps links, or import Google Takeout JSON and My Maps CSV files into your group trip.",
      },
      { property: "og:title", content: "Import travel spots — CommonRoute" },
      {
        property: "og:description",
        content: "Review saved places, spot duplicates and add them to group voting or Ideas.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ImportScreen,
});

interface ReviewItem {
  draft: ImportPlace;
  match: PlaceResult | undefined;
  matchAttempted: boolean;
  lookupError: string | undefined;
  selected: boolean;
  duplicateOf: string | undefined;
}

interface Centre {
  latitude: number;
  longitude: number;
}

const genericNames = new Set(["Google Maps link", "maps.app.goo.gl", "Pasted link"]);

function effectivePlace(item: ReviewItem) {
  return {
    name: item.match?.name || item.draft.name,
    address: item.match?.address || item.draft.address,
    sourceUrl: item.draft.sourceUrl || item.match?.mapsUrl || "",
    providerPlaceId: item.match?.placeId ?? item.draft.providerPlaceId,
    latitude: item.match?.latitude ?? item.draft.latitude,
    longitude: item.match?.longitude ?? item.draft.longitude,
  };
}

function withDuplicates(
  items: ReviewItem[],
  existing: ReturnType<typeof useKintrip>["attractions"],
): ReviewItem[] {
  const duplicates = findImportDuplicates(items.map(effectivePlace), existing);
  return items.map((item, index) => {
    const duplicateOf = duplicates[index];
    return { ...item, duplicateOf, selected: duplicateOf ? false : item.selected };
  });
}

function initialReview(parsed: ParsedImport): ReviewItem[] {
  return parsed.items.map((draft) => ({
    draft,
    match: undefined,
    matchAttempted: false,
    lookupError: undefined,
    selected: true,
    duplicateOf: undefined,
  }));
}

function ImportScreen() {
  const state = useKintrip();
  const { session } = useAccount();
  const search = useServerFn(searchPlaces);
  const expand = useServerFn(expandGoogleMapsLinks);
  const [method, setMethod] = useState<"paste" | "file">("paste");
  const [pasteText, setPasteText] = useState("");
  const [fileName, setFileName] = useState("");
  const [provider, setProvider] = useState<PlaceProvider>("free");
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [fallbackNotice, setFallbackNotice] = useState<string | null>(null);
  const [target, setTarget] = useState<"shortlist" | "ideas">("shortlist");
  const [filterNear, setFilterNear] = useState(false);
  const [centre, setCentre] = useState<Centre | null>(null);
  const [findingCentre, setFindingCentre] = useState(false);
  const [result, setResult] = useState<{
    imported: number;
    skipped: number;
    target: "shortlist" | "ideas";
  } | null>(null);

  const me =
    state.travellers.find((traveller) => traveller.id === state.activeTravellerId) ??
    state.travellers[0];
  const present = (next: ReviewItem[]) => withDuplicates(next, state.attractions);
  const knownReferences: Centre[] = state.attractions
    .filter((attraction) => attraction.latitude != null && attraction.longitude != null)
    .map((attraction) => ({ latitude: attraction.latitude!, longitude: attraction.longitude! }));
  const references = centre ? [...knownReferences, centre] : knownReferences;
  const isFar = (item: ReviewItem) =>
    filterNear && beyondAllReferences(effectivePlace(item), references);
  const selected = items.filter((item) => item.selected && !isFar(item));
  const selectedCount = selected.length;

  if (!me) {
    return (
      <AppShell title="Import spots">
        <Card className="space-y-3">
          <p className="text-muted-foreground">Start or join a trip before importing places.</p>
          <LinkButton to="/create">Start a trip</LinkButton>
        </Card>
      </AppShell>
    );
  }

  const resetReview = () => {
    setItems([]);
    setWarnings([]);
    setError(null);
    setResult(null);
    setProgress("");
    setFallbackNotice(null);
    setFilterNear(false);
  };

  const preparePaste = async () => {
    resetReview();
    setBusy(true);
    try {
      const parsed = parseQuickPaste(pasteText);
      if (parsed.items.length === 0)
        throw new Error("Paste at least one place name or Google Maps link.");
      let working = initialReview(parsed);
      setItems(present(working));
      setWarnings(parsed.warnings);

      const shortLinks = working.filter((item) => isShortGoogleMapsUrl(item.draft.sourceUrl));
      if (shortLinks.length > MAP_LOOKUP_LIMIT) {
        setWarnings((current) => [
          ...current,
          `Only the first ${MAP_LOOKUP_LIMIT} short links were opened. The others keep their original link.`,
        ]);
      }
      if (shortLinks.length > 0) {
        setProgress("Opening Google Maps short links…");
        const outcome = await expand({
          data: { urls: shortLinks.slice(0, MAP_LOOKUP_LIMIT).map((item) => item.draft.sourceUrl) },
        });
        for (const resolved of outcome.results) {
          if (!resolved.finalUrl) continue;
          const parsedUrl = parseGoogleMapsUrl(resolved.finalUrl);
          if (!parsedUrl) continue;
          working = working.map((item) => {
            if (item.draft.sourceUrl !== resolved.source) return item;
            const generic = genericNames.has(item.draft.name);
            return {
              ...item,
              draft: {
                ...item.draft,
                name: generic ? parsedUrl.name : item.draft.name,
                sourceUrl: resolved.finalUrl!,
                latitude: parsedUrl.latitude,
                longitude: parsedUrl.longitude,
                providerPlaceId: parsedUrl.providerPlaceId,
              },
            };
          });
        }
        setItems(present(working));
      }

      const lookupKeys = working
        .filter((item) => {
          const place = effectivePlace(item);
          const hostOnly = /^[\w-]+\.[a-z]{2,}(?:\.[a-z]{2,})?$/i.test(place.name);
          return (
            place.latitude == null &&
            place.longitude == null &&
            !genericNames.has(place.name) &&
            !hostOnly
          );
        })
        .slice(0, MAP_LOOKUP_LIMIT)
        .map((item) => item.draft.key);
      const unlooked =
        working.filter((item) => {
          const place = effectivePlace(item);
          return place.latitude == null && place.longitude == null && !genericNames.has(place.name);
        }).length - lookupKeys.length;
      if (unlooked > 0) {
        setWarnings((current) => [
          ...current,
          `${unlooked} entr${unlooked === 1 ? "y" : "ies"} will be kept without an automatic map lookup.`,
        ]);
      }

      for (let index = 0; index < lookupKeys.length; index += 1) {
        const key = lookupKeys[index]!;
        const current = working.find((item) => item.draft.key === key);
        if (!current) continue;
        setProgress(`Finding map matches ${index + 1} of ${lookupKeys.length}…`);
        try {
          const outcome = await search({
            data: { query: current.draft.name, destination: state.trip.destination, provider },
          });
          const match = outcome.results[0];
          if (outcome.notice) setFallbackNotice(outcome.notice);
          working = working.map((item) =>
            item.draft.key === key ? { ...item, match, matchAttempted: true } : item,
          );
        } catch {
          working = working.map((item) =>
            item.draft.key === key
              ? {
                  ...item,
                  matchAttempted: true,
                  lookupError:
                    "Map search was unavailable. This entry will be kept without a location.",
                }
              : item,
          );
        }
        setItems(present(working));
        if (provider === "free" && index < lookupKeys.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 1100));
        }
      }
      setItems(present(working));
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Those places could not be read. Check the text and try again.",
      );
    } finally {
      setBusy(false);
      setProgress("");
    }
  };

  const readFile = async (file: File) => {
    resetReview();
    setFileName(file.name);
    setBusy(true);
    try {
      if (file.size > IMPORT_FILE_BYTES)
        throw new Error("Choose a JSON or CSV file smaller than 2 MB.");
      const text = await file.text();
      const trimmed = text.trimStart();
      const parsed =
        file.name.toLowerCase().endsWith(".json") ||
        trimmed.startsWith("{") ||
        trimmed.startsWith("[")
          ? parseTakeoutJson(text)
          : parseMyMapsCsv(text);
      if (parsed.items.length === 0) throw new Error("No named places were found in this file.");
      setItems(present(initialReview(parsed)));
      setWarnings(parsed.warnings);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "This file could not be read.");
    } finally {
      setBusy(false);
    }
  };

  const chooseCentre = async (): Promise<Centre | null> => {
    if (centre) return centre;
    const existing = state.attractions.find(
      (attraction) => attraction.latitude != null && attraction.longitude != null,
    );
    if (existing) {
      const next = { latitude: existing.latitude!, longitude: existing.longitude! };
      setCentre(next);
      return next;
    }
    setFindingCentre(true);
    try {
      const outcome = await search({
        data: {
          query: state.trip.destination,
          destination: state.trip.destination,
          provider: "free",
        },
      });
      const found = outcome.results.find(
        (place) => place.latitude != null && place.longitude != null,
      );
      if (!found) {
        setError(
          "The destination centre could not be found. Leave the distance filter off and review every place manually.",
        );
        return null;
      }
      const next = { latitude: found.latitude!, longitude: found.longitude! };
      setCentre(next);
      return next;
    } catch {
      setError(
        "The destination centre could not be found. Leave the distance filter off and review every place manually.",
      );
      return null;
    } finally {
      setFindingCentre(false);
    }
  };

  const toggleDistanceFilter = async () => {
    if (filterNear) {
      setFilterNear(false);
      return;
    }
    setError(null);
    const nextCentre = await chooseCentre();
    if (!nextCentre) return;
    setFilterNear(true);
    const nextReferences = [...knownReferences, nextCentre];
    setItems((current) =>
      current.map((item) =>
        beyondAllReferences(effectivePlace(item), nextReferences)
          ? { ...item, selected: false }
          : item,
      ),
    );
  };

  const commit = () => {
    setError(null);
    if (selectedCount > IMPORT_SELECTION_LIMIT) {
      setError(`Select at most ${IMPORT_SELECTION_LIMIT} places for one import.`);
      return;
    }
    const outcome = importPlaces(
      selected.map((item) => ({ draft: item.draft, match: item.match })),
      target,
    );
    if (outcome.error) {
      setError(outcome.error);
      return;
    }
    trackProduct(state, "places_imported", { count: outcome.imported });
    setResult({ ...outcome, target });
    setItems([]);
    setPasteText("");
    setFileName("");
    setWarnings([]);
  };

  return (
    <AppShell title="Import spots" subtitle={`Add saved places to ${state.trip.title}`}>
      {result ? (
        <Card className="space-y-3 bg-primary-soft">
          <h2 className="flex items-center gap-2 text-lg">
            <Check className="size-5 text-secondary" aria-hidden /> Import complete
          </h2>
          <p>{`${result.imported} place${result.imported === 1 ? "" : "s"} added to ${result.target === "ideas" ? "Ideas" : "the voting shortlist"}.`}</p>
          {result.skipped > 0 ? (
            <p className="text-sm">{`${result.skipped} already imported ${result.skipped === 1 ? "entry was" : "entries were"} skipped.`}</p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <LinkButton to={result.target === "ideas" ? "/ideas" : "/discover"}>
              {result.target === "ideas" ? "Open Ideas" : "Open Discover"}
            </LinkButton>
            <Button variant="outline" onClick={() => setResult(null)}>
              Import more
            </Button>
          </div>
        </Card>
      ) : null}

      <Card className="space-y-4">
        <div
          role="group"
          aria-label="Import method"
          className="grid grid-cols-2 gap-2 rounded-xl bg-muted p-1"
        >
          <button
            type="button"
            aria-pressed={method === "paste"}
            onClick={() => {
              setMethod("paste");
              resetReview();
            }}
            className={cn(
              "flex min-h-12 items-center justify-center gap-2 rounded-lg px-2 font-bold",
              method === "paste" ? "bg-card text-primary shadow-sm" : "text-muted-foreground",
            )}
          >
            <ClipboardList className="size-5" aria-hidden /> Quick paste
          </button>
          <button
            type="button"
            aria-pressed={method === "file"}
            onClick={() => {
              setMethod("file");
              resetReview();
            }}
            className={cn(
              "flex min-h-12 items-center justify-center gap-2 rounded-lg px-2 font-bold",
              method === "file" ? "bg-card text-primary shadow-sm" : "text-muted-foreground",
            )}
          >
            <Upload className="size-5" aria-hidden /> File upload
          </button>
        </div>

        {method === "paste" ? (
          <>
            <Field label="Place names or Google Maps links">
              <textarea
                className={inputClass}
                rows={7}
                value={pasteText}
                onChange={(event) => setPasteText(event.target.value)}
                placeholder={
                  "Fushimi Inari Shrine\nNishiki Market\nhttps://maps.app.goo.gl/your-link"
                }
                maxLength={12000}
              />
            </Field>
            <p className="text-sm text-muted-foreground">{`One per line. You can put a name beside a link. Up to ${QUICK_PASTE_LIMIT} entries and ${MAP_LOOKUP_LIMIT} automatic lookups per batch; unmatched entries are never discarded.`}</p>
            <Field label="Map lookup source">
              <select
                className={inputClass}
                value={provider}
                onChange={(event) => setProvider(event.target.value as PlaceProvider)}
                disabled={busy}
              >
                <option value="free">Free map search</option>
                {session ? <option value="google">Google Maps</option> : null}
              </select>
            </Field>
            <Button
              onClick={() => void preparePaste()}
              disabled={busy || pasteText.trim().length < 2}
            >
              {busy ? (
                <Loader2 className="size-5 animate-spin" aria-hidden />
              ) : (
                <Link2 className="size-5" aria-hidden />
              )}
              Review pasted places
            </Button>
          </>
        ) : (
          <>
            <div className="rounded-2xl border border-dashed border-primary/40 bg-primary-soft p-5 text-center">
              <div className="flex justify-center gap-3 text-secondary">
                <FileJson className="size-7" aria-hidden />
                <FileSpreadsheet className="size-7" aria-hidden />
              </div>
              <h2 className="mt-2 text-lg">Google Takeout JSON or My Maps CSV</h2>
              <p className="mt-1 text-sm text-muted-foreground">{`Choose Saved Places.json from Takeout, or a CSV exported from Google My Maps. Up to ${FILE_ROW_LIMIT} rows and 2 MB.`}</p>
              <label className="mt-4 inline-flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-xl bg-secondary px-5 font-bold text-secondary-foreground shadow-sm">
                <Upload className="size-5" aria-hidden /> Choose JSON or CSV
                <input
                  type="file"
                  accept=".json,.csv,application/json,text/csv"
                  className="sr-only"
                  disabled={busy}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = "";
                    if (file) void readFile(file);
                  }}
                />
              </label>
              {fileName ? (
                <p className="mt-2 break-words text-sm font-semibold">{fileName}</p>
              ) : null}
            </div>
            <p className="text-sm text-muted-foreground">
              Your file is parsed on this device. It is not uploaded to a file store. Rows with
              coordinates need no map lookup.
            </p>
          </>
        )}
      </Card>

      {busy ? (
        <Card className="flex items-center gap-3">
          <Loader2 className="size-5 shrink-0 animate-spin text-secondary" aria-hidden />
          <p role="status">{progress || "Reading your places…"}</p>
        </Card>
      ) : null}
      {fallbackNotice ? (
        <p role="status" className="rounded-xl bg-sunny-soft px-4 py-3 text-sm font-semibold">
          {fallbackNotice}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="rounded-xl bg-sunny-soft px-4 py-3 text-sm font-semibold">
          {error}
        </p>
      ) : null}
      {warnings.map((warning) => (
        <p key={warning} className="rounded-xl bg-muted px-4 py-3 text-sm">
          {warning}
        </p>
      ))}

      {items.length > 0 ? (
        <>
          <Card className="space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg">Review and select</h2>
                <p className="text-sm text-muted-foreground">
                  Check names and map matches before anything is added.
                </p>
              </div>
              <Chip tone="primary">{`${selectedCount} selected`}</Chip>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                disabled={busy}
                onClick={() =>
                  setItems((current) =>
                    current.map((item) => ({ ...item, selected: !isFar(item) })),
                  )
                }
              >
                Select all
              </Button>
              <Button
                variant="outline"
                disabled={busy}
                onClick={() =>
                  setItems((current) => current.map((item) => ({ ...item, selected: false })))
                }
              >
                Deselect all
              </Button>
            </div>
            <label className="flex min-h-12 items-start gap-3 rounded-xl bg-muted px-3 py-3 text-sm font-semibold">
              <input
                type="checkbox"
                className="mt-1 size-5 shrink-0"
                checked={filterNear}
                disabled={findingCentre || busy}
                onChange={() => void toggleDistanceFilter()}
              />
              <span>
                {`Only select places within 100 km of ${state.trip.destination}`}
                <span className="block text-xs font-normal text-muted-foreground">
                  Straight-line distance from the destination or any known trip place. Unknown
                  distances stay available for review.
                </span>
              </span>
            </label>
            <Field label="Add selected places to">
              <select
                className={inputClass}
                value={target}
                onChange={(event) => setTarget(event.target.value as "shortlist" | "ideas")}
              >
                <option value="shortlist">Candidates for voting (Discover)</option>
                <option value="ideas">Ideas for later review</option>
              </select>
            </Field>
          </Card>

          <ul className="space-y-3" aria-label="Places to import">
            {items.map((item) => {
              const place = effectivePlace(item);
              const far = isFar(item);
              return (
                <li key={item.draft.key} className={cn("kin-card p-4", far && "opacity-70")}>
                  <label className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      className="mt-1 size-5 shrink-0"
                      checked={item.selected && !far}
                      disabled={busy || far}
                      onChange={(event) =>
                        setItems((current) =>
                          current.map((candidate) =>
                            candidate.draft.key === item.draft.key
                              ? { ...candidate, selected: event.target.checked }
                              : candidate,
                          ),
                        )
                      }
                      aria-label={`Select ${place.name}`}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block break-words font-bold">{place.name}</span>
                      {place.address || item.draft.address ? (
                        <span className="mt-1 block break-words text-sm text-muted-foreground">
                          {place.address || item.draft.address}
                        </span>
                      ) : null}
                    </span>
                  </label>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {item.match ? (
                      <Chip tone="secondary">
                        {item.match.provider === "google"
                          ? "Matched on Google Maps"
                          : "Matched on free map search"}
                      </Chip>
                    ) : place.latitude != null && place.longitude != null ? (
                      <Chip tone="secondary">Coordinates included</Chip>
                    ) : (
                      <Chip tone="sunny">Location needed</Chip>
                    )}
                    {item.duplicateOf ? <Chip tone="sunny">Possible duplicate</Chip> : null}
                    {far ? <Chip tone="sunny">Over 100 km away</Chip> : null}
                  </div>
                  {item.duplicateOf ? (
                    <p className="mt-2 text-sm">{`Looks like “${item.duplicateOf}”, already imported or on this trip. It is unselected, but you can choose it if this is different.`}</p>
                  ) : null}
                  {item.draft.note ? (
                    <p className="mt-2 whitespace-pre-wrap break-words text-sm">
                      {item.draft.note}
                    </p>
                  ) : null}
                  {item.lookupError ? <p className="mt-2 text-sm">{item.lookupError}</p> : null}
                  {!item.match && !item.lookupError && place.latitude == null ? (
                    <p className="mt-2 text-sm text-muted-foreground">
                      No confirmed location. It will be saved for review rather than guessed.
                    </p>
                  ) : null}
                  {item.draft.sourceUrl ? (
                    <a
                      href={item.draft.sourceUrl}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="mt-2 inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-secondary underline"
                    >
                      <MapPin className="size-4" aria-hidden /> Open source link
                    </a>
                  ) : null}
                </li>
              );
            })}
          </ul>

          <Card className="space-y-3">
            <p className="text-sm text-muted-foreground">{`Up to ${IMPORT_SELECTION_LIMIT} selected places per import. Anything without a confirmed location stays marked “Location needed” and cannot enter a route yet.`}</p>
            <Button
              className="w-full sm:w-auto"
              disabled={busy || selectedCount === 0}
              onClick={commit}
            >
              {`Import ${selectedCount} selected place${selectedCount === 1 ? "" : "s"}`}
            </Button>
          </Card>
        </>
      ) : null}

      {!items.length && !busy ? (
        <p className="text-center text-sm text-muted-foreground">
          You can also{" "}
          <Link to="/ideas" className="font-semibold text-secondary underline">
            save one quick idea
          </Link>{" "}
          or{" "}
          <Link to="/discover" className="font-semibold text-secondary underline">
            search in Discover
          </Link>
          .
        </p>
      ) : null}
    </AppShell>
  );
}
