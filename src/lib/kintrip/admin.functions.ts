import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Admin console (internal operations).
 *
 * The console can review accounts, pause or restore access, and record
 * time-bounded entitlement grants. It never reads or edits the trip content a
 * group owns, and every change writes an audit entry before returning success.
 */

export type AdminRole = "super_admin" | "billing_admin" | "support_admin" | "read_only_admin";

const WRITE_ROLES: AdminRole[] = ["super_admin", "billing_admin", "support_admin"];
const COMMERCIAL_ROLES: AdminRole[] = ["super_admin", "billing_admin"];
const OWNER_ROLES: AdminRole[] = ["super_admin"];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The console lives at a configurable, unlisted path. Forks set
 * ADMIN_CONSOLE_PATH to their own address; without it the console is served
 * at the documented default /admin/admin. The path itself is not the
 * protection — every action still requires an authenticated operator — it is
 * only an extra layer of obscurity.
 */
export function configuredAdminPath(): string {
  const raw = process.env["ADMIN_CONSOLE_PATH"] ?? "/admin/admin";
  const cleaned = `/${raw.replace(/^\/+|\/+$/g, "")}`;
  return cleaned === "/" ? "/admin/admin" : cleaned;
}

export const adminConsoleAccess = createServerFn({ method: "GET" })
  .inputValidator((path: unknown) => {
    if (typeof path !== "string" || !path.startsWith("/") || path.length > 120) {
      throw new Error("Invalid path");
    }
    return `/${path.replace(/^\/+|\/+$/g, "")}`;
  })
  .handler(({ data }) => ({ allowed: data === configuredAdminPath() }));

function text(value: unknown, max = 300): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().slice(0, max);
  return trimmed.length ? trimmed : null;
}

async function adminClient() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/**
 * Audit rows never store an operator's address in readable form. We keep a
 * one-way salted fingerprint so the same operator can be correlated across
 * entries, while nobody with database (or code) access can read the address
 * back out of the table. Display names are resolved live from the account id.
 */
async function emailFingerprint(email: string | null): Promise<string | null> {
  if (!email) return null;
  const salt = process.env["ADMIN_EMAIL_HASH_SALT"] ?? "";
  const bytes = new TextEncoder().encode(`${salt}:${email.trim().toLowerCase()}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return `sha256:${Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")}`;
}

/** Resolves readable operator addresses for display only, keyed by account id. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function operatorEmails(admin: any): Promise<Map<string, string | null>> {
  const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new Map((data?.users ?? []).map((u: any) => [u.id as string, (u.email as string | null) ?? null]));
}

/** Resolves the caller's admin role, creating the first super admin when the configured owner signs in. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function resolveRole(context: any): Promise<{ role: AdminRole | null; email: string | null }> {
  const email = typeof context.claims["email"] === "string" ? (context.claims["email"] as string) : null;
  // Role lookup runs server-side with the privileged client so the operator
  // table is never queryable (or probe-able) from a browser session.
  const lookup = await adminClient();
  const { data } = await lookup
    .from("app_admins")
    .select("admin_role")
    .eq("user_id", context.userId)
    .eq("status", "active")
    .maybeSingle();
  if (data?.admin_role) return { role: data.admin_role as AdminRole, email };

  const bootstrap = process.env["ADMIN_BOOTSTRAP_EMAIL"];
  if (bootstrap && email && bootstrap.trim().toLowerCase() === email.toLowerCase()) {
    const admin = await adminClient();
    await admin.from("app_admins").upsert(
      { user_id: context.userId, admin_role: "super_admin", status: "active" },
      { onConflict: "user_id" },
    );
    await admin.from("admin_audit_log").insert({
      admin_user_id: context.userId,
      admin_email: await emailFingerprint(email),
      action_type: "admin.bootstrap",
      target_type: "admin",
      target_id: context.userId,
      after_json: { admin_role: "super_admin" },
      reason: "Configured owner signed in",
    });
    return { role: "super_admin", email };
  }
  return { role: null, email };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function requireAdmin(context: any, allowed: AdminRole[] = WRITE_ROLES) {
  const { role, email } = await resolveRole(context);
  if (!role) throw new Error("Not found");
  if (!allowed.includes(role)) throw new Error("You do not have permission for this action");
  return { role, email, admin: await adminClient() };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function audit(admin: any, entry: Record<string, unknown>) {
  await admin.from("admin_audit_log").insert(entry);
}

/** Who am I, as far as the console is concerned? Used to gate the whole console. */
export const adminSession = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { role, email } = await resolveRole(context);
    return { role, email, isAdmin: Boolean(role) };
  });

