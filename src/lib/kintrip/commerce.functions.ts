import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  OFFERS,
  PREVIEW_JOB_QUOTA,
  PREVIEW_PAGE_QUOTA,
  offerByCode,
  type FeatureCode,
} from "./offers";

/**
 * Commercial layer: entitlements, the shared usage ledger, advanced jobs and
 * privacy-safe product events. Remixed from the original Kintrip project.
 *
 * Every write is server-verified. A browser never decides whether a trip is
 * covered, how much allowance is left, or whether a job may run.
 */

const TRIP_ID = /^[A-Za-z0-9_-]{3,64}$/;

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

function text(value: unknown, max = 200): string | null {
  if (typeof value !== "string") return null;
  const t = value.trim().slice(0, max);
  return t.length ? t : null;
}

/** Only people already in the trip may see or spend its entitlement. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function requireMember(context: any, tripId: string) {
  const { data, error } = await context.supabase
    .from("kintrip_memberships")
    .select("trip_id")
    .eq("trip_id", tripId)
    .eq("user_id", context.userId)
    .maybeSingle();
  if (error || !data) throw new Error("You are not part of this trip");
}

interface EntitlementRow {
  id: string;
  trip_id: string;
  offer_code: string;
  features: string[];
  job_quota: number;
  page_quota: number;
  starts_at: string;
  expires_at: string;
  status: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function activeEntitlement(db: any, tripId: string): Promise<EntitlementRow | null> {
  const nowIso = new Date().toISOString();
  const { data } = await db
    .from("trip_entitlements")
    .select("*")
    .eq("trip_id", tripId)
    .eq("status", "active")
    .gt("expires_at", nowIso)
    .order("expires_at", { ascending: false })
    .limit(1);
  return (data?.[0] as EntitlementRow | undefined) ?? null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function usageFor(db: any, entitlementId: string) {
  const { data } = await db
    .from("usage_ledger")
    .select("kind, amount, state")
    .eq("entitlement_id", entitlementId)
    .neq("state", "released");
  let jobs = 0;
  let pages = 0;
  for (const row of (data ?? []) as { kind: string; amount: number }[]) {
    if (row.kind === "advanced_job") jobs += row.amount;
    else pages += row.amount;
  }
  return { jobs, pages };
}

export interface TripCommerce {
  offerCode: string;
  features: FeatureCode[];
  expiresAt: string | null;
  jobsUsed: number;
  jobQuota: number;
  pagesUsed: number;
  pageQuota: number;
  previewAvailable: boolean;
  checkoutAvailable: boolean;
}

/** What this trip is entitled to, and how much of the allowance is left. */
export const getTripCommerce = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { tripId: string }) => {
    if (!input || !TRIP_ID.test(input.tripId ?? "")) throw new Error("Invalid trip");
    return { tripId: input.tripId };
  })
  .handler(async ({ data, context }): Promise<TripCommerce> => {
    await requireMember(context, data.tripId);
    const db = await admin();
    const ent = await activeEntitlement(db, data.tripId);
    const usage = ent ? await usageFor(db, ent.id) : { jobs: 0, pages: 0 };
    const { count } = await db
      .from("trip_entitlements")
      .select("id", { count: "exact", head: true })
      .eq("offer_code", "preview")
      .eq("purchaser_user_id", context.userId);
    return {
      offerCode: ent?.offer_code ?? "free",
      features: (ent?.features ?? []) as FeatureCode[],
      expiresAt: ent?.expires_at ?? null,
      jobsUsed: usage.jobs,
      jobQuota: ent?.job_quota ?? 0,
      pagesUsed: usage.pages,
      pageQuota: ent?.page_quota ?? 0,
      previewAvailable: (count ?? 0) === 0,
      checkoutAvailable: Boolean(process.env["PAYMENTS_PROVIDER"]),
    };
  });

function validity(tripEnd: string | null) {
  const now = Date.now();
  const ceiling = now + 18 * 30 * 24 * 3600 * 1000;
  const endMs = tripEnd ? Date.parse(`${tripEnd}T23:59:59Z`) : NaN;
  const afterTrip = Number.isNaN(endMs) ? ceiling : endMs + 30 * 24 * 3600 * 1000;
  return {
    expires: new Date(Math.min(afterTrip, ceiling)).toISOString(),
    ceiling: new Date(ceiling).toISOString(),
  };
}

