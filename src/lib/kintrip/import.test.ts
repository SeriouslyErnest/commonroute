import { describe, expect, test } from "bun:test";
import {
  beyondAllReferences,
  beyondDestination,
  findImportDuplicates,
  parseGoogleMapsUrl,
  parseMyMapsCsv,
  parseQuickPaste,
  parseTakeoutJson,
  QUICK_PASTE_LIMIT,
} from "./import";

describe("Google Maps link parsing", () => {
  test("reads the place name, coordinates and provider id without a lookup", () => {
    const parsed = parseGoogleMapsUrl(
      "https://www.google.com/maps/place/Fushimi+Inari+Taisha/@34.9671402,135.7726717,17z/data=!4m6!3m5!1s0x60010f0b6c2f3f3d:0xabcdef?query_place_id=ChIJ123",
    );
    expect(parsed?.name).toBe("Fushimi Inari Taisha");
    expect(parsed?.latitude).toBe(34.9671402);
    expect(parsed?.longitude).toBe(135.7726717);
    expect(parsed?.providerPlaceId).toBe("ChIJ123");
  });

  test("reads a Maps search URL", () => {
    const parsed = parseGoogleMapsUrl(
      "https://www.google.com/maps/search/?api=1&query=Nishiki+Market",
    );
    expect(parsed?.name).toBe("Nishiki Market");
    expect(parsed?.latitude).toBeUndefined();
  });
});

describe("quick paste", () => {
  test("accepts plain names and a label beside a link", () => {
    const parsed = parseQuickPaste("Kinkaku-ji\nNishiki Market https://maps.app.goo.gl/abc123");
    expect(parsed.items).toHaveLength(2);
    expect(parsed.items[0]?.name).toBe("Kinkaku-ji");
    expect(parsed.items[1]?.name).toBe("Nishiki Market");
    expect(parsed.items[1]?.sourceUrl).toBe("https://maps.app.goo.gl/abc123");
    expect(new Set(parsed.items.map((item) => item.key)).size).toBe(2);
  });

  test("identical rows still get separate review keys", () => {
    const parsed = parseQuickPaste("Nishiki Market\nNishiki Market");
    expect(new Set(parsed.items.map((item) => item.key)).size).toBe(2);
  });

  test("keeps only the first 25 entries and says so", () => {
    const parsed = parseQuickPaste(
      Array.from({ length: 26 }, (_, index) => `Place ${index + 1}`).join("\n"),
    );
    expect(parsed.items).toHaveLength(QUICK_PASTE_LIMIT);
    expect(parsed.warnings[0]).toContain("25");
  });
});

describe("file imports", () => {
  test("parses quoted My Maps CSV and WKT as longitude then latitude", () => {
    const parsed = parseMyMapsCsv(
      'Name,Description,WKT,Address\n"Nishiki, Market","Grandma\'s ""favourite""","POINT (135.0049 35.0050)","Kyoto, Japan"',
    );
    expect(parsed.items[0]?.name).toBe("Nishiki, Market");
    expect(parsed.items[0]?.note).toBe('Grandma\'s "favourite"');
    expect(parsed.items[0]?.latitude).toBe(35.005);
    expect(parsed.items[0]?.longitude).toBe(135.0049);
    expect(parsed.items[0]?.address).toBe("Kyoto, Japan");
  });

  test("parses Google Takeout GeoJSON", () => {
    const parsed = parseTakeoutJson(
      JSON.stringify({
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            geometry: { type: "Point", coordinates: [135.7727, 34.9671] },
            properties: {
              Title: "Fushimi Inari",
              Address: "Kyoto",
              Comment: "Go early",
              "Google Maps URL": "https://www.google.com/maps/search/?api=1&query=Fushimi+Inari",
            },
          },
        ],
      }),
    );
    expect(parsed.items[0]?.name).toBe("Fushimi Inari");
    expect(parsed.items[0]?.latitude).toBe(34.9671);
    expect(parsed.items[0]?.longitude).toBe(135.7727);
    expect(parsed.items[0]?.note).toBe("Go early");
  });
});

describe("review safeguards", () => {
  const base = { sourceUrl: "", providerPlaceId: undefined, latitude: 35, longitude: 135 };
  test("flags provider-id duplicates and within-batch name duplicates", () => {
    const duplicates = findImportDuplicates(
      [
        { ...base, name: "Nishiki Market" },
        { ...base, name: "Nishiki Market" },
      ],
      [{ ...base, name: "Different", providerPlaceId: "same" }],
    );
    expect(duplicates[1]).toBe("Nishiki Market");
    const provider = findImportDuplicates(
      [{ ...base, name: "Another", providerPlaceId: "same" }],
      [{ ...base, name: "Different", providerPlaceId: "same" }],
    );
    expect(provider[0]).toBe("Different");
  });

  test("does not call distant same-name places duplicates", () => {
    const duplicates = findImportDuplicates(
      [{ name: "Central Park", sourceUrl: "", latitude: 35, longitude: 135 }],
      [{ name: "Central Park", sourceUrl: "", latitude: 40.78, longitude: -73.96 }],
    );
    expect(duplicates[0]).toBeUndefined();
  });

  test("100 km filter excludes known distant points but keeps unknown distances", () => {
    const centre = { latitude: 35, longitude: 135 };
    expect(beyondDestination({ latitude: 36.2, longitude: 135 }, centre)).toBe(true);
    expect(beyondDestination({ latitude: 35.1, longitude: 135 }, centre)).toBe(false);
    expect(beyondDestination({}, centre)).toBe(false);
    expect(beyondDestination({ latitude: 40, longitude: 140 }, null)).toBe(false);
    const tokyoAndKyoto = [
      { latitude: 35.68, longitude: 139.69 },
      { latitude: 35.01, longitude: 135.76 },
    ];
    expect(beyondAllReferences({ latitude: 35.005, longitude: 135.0049 }, tokyoAndKyoto)).toBe(
      false,
    );
    expect(beyondAllReferences({ latitude: 51.5072, longitude: -0.1276 }, tokyoAndKyoto)).toBe(
      true,
    );
  });
});
