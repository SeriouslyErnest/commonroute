import type {
  Attraction,
  Booking,
  ItineraryDay,
  ItineraryItem,
  KintripState,
} from "./types";

export type ExportFormat = "csv" | "ics";
export type CsvPreset = "mymaps" | "readable";
export type NavigationOutput = "coordinates" | "links" | "both";
export type MapProvider = "google" | "apple" | "both";
export type AudienceScope = "all" | "me" | "managed" | "bookings";

export interface ExportOptions {
  revision: number;
  format: ExportFormat;
  csvPreset: CsvPreset | undefined;
  dateRange: { start: string | undefined; end: string | undefined } | undefined;
  categories: ItemKind[] | undefined;
  audienceScope: AudienceScope | undefined;
  managedTravellerId: string | undefined;
  includeAccessPoints: boolean | undefined;
  navigationOutput: NavigationOutput | undefined;
  mapProvider: MapProvider | undefined;
  alarmMinutes: number | null | undefined;
  includeRestTransfer: boolean | undefined;
}

export interface ExportResult {
  filename: string;
  mimeType: string;
  content: string;
  includedCount: number;
  omitted: OmittedRecord[];
  revision: number;
  generatedAt: string;
}

export interface OmittedRecord {
  name: string;
  reason: string;
}

type ItemKind = "activity" | "meal" | "rest" | "travel";

const SCHEMA_VERSION = "commonroute-e1-2026-09-21";
const MAX_MYMAP_ROWS = 2000;

/* ---------------- pure selection ---------------- */

function selectItems(state: KintripState, options: ExportOptions) {
  const days = state.itinerary?.days ?? [];
  const omitted: OmittedRecord[] = [];
  const actorId = state.activeTravellerId;

  if (days.length === 0) {
    return { rows: [], omitted };
  }

  const filteredDays = days.filter((day) => {
    if (options.dateRange?.start && day.date < options.dateRange.start) return false;
    if (options.dateRange?.end && day.date > options.dateRange.end) return false;
    return true;
  });

  if (filteredDays.length === 0) {
    return { rows: [], omitted: [{ name: "Date range", reason: "No days match the selected dates" }] };
  }

  const categorySet = options.categories?.length
    ? new Set<ItemKind>(options.categories)
    : new Set<ItemKind>(["activity", "meal", "rest", "travel"]);

  if (options.audienceScope === "bookings") {
    // Export only booking-related records: confirmed bookings and travel legs.
    const rows: ExportRow[] = [];
    for (const day of filteredDays) {
      for (const item of day.items) {
        if (item.kind === "travel") {
          rows.push(buildRow(state, day, item, options));
        }
      }
      for (const booking of state.bookings) {
        if (booking.status !== "cancelled" && booking.startLocal?.slice(0, 10) === day.date) {
          rows.push(buildBookingRow(state, day, booking, options));
        }
      }
    }
    return { rows, omitted };
  }

  const rows: ExportRow[] = [];
  for (const day of filteredDays) {
    for (const item of day.items) {
      if (!categorySet.has(item.kind)) {
        if (options.format === "csv") {
          omitted.push({ name: item.title, reason: `Category "${item.kind}" excluded` });
        }
        continue;
      }
      if (options.format === "ics" && !options.includeRestTransfer && (item.kind === "rest" || item.kind === "travel")) {
        omitted.push({ name: item.title, reason: "Rest and transfer blocks excluded" });
        continue;
      }
      if (options.audienceScope === "me") {
        const rec = state.attendance.find((a) => a.itemId === item.id && a.travellerId === actorId);
        if (rec && rec.state === "sitting_out") {
          omitted.push({ name: item.title, reason: "You are sitting this out" });
          continue;
        }
      }
      if (options.audienceScope === "managed" && options.managedTravellerId) {
        const rec = state.attendance.find(
          (a) => a.itemId === item.id && a.travellerId === options.managedTravellerId,
        );
        if (rec && rec.state === "sitting_out") {
          omitted.push({ name: item.title, reason: `${nameOf(state, options.managedTravellerId)} is sitting this out` });
          continue;
        }
      }
      rows.push(buildRow(state, day, item, options));
    }
  }

  // Add access-point rows if requested and present.
  if (options.includeAccessPoints) {
    for (const row of [...rows]) {
      const accessRows = accessPointRows(state, row, options);
      rows.push(...accessRows);
    }
  }

  rows.sort((a, b) => sortKey(a).localeCompare(sortKey(b)));
  return { rows, omitted };
}