export const adminDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { admin } = await requireAdmin(context, [...WRITE_ROLES, "read_only_admin"]);
    const nowIso = new Date().toISOString();
    const soon = new Date(Date.now() + 7 * 864e5).toISOString();

    const [{ data: users }, grants, suspended, promos, recent] = await Promise.all([
      admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
      admin.from("entitlement_grants").select("id, ends_at, source_type").eq("status", "active"),
      admin.from("account_status").select("user_id").eq("state", "suspended"),
      admin.from("promotions").select("id, status"),
      admin
        .from("admin_audit_log")
        .select("id, admin_user_id, action_type, target_type, target_id, reason, created_at")
        .order("created_at", { ascending: false })
        .limit(10),
    ]);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const emailOf = new Map((users?.users ?? []).map((u: any) => [u.id as string, (u.email as string | null) ?? null]));
    const active = grants.data ?? [];
    return {
      accounts: users?.users?.length ?? 0,
      suspended: suspended.data?.length ?? 0,
      activeGrants: active.filter((g) => !g.ends_at || g.ends_at > nowIso).length,
      expiringSoon: active.filter((g) => g.ends_at && g.ends_at > nowIso && g.ends_at < soon).length,
      trials: active.filter((g) => g.source_type === "trial").length,
      activePromotions: (promos.data ?? []).filter((p) => p.status === "active").length,
      recent: (recent.data ?? []).map((r) => ({
        id: r.id,
        actor: (r.admin_user_id ? emailOf.get(r.admin_user_id) : null) ?? "Removed operator",
        action: r.action_type,
        target: r.target_id,
        reason: r.reason,
        at: r.created_at,
      })),
    };
  });

export const adminSearchAccounts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { query?: string }) => ({ query: text(input?.query, 120) ?? "" }))
  .handler(async ({ data, context }) => {
    const { admin } = await requireAdmin(context, [...WRITE_ROLES, "read_only_admin"]);
    const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const q = data.query.toLowerCase();
    const users = (list?.users ?? [])
      .filter((u) => !q || (u.email ?? "").toLowerCase().includes(q) || u.id.toLowerCase() === q)
      .slice(0, 50);
    const ids = users.map((u) => u.id);
    const [{ data: states }, { data: profiles }] = await Promise.all([
      admin.from("account_status").select("user_id, state").in("user_id", ids.length ? ids : ["-"]),
      admin.from("profiles").select("id, display_name").in("id", ids.length ? ids : ["-"]),
    ]);
    const stateOf = new Map((states ?? []).map((s) => [s.user_id, s.state]));
    const nameOf = new Map((profiles ?? []).map((p) => [p.id, p.display_name]));
    return users.map((u) => ({
      id: u.id,
      email: u.email ?? null,
      displayName: nameOf.get(u.id) ?? null,
      createdAt: u.created_at,
      lastSignInAt: u.last_sign_in_at ?? null,
      state: (stateOf.get(u.id) ?? "active") as "active" | "suspended",
    }));
  });

