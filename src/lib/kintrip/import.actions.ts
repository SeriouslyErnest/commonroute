import { setState } from "./store";
import { isOrganiser, logAudit, newSuggestion } from "./governance";
import type { ImportPlace } from "./import";
import { IMPORT_SELECTION_LIMIT } from "./import";
import type { PlaceResult } from "./places.functions";
import type { Attraction, KintripState } from "./types";

const uid = () => Math.random().toString(36).slice(2, 10);

function canContribute(state: KintripState): boolean {
  const me = state.travellers.find((traveller) => traveller.id === state.activeTravellerId);
  return Boolean(me) && !(me!.roles.length === 1 && me!.roles[0] === "viewer");
}

export interface ImportCommitItem {
  draft: ImportPlace;
  match?: PlaceResult | undefined;
}

export interface ImportCommitResult {
  imported: number;
  skipped: number;
  error: string | null;
}

/** One atomic trip change, with retry protection and action-layer permission. */
export function importPlaces(
  items: ImportCommitItem[],
  target: "shortlist" | "ideas",
): ImportCommitResult {
  const out: ImportCommitResult = { imported: 0, skipped: 0, error: null };
  if (items.length > IMPORT_SELECTION_LIMIT) {
    return {
      imported: 0,
      skipped: 0,
      error: `Import at most ${IMPORT_SELECTION_LIMIT} places at a time.`,
    };
  }
  setState((prev) => {
    if (!canContribute(prev)) {
      out.error = "Viewers cannot import places on this trip.";
      return prev;
    }
    const attractions = [...prev.attractions];
    const addedAttractions: Attraction[] = [];
    const suggestions = { ...prev.suggestions };
    for (const item of items) {
      const { draft, match } = item;
      if (attractions.some((attraction) => attraction.captureKey === draft.key)) {
        out.skipped += 1;
        continue;
      }
      const name = (match?.name || draft.name).trim();
      if (!name) {
        out.skipped += 1;
        continue;
      }
      const id = `import-${uid()}`;
      const latitude = match?.latitude ?? draft.latitude;
      const longitude = match?.longitude ?? draft.longitude;
      const address = match?.address || draft.address;
      const located = typeof latitude === "number" && typeof longitude === "number";
      const attraction: Attraction = {
        id,
        name,
        city: prev.trip.destination,
        area: address.split(",").map((part) => part.trim())[1] || prev.trip.destination,
        category:
          target === "ideas"
            ? "Imported idea"
            : match?.provider === "google"
              ? "From Google Maps"
              : match
                ? "From map search"
                : "Imported place",
        description: address || draft.note,
        durationMin: 90,
        walking: "moderate",
        cost: "$",
        indoor: false,
        opens: "",
        closes: "",
        sourceUrl: draft.sourceUrl || match?.mapsUrl || "",
        latitude,
        longitude,
        provider: match?.provider ?? (draft.providerPlaceId ? "google" : undefined),
        providerPlaceId: match?.placeId ?? draft.providerPlaceId,
        sourceQuery: draft.sourceQuery,
        capturedAt: new Date().toISOString(),
        locationStatus: located ? "resolved" : "needs_location",
        ideaNote: draft.note || undefined,
        captureKey: draft.key,
        ideaOnly: target === "ideas",
      };
      const suggestion = newSuggestion(attraction, prev.activeTravellerId);
      attractions.push(attraction);
      addedAttractions.push(attraction);
      suggestions[id] = {
        ...suggestion,
        cost: { ...suggestion.cost, currency: prev.decisions.currency },
      };
      out.imported += 1;
    }
    if (out.imported === 0) return prev;
    return logAudit(
      { ...prev, attractions: [...addedAttractions, ...prev.attractions], suggestions },
      "Places imported",
      `${out.imported} place${out.imported === 1 ? "" : "s"} → ${target === "ideas" ? "Ideas" : "Voting shortlist"}`,
    );
  });
  return out;
}

/** Deliberately move an imported idea onto Discover; location facts are retained. */
export function moveImportedIdeaToShortlist(id: string): string | null {
  let error: string | null = null;
  setState((prev) => {
    if (!canContribute(prev)) {
      error = "Viewers cannot change suggestions on this trip.";
      return prev;
    }
    const attraction = prev.attractions.find((item) => item.id === id);
    if (!attraction?.ideaOnly) return prev;
    const owner = prev.suggestions[id]?.suggestedBy === prev.activeTravellerId;
    if (!owner && !isOrganiser(prev)) {
      error = "Only the person who imported it or an organiser can move it to the shortlist.";
      return prev;
    }
    return logAudit(
      {
        ...prev,
        attractions: prev.attractions.map((item) =>
          item.id === id ? { ...item, ideaOnly: false } : item,
        ),
      },
      "Imported idea moved to shortlist",
      attraction.name,
    );
  });
  return error;
}