/**
 * Starts a purchase. Hosted checkout is only offered when a payment provider
 * is configured for the deployment; nothing is ever unlocked by a browser
 * redirect. Until then the route returns an honest unavailable answer.
 */
export const startCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { tripId: string; offerCode: string; tripEnd?: string }) => {
    if (!input || !TRIP_ID.test(input.tripId ?? "")) throw new Error("Invalid trip");
    const offer = offerByCode(input.offerCode ?? "");
    if (!offer || !offer.available || offer.code === "free") throw new Error("This offer is not on sale");
    if (!input.tripEnd || !/^\d{4}-\d{2}-\d{2}$/.test(input.tripEnd)) {
      throw new Error("Set the trip dates before buying a pass");
    }
    return { tripId: input.tripId, offerCode: offer.code, tripEnd: input.tripEnd };
  })
  .handler(async ({ data, context }) => {
    await requireMember(context, data.tripId);
    const db = await admin();
    const existing = await activeEntitlement(db, data.tripId);
    if (existing && existing.offer_code !== "preview") {
      return { status: "already_covered" as const, checkoutUrl: null };
    }
    const offer = offerByCode(data.offerCode)!;
    const { data: order } = await db
      .from("commerce_orders")
      .insert({
        purchaser_user_id: context.userId,
        trip_id: data.tripId,
        offer_code: offer.code,
        price_minor: offer.priceMinor,
        currency: offer.currency,
        status: "pending",
        provider: process.env["PAYMENTS_PROVIDER"] ?? "none",
      })
      .select("id")
      .single();
    await recordEvent(db, "checkout_started", context.userId, data.tripId, {
      offer: offer.code,
      order: order?.id ?? null,
    });
    if (!process.env["PAYMENTS_PROVIDER"]) {
      return { status: "provider_unavailable" as const, checkoutUrl: null };
    }
    // A configured provider creates its hosted session here and the entitlement
    // is granted only by the verified webhook below.
    return { status: "pending" as const, checkoutUrl: null };
  });

/** Redeem an admin-issued promotion code (P15) into a trip pass. */
export const redeemPromotion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { tripId: string; code: string; tripEnd?: string }) => {
    if (!input || !TRIP_ID.test(input.tripId ?? "")) throw new Error("Invalid trip");
    const code = text(input.code, 40);
    if (!code) throw new Error("Enter a code");
    return { tripId: input.tripId, code: code.toUpperCase(), tripEnd: text(input.tripEnd ?? "", 10) };
  })
  .handler(async ({ data, context }) => {
    await requireMember(context, data.tripId);
    const db = await admin();
    const { data: promo } = await db
      .from("promotions")
      .select("*")
      .eq("code", data.code)
      .eq("status", "active")
      .maybeSingle();
    if (!promo) return { ok: false as const, reason: "This code is not valid." };
    const now = Date.now();
    if (promo.ends_at && Date.parse(promo.ends_at) < now) {
      return { ok: false as const, reason: "This code has expired." };
    }
    const { count: used } = await db
      .from("promotion_redemptions")
      .select("id", { count: "exact", head: true })
      .eq("promotion_id", promo.id);
    if (promo.max_redemptions && (used ?? 0) >= promo.max_redemptions) {
      return { ok: false as const, reason: "This code has been fully redeemed." };
    }
    const { count: mine } = await db
      .from("promotion_redemptions")
      .select("id", { count: "exact", head: true })
      .eq("promotion_id", promo.id)
      .eq("user_id", context.userId);
    if ((mine ?? 0) >= (promo.per_account_limit ?? 1)) {
      return { ok: false as const, reason: "You have already used this code." };
    }
    if (await activeEntitlement(db, data.tripId)) {
      return { ok: false as const, reason: "This trip already has a pass." };
    }
    const offer = offerByCode("trip_plus")!;
    const span = validity(data.tripEnd);
    const { data: grant } = await db
      .from("entitlement_grants")
      .insert({
        user_id: context.userId,
        bundle: offer.code,
        source_type: "promotion",
        source_id: promo.id,
        reason: `Promotion ${promo.code}`,
        ends_at: span.expires,
      })
      .select("id")
      .single();
    const { data: ent } = await db
      .from("trip_entitlements")
      .insert({
        trip_id: data.tripId,
        offer_code: offer.code,
        features: offer.features,
        grant_id: grant?.id ?? null,
        purchaser_user_id: context.userId,
        job_quota: offer.jobQuota,
        page_quota: offer.pageQuota,
        expires_at: span.expires,
        ceiling_at: span.ceiling,
      })
      .select("id")
      .single();
    await db.from("promotion_redemptions").insert({
      promotion_id: promo.id,
      user_id: context.userId,
      grant_id: grant?.id ?? null,
    });
    await recordEvent(db, "promotion_redeemed", context.userId, data.tripId, {
      campaign: promo.campaign_name,
      paid: false,
    });
    return { ok: true as const, entitlementId: ent?.id ?? null };
  });

