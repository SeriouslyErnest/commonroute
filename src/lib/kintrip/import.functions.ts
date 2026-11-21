import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const inputSchema = z.object({
  urls: z.array(z.string().trim().min(1).max(2048)).min(1).max(10),
});

function allowedGoogleHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return host === "maps.app.goo.gl" || /(^|\.)google\.[a-z.]+$/.test(host);
}

/**
 * Expand only Google's short Maps links. Redirect targets are restricted to
 * Google hosts so this cannot become a general-purpose URL fetch proxy.
 */
async function expandShortLink(
  source: string,
): Promise<{ source: string; finalUrl: string | null; error: string | null }> {
  let current: URL;
  try {
    current = new URL(source);
    if (current.protocol !== "https:" || current.hostname.toLowerCase() !== "maps.app.goo.gl") {
      return {
        source,
        finalUrl: null,
        error: "Only https://maps.app.goo.gl short links can be expanded.",
      };
    }
  } catch {
    return { source, finalUrl: null, error: "This short link is not a valid URL." };
  }

  try {
    for (let step = 0; step < 4; step += 1) {
      const response = await fetch(current, {
        method: "GET",
        redirect: "manual",
        signal: AbortSignal.timeout(8000),
        headers: { Accept: "text/html", "User-Agent": "CommonRoute/1.0" },
      });
      if (response.status < 300 || response.status >= 400) {
        return {
          source,
          finalUrl: null,
          error: "The short link did not redirect to a Google Maps place.",
        };
      }
      const location = response.headers.get("location");
      if (!location)
        return { source, finalUrl: null, error: "The short link returned no destination." };
      const next = new URL(location, current);
      if (next.protocol !== "https:" || !allowedGoogleHost(next.hostname)) {
        return {
          source,
          finalUrl: null,
          error: "The short link redirected outside Google Maps, so it was not followed.",
        };
      }
      current = next;
    }
    return { source, finalUrl: current.toString(), error: null };
  } catch {
    return {
      source,
      finalUrl: null,
      error: "The short link could not be opened. The original link can still be saved.",
    };
  }
}

export const expandGoogleMapsLinks = createServerFn({ method: "POST" })
  .inputValidator((data) => inputSchema.parse(data))
  .handler(async ({ data }) => {
    const { enforceRateLimit } = await import("./guard.server");
    enforceRateLimit("map-link-expand", 10, 60_000);
    const results: Array<{ source: string; finalUrl: string | null; error: string | null }> = [];
    // Sequential and bounded: no fan-out and no arbitrary remote URL fetching.
    for (const source of data.urls) results.push(await expandShortLink(source));
    return { results };
  });