function sortKey(row: ExportRow) {
  return `${row.date}T${row.start ?? "00:00"}_${String(row.stopOrder).padStart(4, "0")}`;
}

function nameOf(state: KintripState, id: string) {
  return state.travellers.find((t) => t.id === id)?.name ?? "Someone";
}

/* ---------------- row model ---------------- */

interface ExportRow {
  recordId: string;
  activityId: string | undefined;
  placeId: string | undefined;
  name: string;
  latitude: number | undefined;
  longitude: number | undefined;
  address: string | undefined;
  category: string;
  pointRole: "attraction_entrance" | "eatery" | "hotel" | "parking" | "transfer" | "booking" | "unknown";
  tripName: string;
  dayNumber: number;
  date: string;
  stopOrder: number;
  start: string | undefined;
  end: string | undefined;
  timeZone: string | undefined;
  planningStatus: string;
  bookingStatus: string;
  accessSummary: string;
  hoursStatus: string;
  googleMapsUrl: string | undefined;
  appleMapsUrl: string | undefined;
  commonRouteUrl: string | undefined;
  travelMode: string | undefined;
  travelMinutes: number | undefined;
  travelFrom: string | undefined;
  notes: string | undefined;
  isBooking: boolean;
  booking: Booking | undefined;
  item: ItineraryItem | undefined;
}

function buildRow(
  state: KintripState,
  day: ItineraryDay,
  item: ItineraryItem,
  options: ExportOptions,
): ExportRow {
  const attraction = item.attractionId ? state.attractions.find((a) => a.id === item.attractionId) : undefined;
  const suggestion = item.attractionId ? state.suggestions[item.attractionId] : undefined;
  const coords = itemCoords(attraction, item);
  const status = itemStatus(item, suggestion);
  const booking = findBookingFor(state, item, day.date);
  const mode = travelModeLabel(item);

  const from = item.kind === "travel" ? item.title.split(" → ")[0] : undefined;

  return {
    recordId: item.id,
    activityId: item.attractionId,
    placeId: attraction?.providerPlaceId,
    name: item.title,
    latitude: coords.lat,
    longitude: coords.lng,
    address: item.address ?? addressOf(attraction),
    category: item.kind === "activity" ? (attraction?.category ?? "Activity") : kindLabel(item.kind),
    pointRole: pointRoleFor(item, attraction),
    tripName: state.trip.title,
    dayNumber: day.day,
    date: day.date,
    stopOrder: day.items.indexOf(item) + 1,
    start: item.start,
    end: addMinutes(item.start, item.durationMin),
    timeZone: state.trip.timeZone,
    planningStatus: status.planning,
    bookingStatus: bookingStatusLabel(booking),
    accessSummary: accessSummary(attraction, item),
    hoursStatus: hoursStatusFor(state, day, item, attraction),
    googleMapsUrl: navigationUrl(state, day, item, attraction, "google", options),
    appleMapsUrl: navigationUrl(state, day, item, attraction, "apple", options),
    commonRouteUrl: commonRouteActivityUrl(state, item),
    travelMode: mode,
    travelMinutes: item.kind === "travel" ? item.durationMin : undefined,
    travelFrom: from,
    notes: item.note,
    isBooking: false,
    booking: undefined,
    item,
  };
}