export const adminAccountDetail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string }) => {
    if (!UUID.test(String(input?.userId))) throw new Error("Invalid account");
    return { userId: input.userId };
  })
  .handler(async ({ data, context }) => {
    const { admin } = await requireAdmin(context, [...WRITE_ROLES, "read_only_admin"]);
    const [{ data: user }, status, profile, grants, trips] = await Promise.all([
      admin.auth.admin.getUserById(data.userId),
      admin.from("account_status").select("state, reason, changed_at").eq("user_id", data.userId).maybeSingle(),
      admin.from("profiles").select("display_name, email").eq("id", data.userId).maybeSingle(),
      admin
        .from("entitlement_grants")
        .select("id, bundle, source_type, starts_at, ends_at, status, reason, created_at")
        .eq("user_id", data.userId)
        .order("created_at", { ascending: false }),
      admin.from("kintrip_memberships").select("trip_id, title, destination, updated_at").eq("user_id", data.userId),
    ]);
    if (!user?.user) throw new Error("Account not found");
    const now = new Date().toISOString();
    const rows = grants.data ?? [];
    const effective = rows.filter((g) => g.status === "active" && g.starts_at <= now && (!g.ends_at || g.ends_at > now));
    const order = ["paid_subscription", "complimentary", "promotion", "trial"];
    effective.sort((a, b) => order.indexOf(a.source_type) - order.indexOf(b.source_type));
    return {
      id: user.user.id,
      email: user.user.email ?? null,
      displayName: profile.data?.display_name ?? null,
      createdAt: user.user.created_at,
      lastSignInAt: user.user.last_sign_in_at ?? null,
      state: (status.data?.state ?? "active") as "active" | "suspended",
      stateReason: status.data?.reason ?? null,
      stateChangedAt: status.data?.changed_at ?? null,
      grants: rows.map((g) => ({
        id: g.id,
        bundle: g.bundle,
        source: g.source_type,
        startsAt: g.starts_at,
        endsAt: g.ends_at,
        status: g.status,
        reason: g.reason,
      })),
      effectiveBundle: effective[0]?.bundle ?? "free",
      effectiveSource: effective[0]?.source_type ?? "default_free",
      overlapping: effective.length > 1,
      trips: (trips.data ?? []).map((t) => ({
        tripId: t.trip_id,
        title: t.title,
        destination: t.destination,
        updatedAt: t.updated_at,
      })),
    };
  });

export const adminSetAccountState = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string; state: "active" | "suspended"; reason: string }) => {
    if (!UUID.test(String(input?.userId))) throw new Error("Invalid account");
    if (input.state !== "active" && input.state !== "suspended") throw new Error("Invalid state");
    const reason = text(input?.reason);
    if (!reason) throw new Error("Please give a reason — it is recorded in the audit log");
    return { userId: input.userId, state: input.state, reason };
  })
  .handler(async ({ data, context }) => {
    const { admin, email } = await requireAdmin(context, OWNER_ROLES);
    if (data.userId === context.userId) throw new Error("You cannot change your own account state");
    const { data: before } = await admin
      .from("account_status")
      .select("state, reason")
      .eq("user_id", data.userId)
      .maybeSingle();
    const { error } = await admin.from("account_status").upsert(
      {
        user_id: data.userId,
        state: data.state,
        reason: data.reason,
        changed_by: context.userId,
        changed_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );
    if (error) throw new Error(error.message);
    if (data.state === "suspended") await admin.auth.admin.signOut(data.userId, "global").catch(() => undefined);
    await audit(admin, {
      admin_user_id: context.userId,
      admin_email: await emailFingerprint(email),
      action_type: data.state === "suspended" ? "account.suspend" : "account.reactivate",
      target_type: "account",
      target_id: data.userId,
      before_json: before ?? { state: "active" },
      after_json: { state: data.state },
      reason: data.reason,
    });
    return { ok: true };
  });

export const adminCreateGrant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { userId: string; bundle: string; source: "complimentary" | "trial"; days: number; reason: string }) => {
      if (!UUID.test(String(input?.userId))) throw new Error("Invalid account");
      const bundle = text(input?.bundle, 40);
      if (!bundle) throw new Error("Choose what to grant");
      const reason = text(input?.reason);
      if (!reason) throw new Error("Please give a reason — it is recorded in the audit log");
      const days = Number(input?.days);
      if (!Number.isFinite(days) || days < 1 || days > 3650) throw new Error("Choose a length between 1 and 3650 days");
      const source: "complimentary" | "trial" = input?.source === "trial" ? "trial" : "complimentary";
      return { userId: input.userId, bundle, source, days: Math.round(days), reason };
    },
  )
  .handler(async ({ data, context }) => {
    const { admin, email } = await requireAdmin(context, COMMERCIAL_ROLES.concat("support_admin"));
    const endsAt = new Date(Date.now() + data.days * 864e5).toISOString();
    const { data: row, error } = await admin
      .from("entitlement_grants")
      .insert({
        user_id: data.userId,
        bundle: data.bundle,
        source_type: data.source,
        ends_at: endsAt,
        granted_by: context.userId,
        reason: data.reason,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    await audit(admin, {
      admin_user_id: context.userId,
      admin_email: await emailFingerprint(email),
      action_type: data.source === "trial" ? "grant.trial" : "grant.complimentary",
      target_type: "account",
      target_id: data.userId,
      after_json: { bundle: data.bundle, ends_at: endsAt, grant_id: row?.id },
      reason: data.reason,
    });
    return { id: row?.id, endsAt };
  });

export const adminRevokeGrant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { grantId: string; reason: string }) => {
    if (!UUID.test(String(input?.grantId))) throw new Error("Invalid grant");
    const reason = text(input?.reason);
    if (!reason) throw new Error("Please give a reason — it is recorded in the audit log");
    return { grantId: input.grantId, reason };
  })
  .handler(async ({ data, context }) => {
    const { admin, email } = await requireAdmin(context, COMMERCIAL_ROLES);
    const { data: before } = await admin
      .from("entitlement_grants")
      .select("user_id, bundle, ends_at, status")
      .eq("id", data.grantId)
      .maybeSingle();
    if (!before) throw new Error("Grant not found");
    const { error } = await admin
      .from("entitlement_grants")
      .update({
        status: "revoked",
        revoked_at: new Date().toISOString(),
        revoked_by: context.userId,
        revoke_reason: data.reason,
      })
      .eq("id", data.grantId);
    if (error) throw new Error(error.message);
    await audit(admin, {
      admin_user_id: context.userId,
      admin_email: await emailFingerprint(email),
      action_type: "grant.revoke",
      target_type: "grant",
      target_id: data.grantId,
      before_json: before,
      after_json: { status: "revoked" },
      reason: data.reason,
    });
    return { ok: true };
  });