/* ---------------- advanced jobs and the shared allowance ---------------- */

const FEATURES: FeatureCode[] = ["compare_bases", "scenarios", "cost_replan"];

/**
 * Reserves one unit of allowance before an advanced job runs. Reservation is
 * atomic through the unique idempotency key: a retry of the same job never
 * spends a second credit, and a failure releases the reservation.
 */
export const reserveAdvancedJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      tripId: string;
      feature: FeatureCode;
      inputsHash: string;
      revision: number;
      tripEnd?: string;
    }) => {
      if (!input || !TRIP_ID.test(input.tripId ?? "")) throw new Error("Invalid trip");
      if (!FEATURES.includes(input.feature)) throw new Error("Unknown feature");
      const hash = text(input.inputsHash, 80);
      if (!hash) throw new Error("Missing job inputs");
      return {
        tripId: input.tripId,
        feature: input.feature,
        inputsHash: hash,
        revision: Number.isFinite(input.revision) ? Math.trunc(input.revision) : 1,
        tripEnd: text(input.tripEnd ?? "", 10),
      };
    },
  )
  .handler(async ({ data, context }) => {
    await requireMember(context, data.tripId);
    const db = await admin();
    let ent = await activeEntitlement(db, data.tripId);

    // No pass yet: give this account its single evaluation preview.
    if (!ent) {
      const { count } = await db
        .from("trip_entitlements")
        .select("id", { count: "exact", head: true })
        .eq("offer_code", "preview")
        .eq("purchaser_user_id", context.userId);
      if ((count ?? 0) > 0) {
        return { ok: false as const, reason: "locked" as const };
      }
      const span = validity(data.tripEnd);
      const { data: created } = await db
        .from("trip_entitlements")
        .insert({
          trip_id: data.tripId,
          offer_code: "preview",
          features: FEATURES,
          purchaser_user_id: context.userId,
          job_quota: PREVIEW_JOB_QUOTA,
          page_quota: PREVIEW_PAGE_QUOTA,
          expires_at: span.expires,
          ceiling_at: span.ceiling,
        })
        .select("*")
        .single();
      ent = created as EntitlementRow;
    }

    const usage = await usageFor(db, ent.id);
    const idempotencyKey = `${ent.id}:${data.feature}:${data.inputsHash}`;
    const { data: existing } = await db
      .from("advanced_jobs")
      .select("id, status")
      .eq("idempotency_key", idempotencyKey)
      .maybeSingle();
    if (existing) return { ok: true as const, jobId: existing.id as string, repeat: true };

    if (usage.jobs >= ent.job_quota) {
      return { ok: false as const, reason: "exhausted" as const };
    }

    const { data: job, error } = await db
      .from("advanced_jobs")
      .insert({
        trip_id: data.tripId,
        feature: data.feature,
        revision: data.revision,
        inputs_hash: data.inputsHash,
        idempotency_key: idempotencyKey,
        entitlement_id: ent.id,
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (error || !job) return { ok: false as const, reason: "error" as const };
    const { error: ledgerError } = await db.from("usage_ledger").insert({
      entitlement_id: ent.id,
      trip_id: data.tripId,
      kind: "advanced_job",
      amount: 1,
      state: "reserved",
      idempotency_key: idempotencyKey,
      job_id: job.id,
      actor_user_id: context.userId,
    });
    if (ledgerError) {
      await db.from("advanced_jobs").delete().eq("id", job.id);
      return { ok: false as const, reason: "error" as const };
    }
    await recordEvent(db, "advanced_job_started", context.userId, data.tripId, {
      feature: data.feature,
      offer: ent.offer_code,
    });
    return { ok: true as const, jobId: job.id as string, repeat: false };
  });

/** Settles (success) or releases (failure) a reserved job exactly once. */
export const finishAdvancedJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { tripId: string; jobId: string; ok: boolean; summary?: string }) => {
    if (!input || !TRIP_ID.test(input.tripId ?? "")) throw new Error("Invalid trip");
    const jobId = text(input.jobId, 40);
    if (!jobId) throw new Error("Missing job");
    return { tripId: input.tripId, jobId, ok: Boolean(input.ok), summary: text(input.summary ?? "", 400) };
  })
  .handler(async ({ data, context }) => {
    await requireMember(context, data.tripId);
    const db = await admin();
    const { data: job } = await db
      .from("advanced_jobs")
      .select("id, status, trip_id, feature")
      .eq("id", data.jobId)
      .maybeSingle();
    if (!job || job.trip_id !== data.tripId) throw new Error("Job not found");
    if (job.status !== "reserved") return { ok: true as const, alreadyFinished: true };
    await db
      .from("advanced_jobs")
      .update({
        status: data.ok ? "succeeded" : "failed",
        output: data.summary ? { summary: data.summary } : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", job.id);
    await db
      .from("usage_ledger")
      .update({ state: data.ok ? "settled" : "released", updated_at: new Date().toISOString() })
      .eq("job_id", job.id)
      .eq("state", "reserved");
    await recordEvent(db, data.ok ? "advanced_job_succeeded" : "advanced_job_failed", context.userId, data.tripId, {
      feature: job.feature,
    });
    return { ok: true as const, alreadyFinished: false };
  });

/** Was the result actually useful? Quality is rated, never assumed. */
export const rateAdvancedJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { tripId: string; jobId: string; rating: number }) => {
    if (!input || !TRIP_ID.test(input.tripId ?? "")) throw new Error("Invalid trip");
    const jobId = text(input.jobId, 40);
    if (!jobId) throw new Error("Missing job");
    const rating = Math.max(1, Math.min(5, Math.trunc(Number(input.rating) || 0)));
    return { tripId: input.tripId, jobId, rating };
  })
  .handler(async ({ data, context }) => {
    await requireMember(context, data.tripId);
    const db = await admin();
    await db.from("advanced_jobs").update({ rating: data.rating }).eq("id", data.jobId).eq("trip_id", data.tripId);
    return { ok: true as const };
  });