function buildBookingRow(
  state: KintripState,
  day: ItineraryDay,
  booking: Booking,
  options: ExportOptions,
): ExportRow {
  const startTime = booking.startLocal?.slice(11, 16) || "00:00";
  const endTime = booking.endLocal?.slice(11, 16) || addMinutes(startTime, 60);
  const address = booking.addressTranslated || booking.addressLocal || booking.location || "";
  return {
    recordId: `booking-${booking.id}`,
    activityId: booking.attractionId,
    placeId: undefined,
    name: booking.title,
    latitude: undefined,
    longitude: undefined,
    address,
    category: booking.type,
    pointRole: booking.type === "stay" ? "hotel" : "booking",
    tripName: state.trip.title,
    dayNumber: day.day,
    date: day.date,
    stopOrder: 0,
    start: startTime,
    end: endTime,
    timeZone: booking.timeZone || state.trip.timeZone,
    planningStatus: "Confirmed booking",
    bookingStatus: bookingStatusLabel(booking),
    accessSummary: "",
    hoursStatus: "",
    googleMapsUrl: booking.link || mapsSearchUrl(booking.title, address),
    appleMapsUrl: booking.link ? undefined : appleSearchUrl(booking.title, address),
    commonRouteUrl: commonRouteBookingUrl(state, booking),
    travelMode: undefined,
    travelMinutes: undefined,
    travelFrom: undefined,
    notes: booking.note,
    isBooking: true,
    booking,
    item: undefined,
  };
}

function accessPointRows(state: KintripState, base: ExportRow, options: ExportOptions): ExportRow[] {
  if (!base.activityId) return [];
  const attraction = state.attractions.find((a) => a.id === base.activityId);
  if (!attraction?.access) return [];
  const rows: ExportRow[] = [];
  const addPoint = (
    name: string,
    lat: number | undefined,
    lng: number | undefined,
    role: ExportRow["pointRole"],
    note?: string,
  ) => {
    if (lat == null || lng == null) return;
    const urlTarget: UrlTarget = {
      latitude: lat,
      longitude: lng,
      name,
      address: undefined,
      label: name,
      attraction: attraction,
    };
    const google = buildGoogleMapsUrl(urlTarget);
    const apple = buildAppleMapsUrl(urlTarget);
    rows.push({
      ...base,
      recordId: `${base.recordId}-${role}`,
      name,
      latitude: lat,
      longitude: lng,
      pointRole: role,
      category: "Access",
      googleMapsUrl: options.mapProvider !== "apple" ? google : undefined,
      appleMapsUrl: options.mapProvider !== "google" ? apple : undefined,
      notes: note ? `${base.notes ?? ""}\n${note}`.trim() : base.notes,
    });
  };

  const a = attraction.access;
  if (a.gatewayLatitude != null && a.gatewayLongitude != null) {
    addPoint(a.gatewayName || "Parking / transfer point", a.gatewayLatitude, a.gatewayLongitude, "parking", a.parkingNote);
  }
  for (const leg of a.outbound) {
    // Only emit endpoints that have coordinates from access legs if they are explicitly stored.
    // AccessLeg itself has no coordinates, so this is intentionally a no-op unless future data adds them.
  }
  return rows;
}

/* ---------------- helpers ---------------- */

function itemCoords(attraction: Attraction | undefined, item: ItineraryItem) {
  if (attraction?.latitude != null && attraction.longitude != null) {
    return { lat: attraction.latitude, lng: attraction.longitude };
  }
  if (item.kind === "travel") {
    // Travel legs don't have stable coordinates unless from/to places do.
    return { lat: undefined, lng: undefined };
  }
  return { lat: undefined, lng: undefined };
}

function addressOf(attraction: Attraction | undefined) {
  if (!attraction) return undefined;
  return `${attraction.area}, ${attraction.city}`;
}

function pointRoleFor(item: ItineraryItem, attraction: Attraction | undefined): ExportRow["pointRole"] {
  if (item.kind === "meal") return "eatery";
  if (item.kind === "rest" || item.kind === "travel") return "transfer";
  if (!attraction) return "unknown";
  const car = attraction.access?.carStatus;
  if (car === "park_and_transfer" || car === "restricted") return "parking";
  return "attraction_entrance";
}