export const adminListPromotions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { admin } = await requireAdmin(context, [...WRITE_ROLES, "read_only_admin"]);
    const [{ data: rows }, { data: reds }] = await Promise.all([
      admin
        .from("promotions")
        .select("id, code, campaign_name, benefit_type, bundle, duration_days, starts_at, ends_at, max_redemptions, status")
        .order("created_at", { ascending: false }),
      admin.from("promotion_redemptions").select("promotion_id"),
    ]);
    const counts = new Map<string, number>();
    for (const r of reds ?? []) counts.set(r.promotion_id, (counts.get(r.promotion_id) ?? 0) + 1);
    return (rows ?? []).map((p) => ({
      id: p.id,
      code: p.code,
      campaign: p.campaign_name,
      benefit: p.benefit_type,
      bundle: p.bundle,
      durationDays: p.duration_days,
      startsAt: p.starts_at,
      endsAt: p.ends_at,
      cap: p.max_redemptions,
      status: p.status,
      redemptions: counts.get(p.id) ?? 0,
    }));
  });

export const adminCreatePromotion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { code: string; campaign: string; bundle: string; durationDays: number; cap?: number; notes?: string }) => {
    const code = text(input?.code, 40)?.toUpperCase().replace(/\s+/g, "");
    const campaign = text(input?.campaign, 80);
    const bundle = text(input?.bundle, 40);
    if (!code || !/^[A-Z0-9-]{4,40}$/.test(code)) throw new Error("Codes use 4-40 letters, numbers or dashes");
    if (!campaign) throw new Error("Give the campaign a name");
    if (!bundle) throw new Error("Choose what the code grants");
    const days = Number(input?.durationDays);
    if (!Number.isFinite(days) || days < 1 || days > 3650) throw new Error("Choose a length between 1 and 3650 days");
    const cap = Number(input?.cap);
    return {
      code,
      campaign,
      bundle,
      durationDays: Math.round(days),
      cap: Number.isFinite(cap) && cap > 0 ? Math.round(cap) : null,
      notes: text(input?.notes, 400),
    };
  })
  .handler(async ({ data, context }) => {
    const { admin, email } = await requireAdmin(context, COMMERCIAL_ROLES);
    const { data: row, error } = await admin
      .from("promotions")
      .insert({
        code: data.code,
        campaign_name: data.campaign,
        bundle: data.bundle,
        duration_days: data.durationDays,
        max_redemptions: data.cap,
        internal_notes: data.notes,
        status: "active",
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message.includes("duplicate") ? "That code already exists" : error.message);
    await audit(admin, {
      admin_user_id: context.userId,
      admin_email: await emailFingerprint(email),
      action_type: "promotion.create",
      target_type: "promotion",
      target_id: row?.id,
      after_json: { ...data },
      reason: data.notes,
    });
    return { id: row?.id };
  });

export const adminSetPromotionStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; status: "active" | "paused" | "expired" }) => {
    if (!UUID.test(String(input?.id))) throw new Error("Invalid promotion");
    if (!["active", "paused", "expired"].includes(input?.status)) throw new Error("Invalid status");
    return { id: input.id, status: input.status };
  })
  .handler(async ({ data, context }) => {
    const { admin, email } = await requireAdmin(context, COMMERCIAL_ROLES);
    const { data: before } = await admin.from("promotions").select("status").eq("id", data.id).maybeSingle();
    const { error } = await admin.from("promotions").update({ status: data.status }).eq("id", data.id);
    if (error) throw new Error(error.message);
    await audit(admin, {
      admin_user_id: context.userId,
      admin_email: await emailFingerprint(email),
      action_type: "promotion.status",
      target_type: "promotion",
      target_id: data.id,
      before_json: before,
      after_json: { status: data.status },
    });
    return { ok: true };
  });