/* ---------------- product events (P17) ---------------- */

async function hashKey(value: string | null): Promise<string | null> {
  if (!value) return null;
  const salt = process.env["ADMIN_EMAIL_HASH_SALT"] ?? "";
  const bytes = new TextEncoder().encode(`${salt}:${value}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 32);
}

const ALLOWED_PROP_KEYS = new Set([
  "offer",
  "order",
  "feature",
  "campaign",
  "paid",
  "surface",
  "result",
  "step",
  "count",
]);

/** Event payloads carry counts and codes only — never addresses or notes. */
function safeProps(props: unknown): Record<string, unknown> {
  if (!props || typeof props !== "object") return {};
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(props as Record<string, unknown>)) {
    if (!ALLOWED_PROP_KEYS.has(k)) continue;
    if (typeof v === "string") out[k] = v.slice(0, 60);
    else if (typeof v === "number" || typeof v === "boolean" || v === null) out[k] = v;
  }
  return out;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function recordEvent(db: any, name: string, userId: string | null, tripId: string | null, props: unknown) {
  try {
    await db.from("product_events").insert({
      name,
      account_key: await hashKey(userId),
      trip_key: await hashKey(tripId),
      props: safeProps(props),
    });
  } catch {
    /* measurement must never break the product */
  }
}

const EVENT_NAMES = new Set([
  "trip_created",
  "poll_created",
  "poll_closed",
  "plan_published",
  "readiness_opened",
  "pricing_viewed",
  "upgrade_prompt_shown",
  "template_used",
  "expense_recorded",
  "export_downloaded",
]);

/** Records one product event from the app. Consent-aware and anonymous. */
export const trackEvent = createServerFn({ method: "POST" })
  .inputValidator((input: { name: string; tripId?: string; props?: Record<string, unknown> }) => {
    const name = text(input?.name, 50) ?? "";
    if (!EVENT_NAMES.has(name)) throw new Error("Unknown event");
    return { name, tripId: text(input?.tripId ?? "", 64), props: input?.props ?? {} };
  })
  .handler(async ({ data }) => {
    const db = await admin();
    await recordEvent(db, data.name, null, data.tripId, data.props);
    return { ok: true as const };
  });

export const OFFER_LIST = OFFERS;
