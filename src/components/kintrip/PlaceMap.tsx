import { useEffect, useRef } from "react";
import { centreOf, hasCoords } from "@/lib/kintrip/geo";
import type { Attraction } from "@/lib/kintrip/types";

export interface MapPlace {
  place: Attraction;
  /** Shown in the pin so meaning never depends on colour alone. */
  glyph: string;
  tone: string;
  label: string;
}

/**
 * A plain OpenStreetMap view of the shortlisted places. Loaded only in the
 * browser: if tiles fail, the surrounding list view carries on working.
 */
export function PlaceMap({ places, height = 360 }: { places: MapPlace[]; height?: number }) {
  const container = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<{ remove: () => void } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const located = places.filter((p) => hasCoords(p.place));
    if (!container.current || located.length === 0) return;

    (async () => {
      const maplibre = await import("maplibre-gl");
      await import("maplibre-gl/dist/maplibre-gl.css");
      if (cancelled || !container.current) return;

      const centre = centreOf(located.map((p) => p.place))!;
      const map = new maplibre.Map({
        container: container.current,
        style: {
          version: 8,
          sources: {
            osm: {
              type: "raster",
              tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
              tileSize: 256,
              attribution: "© OpenStreetMap contributors",
            },
          },
          layers: [{ id: "osm", type: "raster", source: "osm" }],
        },
        center: [centre.lng, centre.lat],
        zoom: 11,
        attributionControl: { compact: true },
      });
      mapRef.current = map;
      map.addControl(new maplibre.NavigationControl({ showCompass: false }), "top-right");

      const bounds = new maplibre.LngLatBounds();
      for (const entry of located) {
        const el = document.createElement("div");
        el.className = "cr-pin";
        el.style.background = entry.tone;
        el.textContent = entry.glyph;
        el.setAttribute("role", "img");
        el.setAttribute("aria-label", `${entry.place.name} — ${entry.label}`);
        new maplibre.Marker({ element: el })
          .setLngLat([entry.place.longitude!, entry.place.latitude!])
          .setPopup(
            new maplibre.Popup({ offset: 18 }).setText(`${entry.place.name} — ${entry.label}`),
          )
          .addTo(map);
        bounds.extend([entry.place.longitude!, entry.place.latitude!]);
      }
      if (located.length > 1) map.fitBounds(bounds, { padding: 48, maxZoom: 14 });
    })();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [places]);

  if (places.filter((p) => hasCoords(p.place)).length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        None of these places has a location saved yet, so there is nothing to show on the map.
      </p>
    );
  }

  return (
    <div
      ref={container}
      style={{ height }}
      className="w-full overflow-hidden rounded-xl border border-border"
      aria-label="Map of shortlisted places"
    />
  );
}