function itemStatus(item: ItineraryItem, suggestion: { status?: string } | undefined) {
  if (item.locked) return { planning: "Locked" };
  if (item.kind !== "activity") return { planning: "Scheduled" };
  const status = suggestion?.status ?? "suggested";
  const map: Record<string, string> = {
    suggested: "Suggested",
    under_review: "On hold",
    provisionally_approved: "Provisionally approved",
    sponsor_approval_required: "Waiting on sponsor",
    approved: "Approved",
    backup: "Backup",
    declined: "Not included",
    booked: "Booked",
    cancelled: "Cancelled",
  };
  return { planning: map[status] ?? status };
}

function bookingStatusLabel(booking: Booking | undefined) {
  if (!booking) return "Not booked";
  const labels: Record<string, string> = {
    planned: "Planned, not booked",
    confirmed: "Confirmed",
    cancelled: "Cancelled",
  };
  return labels[booking.status] ?? booking.status;
}

function travelModeLabel(item: ItineraryItem) {
  if (item.kind !== "travel") return undefined;
  return item.transport || "Travel";
}

function kindLabel(kind: ItemKind) {
  const labels: Record<ItemKind, string> = {
    activity: "Activity",
    meal: "Meal",
    rest: "Rest",
    travel: "Travel",
  };
  return labels[kind];
}

function findBookingFor(state: KintripState, item: ItineraryItem, date: string): Booking | undefined {
  if (item.kind !== "activity" || !item.attractionId) return undefined;
  return state.bookings.find(
    (b) =>
      b.attractionId === item.attractionId &&
      b.status !== "cancelled" &&
      b.startLocal?.slice(0, 10) === date,
  );
}

function accessSummary(attraction: Attraction | undefined, item: ItineraryItem) {
  if (item.kind === "travel") return item.transport ?? "";
  if (!attraction?.access) return "";
  const a = attraction.access;
  const summary: string[] = [];
  if (a.carStatus === "direct") summary.push("Drive to entrance");
  else if (a.carStatus === "park_and_transfer") summary.push("Park, then onward transport");
  else if (a.carStatus === "restricted") summary.push("Cars restricted — conditions apply");
  else if (a.carStatus === "prohibited") summary.push("No private cars");
  if (a.outbound.length > 0) {
    summary.push(`Outbound: ${a.outbound.map((l) => `${l.mode} ${l.from}→${l.to}`).join(", ")}`);
  }
  return summary.join("; ");
}

function hoursStatusFor(
  state: KintripState,
  day: ItineraryDay,
  item: ItineraryItem,
  attraction: Attraction | undefined,
) {
  if (item.kind !== "activity" || !attraction?.hours) return "";
  const ex = attraction.hours.exceptions.find((e) => e.date === day.date);
  if (ex?.closed) return "Closed on this date";
  if (ex) return `Special hours: ${ex.open ?? "?"}–${ex.close ?? "?"}`;
  const weekday = new Date(`${day.date}T00:00:00Z`).getUTCDay();
  const intervals = attraction.hours.intervals.filter((i) => i.weekday === weekday);
  if (intervals.length === 0) return "Hours unknown";
  return intervals.map((i) => `${i.open}–${i.close}`).join(", ");
}

function addMinutes(time: string, minutes: number) {
  const [h, m] = time.split(":").map(Number);
  const total = (h ?? 0) * 60 + (m ?? 0) + minutes;
  const wrapped = ((total % 1440) + 1440) % 1440;
  return `${String(Math.floor(wrapped / 60)).padStart(2, "0")}:${String(wrapped % 60).padStart(2, "0")}`;
}

function slugify(title: string) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 30);
}

function filename(state: KintripState, options: ExportOptions, ext: string) {
  const slug = slugify(state.trip.title) || "trip";
  const purpose = options.format === "ics" ? "calendar" : options.csvPreset ?? "itinerary";
  const rev = options.revision;
  const date = new Date().toISOString().slice(0, 10);
  return `CommonRoute_${slug}_${purpose}_r${rev}_${date}.${ext}`;
}

/* ---------------- URLs ---------------- */

