import { metresBetween } from "./geo";
import { canonicalUrl } from "./enhancements";

export const QUICK_PASTE_LIMIT = 25;
export const FILE_ROW_LIMIT = 500;
export const IMPORT_SELECTION_LIMIT = 100;
export const MAP_LOOKUP_LIMIT = 10;
export const DESTINATION_FILTER_METRES = 100_000;
export const IMPORT_FILE_BYTES = 2_000_000;

export interface ImportPlace {
  /** Stable idempotency key derived from the imported content. */
  key: string;
  name: string;
  address: string;
  note: string;
  sourceUrl: string;
  sourceQuery: string;
  latitude: number | undefined;
  longitude: number | undefined;
  providerPlaceId: string | undefined;
}

export interface ParsedImport {
  items: ImportPlace[];
  warnings: string[];
}

export interface ParsedMapLink {
  name: string;
  latitude: number | undefined;
  longitude: number | undefined;
  providerPlaceId: string | undefined;
}

const GENERIC_MAP_NAME = "Google Maps link";

function validCoordinate(latitude: number, longitude: number) {
  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
}

function cleanText(value: unknown, max = 1000): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function hashText(value: string): string {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function makeItem(
  input: Partial<ImportPlace> & { name: string; sourceQuery: string },
): ImportPlace {
  const name = cleanText(input.name, 160) || GENERIC_MAP_NAME;
  const address = cleanText(input.address, 500);
  const note = cleanText(input.note, 1000);
  const sourceUrl = cleanText(input.sourceUrl, 2048);
  const sourceQuery = cleanText(input.sourceQuery, 2048);
  const latitude = input.latitude;
  const longitude = input.longitude;
  const coordinates =
    latitude !== undefined && longitude !== undefined && validCoordinate(latitude, longitude)
      ? { latitude, longitude }
      : { latitude: undefined, longitude: undefined };
  const providerPlaceId = cleanText(input.providerPlaceId, 300) || undefined;
  const signature = [
    name,
    address,
    note,
    sourceUrl,
    coordinates.latitude,
    coordinates.longitude,
    providerPlaceId,
  ]
    .map((part) => String(part ?? ""))
    .join("|");
  return {
    key: `import-${hashText(signature)}`,
    name,
    address,
    note,
    sourceUrl,
    sourceQuery,
    latitude: coordinates.latitude,
    longitude: coordinates.longitude,
    providerPlaceId,
  };
}

function uniqueKeys(items: ImportPlace[]): ImportPlace[] {
  const seen = new Map<string, number>();
  return items.map((item) => {
    const count = (seen.get(item.key) ?? 0) + 1;
    seen.set(item.key, count);
    return count === 1 ? item : { ...item, key: `${item.key}-${count}` };
  });
}

export function isShortGoogleMapsUrl(raw: string): boolean {
  try {
    const url = new URL(raw);
    return url.protocol === "https:" && url.hostname.toLowerCase() === "maps.app.goo.gl";
  } catch {
    return false;
  }
}

export function isGoogleMapsUrl(raw: string): boolean {
  try {
    const url = new URL(raw);
    const host = url.hostname.toLowerCase();
    return (
      url.protocol === "https:" &&
      (isShortGoogleMapsUrl(raw) || /(^|\.)google\.[a-z.]+$/.test(host))
    );
  } catch {
    return false;
  }
}

function decodePlacePart(value: string): string {
  try {
    return decodeURIComponent(value.replace(/\+/g, " ")).trim();
  } catch {
    return value.replace(/\+/g, " ").trim();
  }
}

/** Extract only facts present in a Google Maps URL. Nothing is inferred. */
export function parseGoogleMapsUrl(raw: string): ParsedMapLink | null {
  if (!isGoogleMapsUrl(raw)) return null;
  try {
    const url = new URL(raw);
    let name = "";
    const placeMatch = url.pathname.match(/\/maps\/place\/([^/]+)/i);
    if (placeMatch?.[1]) name = decodePlacePart(placeMatch[1]);
    const query = url.searchParams.get("query") ?? url.searchParams.get("q") ?? "";
    const decodedQuery = decodePlacePart(query);
    if (
      !name &&
      decodedQuery &&
      !/^[-+]?\d+(?:\.\d+)?\s*,\s*[-+]?\d+(?:\.\d+)?$/.test(decodedQuery)
    ) {
      name = decodedQuery;
    }

    let latitude: number | undefined;
    let longitude: number | undefined;
    const atMatch = raw.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
    const coordinateQuery = decodedQuery.match(/^(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)$/);
    const llMatch = (url.searchParams.get("ll") ?? "").match(
      /^(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)$/,
    );
    const match = atMatch ?? coordinateQuery ?? llMatch;
    if (match?.[1] && match[2]) {
      const lat = Number(match[1]);
      const lon = Number(match[2]);
      if (validCoordinate(lat, lon)) {
        latitude = lat;
        longitude = lon;
      }
    }
    return {
      name: name.slice(0, 160) || GENERIC_MAP_NAME,
      latitude,
      longitude,
      providerPlaceId: cleanText(url.searchParams.get("query_place_id"), 300) || undefined,
    };
  } catch {
    return null;
  }
}

function tidyPastedUrl(value: string): string {
  return value.replace(/[)\]},.;!?]+$/g, "");
}

