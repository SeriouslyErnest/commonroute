import { getRequest } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";

/**
 * Small server-side guards for the open map endpoints. Place search and driving
 * routes are reachable without a trip, so they need their own protection: the
 * billable Google provider requires a signed-in caller, and every caller is
 * rate limited per instance so a script cannot burn quota in a loop.
 */

function callerKey(): string {
  const request = getRequest();
  const headers = request?.headers;
  const ip =
    headers?.get("cf-connecting-ip") ??
    headers?.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    headers?.get("x-real-ip") ??
    "unknown";
  return ip;
}

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

/** Throws when the caller has exceeded `limit` calls in `windowMs`. */
export function enforceRateLimit(scope: string, limit: number, windowMs: number) {
  const key = `${scope}:${callerKey()}`;
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
  } else if (bucket.count >= limit) {
    throw new Error("Too many searches in a short time. Please wait a moment and try again.");
  } else {
    bucket.count += 1;
  }
  if (buckets.size > 5000) {
    for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
  }
}

/** Throws unless the request carries a valid signed-in session token. */
export async function requireSignedIn(): Promise<string> {
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key) throw new Error("Sign-in is not available right now.");

  const authHeader = getRequest()?.headers?.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token || token.split(".").length !== 3) {
    throw new Error("Please sign in to use Google Maps search.");
  }

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase.auth.getClaims(token);
  if (error || !data?.claims?.sub) {
    throw new Error("Please sign in to use Google Maps search.");
  }
  return data.claims.sub;
}