function navigationUrl(
  state: KintripState,
  day: ItineraryDay,
  item: ItineraryItem,
  attraction: Attraction | undefined,
  provider: "google" | "apple",
  options: ExportOptions,
): string | undefined {
  const nav = options.navigationOutput ?? "both";
  if (nav === "coordinates") return undefined;
  if (options.mapProvider === "google" && provider === "apple") return undefined;
  if (options.mapProvider === "apple" && provider === "google") return undefined;

  if (item.kind === "travel") {
    const [fromRaw, toRaw] = item.title.split(" → ");
    if (!toRaw) return undefined;
    const toAttraction = state.attractions.find((a) => `${a.area}, ${a.city}` === toRaw || a.name === toRaw);
    if (provider === "google") {
      return buildGoogleMapsUrl({
        latitude: undefined,
        longitude: undefined,
        name: toRaw,
        address: undefined,
        label: undefined,
        attraction: toAttraction,
      });
    }
    return buildAppleMapsUrl({
      latitude: undefined,
      longitude: undefined,
      name: toRaw,
      address: undefined,
      label: undefined,
      attraction: toAttraction,
    });
  }

  if (attraction?.access?.carStatus === "restricted" || attraction?.access?.carStatus === "park_and_transfer") {
    const gateway = attraction.access;
    if (gateway.gatewayLatitude != null && gateway.gatewayLongitude != null && provider === "google") {
      return buildGoogleMapsUrl({
        latitude: gateway.gatewayLatitude,
        longitude: gateway.gatewayLongitude,
        name: undefined,
        address: undefined,
        label: gateway.gatewayName || `${attraction.name} parking/transfer`,
        attraction: undefined,
      });
    }
  }

  if (provider === "google") {
    return buildGoogleMapsUrl({
      latitude: undefined,
      longitude: undefined,
      name: item.title,
      address: item.address,
      label: undefined,
      attraction,
    });
  }
  return buildAppleMapsUrl({
    latitude: undefined,
    longitude: undefined,
    name: item.title,
    address: item.address,
    label: undefined,
    attraction,
  });
}

function mapsSearchUrl(name: string, address: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${name} ${address}`.trim())}`;
}

function appleSearchUrl(name: string, address: string) {
  return `http://maps.apple.com/?q=${encodeURIComponent(`${name}, ${address}`.trim())}`;
}

interface UrlTarget {
  latitude: number | undefined;
  longitude: number | undefined;
  name: string | undefined;
  address: string | undefined;
  label: string | undefined;
  attraction: Attraction | undefined;
}

function buildGoogleMapsUrl(target: UrlTarget) {
  const lat = target.latitude ?? target.attraction?.latitude;
  const lng = target.longitude ?? target.attraction?.longitude;
  const placeId = target.attraction?.providerPlaceId;
  if (lat != null && lng != null) {
    return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
  }
  if (placeId) {
    return `https://www.google.com/maps/search/?api=1&query=place_id:${placeId}`;
  }
  const q = target.name || target.label || "";
  const address = target.address || addressOf(target.attraction) || "";
  if (!q && !address) return undefined;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${q} ${address}`.trim())}`;
}

function buildAppleMapsUrl(target: UrlTarget) {
  const lat = target.latitude ?? target.attraction?.latitude;
  const lng = target.longitude ?? target.attraction?.longitude;
  const q = target.name || target.label || "";
  const address = target.address || addressOf(target.attraction) || "";
  if (lat != null && lng != null) {
    return `http://maps.apple.com/?ll=${lat},${lng}&q=${encodeURIComponent(q || "Destination")}`;
  }
  if (!q && !address) return undefined;
  return `http://maps.apple.com/?q=${encodeURIComponent(`${q}, ${address}`.trim())}`;
}

function commonRouteActivityUrl(state: KintripState, item: ItineraryItem) {
  return `${typeof window !== "undefined" ? window.location.origin : "https://commonroute.lovable.app"}/itinerary#${item.id}`;
}

function commonRouteBookingUrl(state: KintripState, booking: Booking) {
  return `${typeof window !== "undefined" ? window.location.origin : "https://commonroute.lovable.app"}/bookings#${booking.id}`;
}

/* ---------------- CSV ---------------- */