function cleanListMarker(value: string): string {
  return value.replace(/^\s*(?:[-*•]|\d+[.)])\s+/, "").trim();
}

/** Parse one place per line, including a name followed by a Maps URL. */
export function parseQuickPaste(text: string): ParsedImport {
  const warnings: string[] = [];
  const lines = text.split(/\r?\n/).map(cleanListMarker).filter(Boolean);
  if (lines.length > QUICK_PASTE_LIMIT) {
    warnings.push(
      `Only the first ${QUICK_PASTE_LIMIT} entries were read. Import the rest in another batch.`,
    );
  }
  const items: ImportPlace[] = [];
  for (const line of lines.slice(0, QUICK_PASTE_LIMIT)) {
    const urls = [...line.matchAll(/https?:\/\/[^\s]+/gi)].map((match) => ({
      raw: tidyPastedUrl(match[0]),
      index: match.index ?? 0,
    }));
    if (urls.length === 0) {
      items.push(makeItem({ name: line, sourceQuery: line }));
      continue;
    }
    const label =
      urls.length === 1
        ? cleanText(line.replace(urls[0]!.raw, "").replace(/[\s\-–—:|]+$/g, ""), 160)
        : "";
    for (const entry of urls) {
      const parsed = parseGoogleMapsUrl(entry.raw);
      let host = "Pasted link";
      try {
        host = new URL(entry.raw).hostname.replace(/^www\./, "");
      } catch {
        // The URL remains an unresolved idea; it is never fetched automatically.
      }
      items.push(
        makeItem({
          name: label || parsed?.name || host,
          sourceUrl: entry.raw,
          sourceQuery: line,
          latitude: parsed?.latitude,
          longitude: parsed?.longitude,
          providerPlaceId: parsed?.providerPlaceId,
        }),
      );
    }
  }
  return { items: uniqueKeys(items), warnings };
}

/** Small dependency-free CSV reader with quoted fields and escaped quotes. */
export function parseCsv(text: string, delimiter = ","): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const input = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < input.length; i += 1) {
    const char = input[i]!;
    if (quoted) {
      if (char === '"' && input[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
      continue;
    }
    if (char === '"') {
      quoted = true;
    } else if (char === delimiter) {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && input[i + 1] === "\n") i += 1;
      row.push(field);
      field = "";
      if (row.some((cell) => cell.trim())) rows.push(row);
      row = [];
    } else {
      field += char;
    }
  }
  if (quoted) throw new Error("This CSV has an unfinished quoted field.");
  row.push(field);
  if (row.some((cell) => cell.trim())) rows.push(row);
  return rows;
}

const normalizedHeader = (value: string) =>
  value
    .toLowerCase()
    .replace(/^\uFEFF/, "")
    .replace(/[^a-z0-9]+/g, "");

function column(headers: string[], aliases: string[]): number {
  const wanted = aliases.map(normalizedHeader);
  return headers.findIndex((header) => wanted.includes(normalizedHeader(header)));
}

function numberCell(value: string): number | undefined {
  if (!value.trim()) return undefined;
  const number = Number(value.trim());
  return Number.isFinite(number) ? number : undefined;
}

