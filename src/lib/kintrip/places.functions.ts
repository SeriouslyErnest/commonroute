import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_maps";

export type PlaceProvider = "free" | "google";

export interface PlaceResult {
  placeId: string;
  name: string;
  address: string;
  mapsUrl: string;
  provider: PlaceProvider;
  latitude?: number | undefined;
  longitude?: number | undefined;
}

const inputSchema = z.object({
  query: z.string().trim().min(2).max(120),
  destination: z.string().trim().min(2).max(120),
  provider: z.enum(["free", "google"]).default("free"),
});

const googleMapsLink = (name: string, address: string, lat?: number, lon?: number) =>
  lat !== undefined && lon !== undefined
    ? `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${name} ${address}`)}`;

async function searchGoogle(query: string, destination: string): Promise<PlaceResult[]> {
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const connectionKey = process.env["GOOGLE_MAPS_API_KEY"];
  if (!lovableKey || !connectionKey) {
    throw new Error("Google Maps connection is not configured.");
  }

  const response = await fetch(`${GATEWAY_URL}/places/v1/places:searchText`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${lovableKey}`,
      "X-Connection-Api-Key": connectionKey,
      "Content-Type": "application/json",
      "X-Goog-FieldMask":
        "places.id,places.displayName,places.formattedAddress,places.googleMapsUri,places.location",
    },
    body: JSON.stringify({ textQuery: `${query} in ${destination}`, pageSize: 8 }),
  });

  if (response.status === 403) {
    const details: Array<{ reason?: string }> =
      (await response.json().catch(() => ({})))?.error?.details ?? [];
    const reason = details.find((d) => d.reason)?.reason;
    if (reason === "API_KEY_HTTP_REFERRER_BLOCKED") {
      throw new Error(
        'Google Maps server key is referrer-restricted. In Google Cloud Console, set the server key\'s application restrictions to "None" or "IP addresses".',
      );
    }
    if (reason === "API_KEY_SERVICE_BLOCKED") {
      throw new Error(
        "Google Maps server key does not allow the Places API. In Google Cloud Console, add Places API (New) to the server key's allowed-APIs list.",
      );
    }
    throw new Error(
      "Google Maps request was denied (403). Check the server key's restrictions in Google Cloud Console.",
    );
  }
  if (!response.ok) {
    const errorBody = await response.text();
    console.error(`Places search failed [${response.status}]: ${errorBody}`);
    throw new Error(`Google Maps search failed (${response.status}). Try again in a moment.`);
  }

  const payload = (await response.json()) as {
    places?: Array<{
      id?: string;
      displayName?: { text?: string };
      formattedAddress?: string;
      googleMapsUri?: string;
      location?: { latitude?: number; longitude?: number };
    }>;
  };

  return (payload.places ?? [])
    .filter((p) => p.id && p.displayName?.text)
    .map((p) => ({
      placeId: p.id!,
      name: p.displayName!.text!,
      address: p.formattedAddress ?? "",
      mapsUrl: p.googleMapsUri ?? googleMapsLink(p.displayName!.text!, p.formattedAddress ?? ""),
      provider: "google" as const,
      latitude: p.location?.latitude,
      longitude: p.location?.longitude,
    }));
}

/**
 * Free/open provider.
 * Uses Geoapify when GEOAPIFY_API_KEY is set, otherwise falls back to
 * OpenStreetMap Nominatim (no key required).
 */
async function searchFree(query: string, destination: string): Promise<PlaceResult[]> {
  const text = `${query} in ${destination}`;
  const geoapifyKey = process.env["GEOAPIFY_API_KEY"];

  if (geoapifyKey) {
    const params = new URLSearchParams({
      text,
      format: "json",
      limit: "8",
      lang: "en",
      apiKey: geoapifyKey,
    });
    const res = await fetch(`https://api.geoapify.com/v1/geocode/search?${params.toString()}`, {
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      const body = await res.text();
      console.error(`Geoapify search failed [${res.status}]: ${body}`);
      throw new Error(`Place search failed (${res.status}). Try again in a moment.`);
    }
    const payload = (await res.json()) as {
      results?: Array<{
        place_id?: string;
        name?: string;
        address_line1?: string;
        formatted?: string;
        lat?: number;
        lon?: number;
      }>;
    };
    return (payload.results ?? [])
      .map((r, i) => {
        const name = r.name || r.address_line1 || r.formatted || "";
        const address = r.formatted ?? "";
        if (!name) return null;
        return {
          placeId: r.place_id ?? `geoapify-${i}-${name}`,
          name,
          address,
          mapsUrl: googleMapsLink(name, address, r.lat, r.lon),
          provider: "free" as const,
          latitude: r.lat,
          longitude: r.lon,
        };
      })
      .filter((r): r is PlaceResult => r !== null);
  }

  const params = new URLSearchParams({
    q: text,
    format: "jsonv2",
    limit: "8",
    addressdetails: "1",
  });
  const res = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, {
    headers: {
      "User-Agent": "Kintrip/1.0 (family trip planner)",
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) {
    const body = await res.text();
    console.error(`Nominatim search failed [${res.status}]: ${body}`);
    throw new Error(`Place search failed (${res.status}). Try again in a moment.`);
  }
  const payload = (await res.json()) as Array<{
    place_id?: number;
    name?: string;
    display_name?: string;
    lat?: string;
    lon?: string;
  }>;
  return payload
    .map((r, i) => {
      const display = r.display_name ?? "";
      const name = r.name || display.split(",")[0]?.trim() || "";
      if (!name) return null;
      const address = display;
      const lat = r.lat ? Number(r.lat) : undefined;
      const lon = r.lon ? Number(r.lon) : undefined;
      return {
        placeId: String(r.place_id ?? `osm-${i}-${name}`),
        name,
        address,
        mapsUrl: googleMapsLink(name, address, lat, lon),
        provider: "free" as const,
        latitude: lat,
        longitude: lon,
      };
    })
    .filter((r): r is PlaceResult => r !== null);
}

export const searchPlaces = createServerFn({ method: "GET" })
  .inputValidator((data) => inputSchema.parse(data))
  .handler(async ({ data }): Promise<PlaceResult[]> =>
    data.provider === "google"
      ? searchGoogle(data.query, data.destination)
      : searchFree(data.query, data.destination),
  );