function neutralize(value: string) {
  // Defuse spreadsheet formula injection.
  const trimmed = value.trim();
  if (/^[\s]*[=@+\-\\].*/.test(trimmed)) {
    return `'${value}`;
  }
  return value;
}

function escapeCsv(value: unknown): string {
  if (value == null) return "";
  const text = String(value).replace(/\r?\n/g, "\\n").replace(/\r/g, "");
  const safe = neutralize(text);
  if (/[",\r\n]/.test(safe)) {
    return `"${safe.replace(/"/g, '""')}"`;
  }
  return safe;
}

function rowToCsv(row: string[]) {
  return row.map(escapeCsv).join(",") + "\r\n";
}

function myMapsHeaders(): string[] {
  return [
    "record_id",
    "activity_id",
    "place_id",
    "name",
    "latitude",
    "longitude",
    "address",
    "category",
    "point_role",
    "trip_name",
    "day_number",
    "date",
    "stop_order",
    "start_local",
    "end_local",
    "timezone",
    "planning_status",
    "booking_status",
    "access_summary",
    "hours_status",
    "google_maps_url",
    "apple_maps_url",
    "commonroute_url",
    "plan_revision",
    "schema_version",
    "exported_at_utc",
  ];
}

function readableHeaders(options: ExportOptions): string[] {
  const base = [
    "Day",
    "Date",
    "Start",
    "End",
    "Time zone",
    "Order",
    "Activity",
    "Type",
    "Address",
    "Booking status",
    "Travel mode",
    "Travel minutes",
    "Access instructions",
    "Hours status",
    "Plan revision",
    "Notes",
  ];
  const nav = options.navigationOutput ?? "both";
  if (nav === "coordinates" || nav === "both") {
    base.push("Latitude", "Longitude");
  }
  if (nav === "links" || nav === "both") {
    const providers: string[] = [];
    if (options.mapProvider !== "apple") providers.push("Google Maps URL");
    if (options.mapProvider !== "google") providers.push("Apple Maps URL");
    base.push(...providers);
  }
  base.push("CommonRoute URL");
  return base;
}

function generateMyMapsCsv(state: KintripState, options: ExportOptions): ExportResult {
  const { rows, omitted } = selectItems(state, options);
  if (rows.length > MAX_MYMAP_ROWS) {
    return errorResult(state, options, "My Maps import is limited to 2,000 rows. Try a smaller date range.", "csv");
  }
  const missingCoords = rows.filter((r) => r.latitude == null || r.longitude == null);
  if (missingCoords.length > 0) {
    return errorResult(
      state,
      options,
      `${missingCoords.length} record(s) lack coordinates. Either add locations or use the readable CSV format.`,
      "csv",
    );
  }

  const headers = myMapsHeaders();
  const revision = options.revision;
  const exportedAt = new Date().toISOString();
  let body = "\uFEFF";
  body += rowToCsv(headers);
  for (const row of rows) {
    body += rowToCsv([
      row.recordId,
      row.activityId ?? "",
      row.placeId ?? "",
      row.name,
      String(row.latitude ?? ""),
      String(row.longitude ?? ""),
      row.address ?? "",
      row.category,
      row.pointRole,
      row.tripName,
      String(row.dayNumber),
      row.date,
      String(row.stopOrder),
      row.start ?? "",
      row.end ?? "",
      row.timeZone ?? "",
      row.planningStatus,
      row.bookingStatus,
      row.accessSummary,
      row.hoursStatus,
      row.googleMapsUrl ?? "",
      row.appleMapsUrl ?? "",
      row.commonRouteUrl ?? "",
      String(revision),
      SCHEMA_VERSION,
      exportedAt,
    ]);
  }

  return {
    filename: filename(state, options, "csv"),
    mimeType: "text/csv; charset=utf-8",
    content: body,
    includedCount: rows.length,
    omitted,
    revision,
    generatedAt: exportedAt,
  };
}

function generateReadableCsv(state: KintripState, options: ExportOptions): ExportResult {
  const { rows, omitted } = selectItems(state, options);
  const headers = readableHeaders(options);
  const revision = options.revision;
  const exportedAt = new Date().toISOString();
  let body = "\uFEFF";
  body += rowToCsv(headers);
  const nav = options.navigationOutput ?? "both";
  for (const row of rows) {
    const base = [
      String(row.dayNumber),
      row.date,
      row.start ?? "",
      row.end ?? "",
      row.timeZone ?? "",
      String(row.stopOrder),
      row.name,
      row.category,
      row.address || "Coordinates unavailable",
      row.bookingStatus,
      row.travelMode ?? "",
      row.travelMinutes != null ? String(row.travelMinutes) : "",
      row.accessSummary || "",
      row.hoursStatus || "",
      String(revision),
      row.notes || "",
    ];
    if (nav === "coordinates" || nav === "both") {
      base.push(
        row.latitude != null ? String(row.latitude) : "",
        row.longitude != null ? String(row.longitude) : "",
      );
    }
    if (nav === "links" || nav === "both") {
      if (options.mapProvider !== "apple") base.push(row.googleMapsUrl ?? "Coordinates unavailable");
      if (options.mapProvider !== "google") base.push(row.appleMapsUrl ?? "Coordinates unavailable");
    }
    base.push(row.commonRouteUrl ?? "");
    body += rowToCsv(base);
  }

  return {
    filename: filename(state, options, "csv"),
    mimeType: "text/csv; charset=utf-8",
    content: body,
    includedCount: rows.length,
    omitted,
    revision,
    generatedAt: exportedAt,
  };
}

/* ---------------- ICS ---------------- */

function generateIcs(state: KintripState, options: ExportOptions): ExportResult {
  const { rows, omitted } = selectItems(state, options);
  const revision = options.revision;
  const exportedAt = new Date().toISOString();
  const lines: string[] = [];
  lines.push("BEGIN:VCALENDAR");
  lines.push("VERSION:2.0");
  lines.push("PRODID:-//CommonRoute//Export E1//EN");
  lines.push("CALSCALE:GREGORIAN");
  lines.push("METHOD:PUBLISH");

  for (const row of rows) {
    if (!row.start) continue;
    const uid = eventUid(state.trip.id, row.recordId, revision);
    const dtstamp = formatIcsDate(new Date(exportedAt));
    const dtstart = localToIcsUtc(row.date, row.start, row.timeZone);
    const dtend = localToIcsUtc(row.date, row.end || addMinutes(row.start, row.item?.durationMin ?? 30), row.timeZone);
    if (!dtstart || !dtend) {
      omitted.push({ name: row.name, reason: "Could not resolve event time to UTC" });
      continue;
    }

    const summary = row.planningStatus === "Booked" ? `✓ ${row.name}` : row.name;
    const description = icsDescription(row, options);

    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${uid}`);
    lines.push(`DTSTAMP:${dtstamp}`);
    lines.push(`DTSTART:${dtstart}`);
    lines.push(`DTEND:${dtend}`);
    lines.push(`SUMMARY:${foldLine(escapeIcsText(summary))}`);
    lines.push(`DESCRIPTION:${foldLine(escapeIcsText(description))}`);
    if (row.address) {
      lines.push(`LOCATION:${foldLine(escapeIcsText(row.address))}`);
    }
    lines.push(`STATUS:${row.planningStatus === "Booked" || row.planningStatus === "Locked" ? "CONFIRMED" : "TENTATIVE"}`);
    lines.push(`CATEGORIES:${foldLine(escapeIcsText(row.category))}`);
    lines.push(`URL:${foldLine(escapeIcsText(row.commonRouteUrl ?? ""))}`);
    lines.push(`SEQUENCE:${revision}`);
    if (options.alarmMinutes) {
      lines.push("BEGIN:VALARM");
      lines.push("ACTION:DISPLAY");
      lines.push(`DESCRIPTION:${foldLine(escapeIcsText(`Reminder: ${summary}`))}`);
      lines.push(`TRIGGER:-PT${options.alarmMinutes}M`);
      lines.push("END:VALARM");
    }
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");

  return {
    filename: filename(state, options, "ics"),
    mimeType: "text/calendar; charset=utf-8",
    content: lines.join("\r\n") + "\r\n",
    includedCount: rows.length,
    omitted,
    revision,
    generatedAt: exportedAt,
  };
}

function eventUid(tripId: string, recordId: string, revision: number) {
  return `${tripId}-${recordId}-r${revision}@commonroute.lovable.app`;
}

function icsDescription(row: ExportRow, options: ExportOptions) {
  const parts: string[] = [];
  parts.push(`Local time: ${row.start ?? "?"}–${row.end ?? "?"}`);
  if (row.timeZone) parts.push(`Time zone: ${row.timeZone}`);
  if (row.bookingStatus !== "Not booked") parts.push(`Booking: ${row.bookingStatus}`);
  if (row.accessSummary) parts.push(`Access: ${row.accessSummary}`);
  if (row.hoursStatus) parts.push(`Hours: ${row.hoursStatus}`);
  if (row.notes) parts.push(`Notes: ${row.notes}`);
  if (row.googleMapsUrl && options.mapProvider !== "apple") parts.push(`Google Maps: ${row.googleMapsUrl}`);
  if (row.appleMapsUrl && options.mapProvider !== "google") parts.push(`Apple Maps: ${row.appleMapsUrl}`);
  if (row.commonRouteUrl) parts.push(`CommonRoute: ${row.commonRouteUrl}`);
  parts.push(`Plan revision: ${options.revision}`);
  return parts.join("\\n");
}

function formatIcsDate(d: Date) {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z/, "Z");
}

function localToIcsUtc(date: string, time: string, timeZone: string | undefined): string | null {
  if (!timeZone) {
    // No zone: assume UTC and hope the consumer interprets it correctly.
    const d = new Date(`${date}T${time}:00Z`);
    if (Number.isNaN(d.getTime())) return null;
    return formatIcsDate(d);
  }
  try {
    const target = `${date}T${time}:00`;
    // Find the UTC instant that displays as target in the given zone.
    let guess = new Date(`${target}Z`).getTime();
    for (let i = 0; i < 5; i++) {
      const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      }).formatToParts(new Date(guess));
      const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
      const got = `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}:${get("second")}`;
      if (got === target) {
        return formatIcsDate(new Date(guess));
      }
      const diff = new Date(`${target}Z`).getTime() - new Date(`${got}Z`).getTime();
      guess += diff;
    }
    return null;
  } catch {
    return null;
  }
}

function escapeIcsText(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "");
}

function foldLine(line: string) {
  // RFC 5545 folding: 75 octets max per line. For UTF-8 safety keep well under.
  if (line.length <= 72) return line;
  const out: string[] = [];
  let i = 0;
  while (i < line.length) {
    out.push(line.slice(i, i + 72));
    i += 72;
  }
  return out.join("\r\n ");
}

/* ---------------- error handling ---------------- */

function errorResult(state: KintripState, options: ExportOptions, reason: string, format: ExportFormat): ExportResult {
  const exportedAt = new Date().toISOString();
  return {
    filename: filename(state, options, format === "csv" ? "csv" : "ics"),
    mimeType: format === "csv" ? "text/csv; charset=utf-8" : "text/calendar; charset=utf-8",
    content: format === "csv" ? "Error," + escapeCsv(reason) + "\r\n" : `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nEND:VCALENDAR\r\n`,
    includedCount: 0,
    omitted: [{ name: state.trip.title, reason }],
    revision: options.revision,
    generatedAt: exportedAt,
  };
}

/* ---------------- public API ---------------- */

export function generateExport(state: KintripState, options: ExportOptions): ExportResult {
  const revision = options.revision || state.itinerary?.version || 1;
  const opts = { ...options, revision };

  if (!state.itinerary) {
    return errorResult(state, opts, "There is no itinerary to export yet.", opts.format);
  }

  if (opts.format === "csv" && opts.csvPreset === "mymaps") {
    return generateMyMapsCsv(state, opts);
  }
  if (opts.format === "csv") {
    return generateReadableCsv(state, opts);
  }
  return generateIcs(state, opts);
}

export { buildGoogleMapsUrl, buildAppleMapsUrl };