/** Google My Maps and CommonRoute's own My Maps CSV export. */
export function parseMyMapsCsv(text: string): ParsedImport {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const delimiter =
    (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";
  const rows = parseCsv(text, delimiter);
  if (rows.length < 2) throw new Error("This CSV needs a header row and at least one place.");
  const headers = rows[0]!;
  const nameCol = column(headers, ["name", "title", "business name", "place name"]);
  const addressCol = column(headers, ["address", "formatted address", "location"]);
  const noteCol = column(headers, ["description", "notes", "note", "comment"]);
  const latCol = column(headers, ["latitude", "lat", "y"]);
  const lonCol = column(headers, ["longitude", "lng", "lon", "long", "x"]);
  const urlCol = column(headers, [
    "google maps url",
    "google maps link",
    "maps url",
    "url",
    "link",
  ]);
  const wktCol = column(headers, ["wkt", "geometry"]);
  if (nameCol < 0 && urlCol < 0)
    throw new Error("This CSV needs a Name or Google Maps URL column.");
  const warnings: string[] = [];
  const dataRows = rows.slice(1);
  if (dataRows.length > FILE_ROW_LIMIT)
    warnings.push(
      `Only the first ${FILE_ROW_LIMIT} file rows were read. Split the file to import more.`,
    );
  const items: ImportPlace[] = [];
  let invalidRows = 0;
  for (const row of dataRows.slice(0, FILE_ROW_LIMIT)) {
    const cell = (index: number) => (index >= 0 ? cleanText(row[index], 2048) : "");
    const sourceUrl = cell(urlCol);
    const parsedUrl = sourceUrl ? parseGoogleMapsUrl(sourceUrl) : null;
    let latitude = numberCell(cell(latCol));
    let longitude = numberCell(cell(lonCol));
    if ((latitude === undefined || longitude === undefined) && wktCol >= 0) {
      const wkt = cell(wktCol).match(/POINT\s*\(\s*(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s*\)/i);
      if (wkt?.[1] && wkt[2]) {
        longitude = Number(wkt[1]);
        latitude = Number(wkt[2]);
      }
    }
    latitude ??= parsedUrl?.latitude;
    longitude ??= parsedUrl?.longitude;
    if (
      latitude !== undefined &&
      longitude !== undefined &&
      !validCoordinate(latitude, longitude)
    ) {
      latitude = undefined;
      longitude = undefined;
      invalidRows += 1;
    }
    const name = cell(nameCol) || parsedUrl?.name || "";
    if (!name) {
      invalidRows += 1;
      continue;
    }
    items.push(
      makeItem({
        name,
        address: cell(addressCol),
        note: cell(noteCol),
        sourceUrl,
        sourceQuery: name,
        latitude,
        longitude,
        providerPlaceId: parsedUrl?.providerPlaceId,
      }),
    );
  }
  if (invalidRows > 0)
    warnings.push(
      `${invalidRows} row${invalidRows === 1 ? " was" : "s were"} skipped or kept without coordinates because its data was incomplete.`,
    );
  return { items: uniqueKeys(items), warnings };
}

function property(properties: Record<string, unknown>, names: string[]): string {
  for (const name of names) {
    if (typeof properties[name] === "string") return cleanText(properties[name], 2048);
  }
  return "";
}

/** Google Takeout Maps (your places) GeoJSON, including Saved Places.json. */
export function parseTakeoutJson(text: string): ParsedImport {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("This JSON file could not be read. Choose a Google Takeout Saved Places file.");
  }
  const features = Array.isArray(parsed)
    ? parsed
    : typeof parsed === "object" &&
        parsed !== null &&
        Array.isArray((parsed as { features?: unknown }).features)
      ? (parsed as { features: unknown[] }).features
      : null;
  if (!features) throw new Error("This JSON does not contain Google Takeout place features.");
  const warnings: string[] = [];
  if (features.length > FILE_ROW_LIMIT)
    warnings.push(
      `Only the first ${FILE_ROW_LIMIT} file places were read. Split the file to import more.`,
    );
  const items: ImportPlace[] = [];
  let skipped = 0;
  for (const feature of features.slice(0, FILE_ROW_LIMIT)) {
    if (typeof feature !== "object" || feature === null) {
      skipped += 1;
      continue;
    }
    const record = feature as { properties?: unknown; geometry?: unknown };
    const properties =
      typeof record.properties === "object" && record.properties !== null
        ? (record.properties as Record<string, unknown>)
        : {};
    const geometry =
      typeof record.geometry === "object" && record.geometry !== null
        ? (record.geometry as { coordinates?: unknown })
        : {};
    const coordinates = Array.isArray(geometry.coordinates) ? geometry.coordinates : [];
    const longitude = typeof coordinates[0] === "number" ? coordinates[0] : undefined;
    const latitude = typeof coordinates[1] === "number" ? coordinates[1] : undefined;
    const sourceUrl = property(properties, ["Google Maps URL", "Google Maps Link", "URL", "url"]);
    const parsedUrl = sourceUrl ? parseGoogleMapsUrl(sourceUrl) : null;
    const name =
      property(properties, ["Title", "Business Name", "Name", "title", "name"]) ||
      parsedUrl?.name ||
      "";
    if (!name) {
      skipped += 1;
      continue;
    }
    const valid =
      latitude !== undefined && longitude !== undefined && validCoordinate(latitude, longitude);
    items.push(
      makeItem({
        name,
        address: property(properties, ["Address", "Formatted Address", "address"]),
        note: property(properties, ["Comment", "Description", "Notes", "note"]),
        sourceUrl,
        sourceQuery: name,
        latitude: valid ? latitude : parsedUrl?.latitude,
        longitude: valid ? longitude : parsedUrl?.longitude,
        providerPlaceId: parsedUrl?.providerPlaceId,
      }),
    );
  }
  if (skipped > 0)
    warnings.push(
      `${skipped} place${skipped === 1 ? " was" : "s were"} skipped because no name was present.`,
    );
  return { items: uniqueKeys(items), warnings };
}

export interface DuplicatePlace {
  name: string;
  sourceUrl: string;
  providerPlaceId?: string | undefined;
  latitude?: number | undefined;
  longitude?: number | undefined;
}

const simpleName = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

function samePlace(a: DuplicatePlace, b: DuplicatePlace): boolean {
  if (a.providerPlaceId && b.providerPlaceId && a.providerPlaceId === b.providerPlaceId)
    return true;
  const aUrl = a.sourceUrl ? canonicalUrl(a.sourceUrl) : null;
  const bUrl = b.sourceUrl ? canonicalUrl(b.sourceUrl) : null;
  if (aUrl && bUrl && aUrl === bUrl) return true;
  if (simpleName(a.name) !== simpleName(b.name)) return false;
  const distance = metresBetween(a, b);
  return distance === null || distance < 1500;
}

/** Flags existing and within-batch duplicates; never removes or merges them. */
export function findImportDuplicates(
  items: DuplicatePlace[],
  existing: DuplicatePlace[],
): Record<number, string> {
  const duplicates: Record<number, string> = {};
  const earlier: DuplicatePlace[] = [...existing];
  items.forEach((item, index) => {
    const duplicate = earlier.find((candidate) => samePlace(item, candidate));
    if (duplicate) duplicates[index] = duplicate.name;
    earlier.push(item);
  });
  return duplicates;
}

/** Unknown distances stay reviewable; only a known point beyond the limit is excluded by the filter. */
export function beyondDestination(
  item: { latitude?: number | undefined; longitude?: number | undefined },
  centre: { latitude?: number | undefined; longitude?: number | undefined } | null,
  limit = DESTINATION_FILTER_METRES,
): boolean {
  if (!centre) return false;
  const distance = metresBetween(item, centre);
  return distance !== null && distance > limit;
}

/** Multi-city trips: near any known trip place is near enough. Unknown stays reviewable. */
export function beyondAllReferences(
  item: { latitude?: number | undefined; longitude?: number | undefined },
  references: Array<{ latitude?: number | undefined; longitude?: number | undefined }>,
  limit = DESTINATION_FILTER_METRES,
): boolean {
  if (item.latitude == null || item.longitude == null || references.length === 0) return false;
  return references.every((reference) => beyondDestination(item, reference, limit));
}
