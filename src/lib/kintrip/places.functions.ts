import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_maps";

export interface PlaceResult {
  placeId: string;
  name: string;
  address: string;
  mapsUrl: string;
}

const inputSchema = z.object({
  query: z.string().trim().min(2).max(120),
  destination: z.string().trim().min(2).max(120),
});

export const searchPlaces = createServerFn({ method: "GET" })
  .inputValidator((data) => inputSchema.parse(data))
  .handler(async ({ data }): Promise<PlaceResult[]> => {
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
          "places.id,places.displayName,places.formattedAddress,places.googleMapsUri",
      },
      body: JSON.stringify({
        textQuery: `${data.query} in ${data.destination}`,
        pageSize: 8,
      }),
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
      }>;
    };

    return (payload.places ?? [])
      .filter((p) => p.id && p.displayName?.text)
      .map((p) => ({
        placeId: p.id!,
        name: p.displayName!.text!,
        address: p.formattedAddress ?? "",
        mapsUrl:
          p.googleMapsUri ??
          `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
            `${p.displayName!.text!} ${p.formattedAddress ?? ""}`,
          )}`,
      }));
  });