export const adminAuditLog = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { query?: string }) => ({ query: text(input?.query, 80) ?? "" }))
  .handler(async ({ data, context }) => {
    const { admin } = await requireAdmin(context, [...WRITE_ROLES, "read_only_admin"]);
    let request = admin
      .from("admin_audit_log")
      .select("id, admin_user_id, action_type, target_type, target_id, before_json, after_json, reason, created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    if (data.query) request = request.or(`action_type.ilike.%${data.query}%,target_id.ilike.%${data.query}%`);
    const { data: rows, error } = await request;
    if (error) throw new Error(error.message);
    const emailOf = await operatorEmails(admin);
    return (rows ?? []).map((r) => ({
      id: r.id,
      actor: (r.admin_user_id ? emailOf.get(r.admin_user_id) : null) ?? "Removed operator",
      action: r.action_type,
      targetType: r.target_type,
      targetId: r.target_id,
      before: r.before_json,
      after: r.after_json,
      reason: r.reason,
      at: r.created_at,
    }));
  });

export const adminListAdmins = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { admin } = await requireAdmin(context, OWNER_ROLES);
    const { data: rows } = await admin.from("app_admins").select("user_id, admin_role, status, created_at");
    const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const emailOf = new Map((list?.users ?? []).map((u) => [u.id, u.email ?? null]));
    return (rows ?? []).map((r) => ({
      userId: r.user_id,
      email: emailOf.get(r.user_id) ?? null,
      role: r.admin_role as AdminRole,
      status: r.status,
      createdAt: r.created_at,
    }));
  });

export const adminSetAdminRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { email: string; role: AdminRole | "none" }) => {
    const email = text(input?.email, 160)?.toLowerCase();
    if (!email || !email.includes("@")) throw new Error("Enter the person's sign-in email");
    const roles: string[] = ["super_admin", "billing_admin", "support_admin", "read_only_admin", "none"];
    if (!roles.includes(input?.role)) throw new Error("Invalid role");
    return { email, role: input.role };
  })
  .handler(async ({ data, context }) => {
    const { admin, email } = await requireAdmin(context, OWNER_ROLES);
    const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const target = (list?.users ?? []).find((u) => (u.email ?? "").toLowerCase() === data.email);
    if (!target) throw new Error("No account with that email has signed in yet");
    if (target.id === context.userId) throw new Error("You cannot change your own admin role");
    if (data.role === "none") {
      await admin
        .from("app_admins")
        .update({ status: "disabled", disabled_at: new Date().toISOString() })
        .eq("user_id", target.id);
      await admin.auth.admin.signOut(target.id, "global").catch(() => undefined);
    } else {
      await admin.from("app_admins").upsert(
        { user_id: target.id, admin_role: data.role, status: "active", created_by: context.userId, disabled_at: null },
        { onConflict: "user_id" },
      );
    }
    await audit(admin, {
      admin_user_id: context.userId,
      admin_email: await emailFingerprint(email),
      action_type: "admin.role",
      target_type: "admin",
      target_id: target.id,
      after_json: { role: data.role },
    });
    return { ok: true };
  });
