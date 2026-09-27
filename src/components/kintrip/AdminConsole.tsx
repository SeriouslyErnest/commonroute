import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { Button, Card, Chip, Field, inputClass } from "@/components/kintrip/ui";
import {
  adminAccountDetail,
  adminAuditLog,
  adminCreateGrant,
  adminCreatePromotion,
  adminDashboard,
  adminDecideApproval,
  adminGetSignupSettings,
  adminListApprovals,
  adminSetSignupSettings,
  adminListAdmins,
  adminListPromotions,
  adminProductMetrics,
  adminRevokeGrant,
  adminSearchAccounts,
  adminSession,
  adminSetAccountState,
  adminSetAdminRole,
  adminSetPromotionStatus,
  type AdminRole,
} from "@/lib/kintrip/admin.functions";
import {
  disconnectAdminTelegram as disconnectAdminTelegramFn,
  getAdminTelegramStatus,
  registerTelegramWebhook as registerTelegramWebhookFn,
  sendAdminTelegramTest as sendAdminTelegramTestFn,
  startAdminTelegramLink as startAdminTelegramLinkFn,
} from "@/lib/kintrip/telegram.functions";

type Tab = "dashboard" | "signups" | "accounts" | "promotions" | "usage" | "audit" | "telegram" | "admins";

export function AdminConsole() {
  const session = useServerFn(adminSession);
  const [state, setState] = useState<{ role: AdminRole | null; email: string | null } | "loading" | "denied">(
    "loading",
  );
  const [tab, setTab] = useState<Tab>("dashboard");

  useEffect(() => {
    session()
      .then((s) => setState(s.isAdmin ? { role: s.role as AdminRole, email: s.email } : "denied"))
      .catch(() => setState("denied"));
  }, [session]);

  if (state === "loading") return <Shell>Checking…</Shell>;
  if (state === "denied")
    return (
      <Shell>
        <h1 className="text-2xl font-extrabold">Page not found</h1>
        <p className="mt-2 text-muted-foreground">
          Nothing to see here. If you manage this product, sign in with your operator account first.
        </p>
      </Shell>
    );

  const role = state.role!;
  const tabs: { id: Tab; label: string }[] = [
    { id: "dashboard", label: "Overview" },
    { id: "signups", label: "Sign-ups" },
    { id: "accounts", label: "Accounts" },
    { id: "promotions", label: "Promotions" },
    { id: "usage", label: "Usage" },
    { id: "audit", label: "Audit log" },
    { id: "telegram", label: "Telegram alerts" },
    ...(role === "super_admin" ? [{ id: "admins" as Tab, label: "Operators" }] : []),
  ];

  return (
    <Shell>
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-extrabold text-foreground">Operations console</h1>
          <p className="text-sm text-muted-foreground">
            {state.email} · {role.replace(/_/g, " ")}
          </p>
        </div>
        <Chip tone="secondary">Internal use</Chip>
      </header>

      <nav className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <Button
            key={t.id}
            variant={tab === t.id ? "primary" : "outline"}
            className="px-4 text-sm"
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </Button>
        ))}
      </nav>

      {tab === "dashboard" && <DashboardTab />}
      {tab === "signups" && <SignupsTab role={role} />}
      {tab === "accounts" && <AccountsTab role={role} />}
      {tab === "promotions" && <PromotionsTab role={role} />}
      {tab === "usage" && <UsageTab />}
      {tab === "audit" && <AuditTab />}
      {tab === "telegram" && <TelegramTab role={role} />}
      {tab === "admins" && role === "super_admin" && <AdminsTab />}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-4 px-4 py-6">{children}</main>
  );
}

function Notice({ text }: { text: string | null }) {
  if (!text) return null;
  return <p className="text-sm font-semibold text-foreground">{text}</p>;
}

function UsageTab() {
  const load = useServerFn(adminProductMetrics);
  const [days, setDays] = useState(30);
  const [data, setData] = useState<Awaited<ReturnType<typeof adminProductMetrics>> | null>(null);
  useEffect(() => {
    load({ data: { days } }).then(setData).catch(() => setData(null));
  }, [load, days]);
  if (!data) return <Card>Loading…</Card>;
  const cards = [
    { label: "People active", value: data.people },
    { label: "Trips active", value: data.trips },
    { label: "Advanced runs settled", value: data.unitsSettled },
    {
      label: "Paid revenue",
      value: `${data.currency} ${(data.paidRevenueMinor / 100).toFixed(0)}`,
    },
    { label: "Average usefulness", value: data.averageRating ?? "—" },
  ];
  const lists: { title: string; rows: { key: string; count: number }[] }[] = [
    { title: "Events", rows: data.events },
    { title: "Orders by state", rows: data.orders },
    { title: "Passes granted", rows: data.entitlements },
    { title: "Advanced runs by feature", rows: data.jobsByFeature },
    { title: "Advanced runs by outcome", rows: data.jobsByStatus },
  ];
  return (
    <>
      <div className="flex flex-wrap gap-2">
        {[7, 30, 90].map((d) => (
          <Button key={d} variant={days === d ? "primary" : "outline"} className="px-4 text-sm" onClick={() => setDays(d)}>
            Last {d} days
          </Button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {cards.map((c) => (
          <Card key={c.label} className="text-center">
            <p className="text-2xl font-extrabold text-foreground">{c.value}</p>
            <p className="text-xs text-muted-foreground">{c.label}</p>
          </Card>
        ))}
      </div>
      {lists.map((l) => (
        <Card key={l.title}>
          <h2 className="text-lg font-bold">{l.title}</h2>
          {l.rows.length === 0 ? (
            <p className="mt-1 text-sm text-muted-foreground">Nothing yet.</p>
          ) : (
            <ul className="mt-2 flex flex-col gap-1 text-sm">
              {l.rows.map((r) => (
                <li key={r.key} className="flex justify-between gap-3">
                  <span>{r.key.replace(/_/g, " ")}</span>
                  <span className="font-bold">{r.count}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      ))}
      <p className="text-xs text-muted-foreground">
        Counts only. No addresses, private needs, notes, emails or invite codes are recorded.
      </p>
    </>
  );
}

function DashboardTab() {
  const load = useServerFn(adminDashboard);
  const [data, setData] = useState<Awaited<ReturnType<typeof adminDashboard>> | null>(null);
  useEffect(() => {
    load().then(setData).catch(() => setData(null));
  }, [load]);
  if (!data) return <Card>Loading…</Card>;
  const cards = [
    { label: "Accounts", value: data.accounts },
    { label: "Suspended", value: data.suspended },
    { label: "Active grants", value: data.activeGrants },
    { label: "Expiring in 7 days", value: data.expiringSoon },
    { label: "Trials", value: data.trials },
    { label: "Live promo codes", value: data.activePromotions },
  ];
  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {cards.map((c) => (
          <Card key={c.label} className="text-center">
            <p className="text-2xl font-extrabold text-foreground">{c.value}</p>
            <p className="text-xs text-muted-foreground">{c.label}</p>
          </Card>
        ))}
      </div>
      <Card>
        <h2 className="text-lg font-bold">Recent admin activity</h2>
        {data.recent.length === 0 ? (
          <p className="mt-1 text-sm text-muted-foreground">Nothing yet.</p>
        ) : (
          <ul className="mt-2 flex flex-col gap-2 text-sm">
            {data.recent.map((r) => (
              <li key={r.id} className="border-t border-border pt-2">
                <span className="font-semibold">{r.action}</span> · {r.actor ?? "unknown"} ·{" "}
                {new Date(r.at).toLocaleString()}
                {r.reason ? <span className="block text-muted-foreground">{r.reason}</span> : null}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}

function AccountsTab({ role }: { role: AdminRole }) {
  const search = useServerFn(adminSearchAccounts);
  const detail = useServerFn(adminAccountDetail);
  const setStateFn = useServerFn(adminSetAccountState);
  const grantFn = useServerFn(adminCreateGrant);
  const revokeFn = useServerFn(adminRevokeGrant);

  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<Awaited<ReturnType<typeof adminSearchAccounts>>>([]);
  const [open, setOpen] = useState<Awaited<ReturnType<typeof adminAccountDetail>> | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [bundle, setBundle] = useState("team");
  const [days, setDays] = useState(30);
  const [source, setSource] = useState<"complimentary" | "trial">("complimentary");

  const run = useMemo(
    () => (q: string) => {
      search({ data: { query: q } })
        .then(setRows)
        .catch((e) => setNotice(String(e.message ?? e)));
    },
    [search],
  );
  useEffect(() => {
    run("");
  }, [run]);

  const refresh = (id: string) => detail({ data: { userId: id } }).then(setOpen);

  return (
    <>
      <Card>
        <Field label="Find an account">
          <input
            className={inputClass}
            placeholder="Email or account id"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && run(query)}
          />
        </Field>
        <Button className="mt-3 text-sm" onClick={() => run(query)}>
          Search
        </Button>
        <Notice text={notice} />
        <ul className="mt-3 flex flex-col gap-2">
          {rows.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-2">
              <span className="text-sm">
                <span className="font-semibold">{r.email ?? r.id}</span>
                {r.displayName ? <span className="text-muted-foreground"> · {r.displayName}</span> : null}
              </span>
              <span className="flex items-center gap-2">
                <Chip tone={r.state === "suspended" ? "coral" : "lime"}>
                  {r.state === "suspended" ? "Suspended" : "Active"}
                </Chip>
                <Button variant="outline" className="px-3 text-sm" onClick={() => refresh(r.id)}>
                  Open
                </Button>
              </span>
            </li>
          ))}
          {rows.length === 0 ? <li className="text-sm text-muted-foreground">No accounts found.</li> : null}
        </ul>
      </Card>

      {open ? (
        <Card>
          <h2 className="text-lg font-bold">{open.email ?? open.id}</h2>
          <p className="text-sm text-muted-foreground">
            Joined {new Date(open.createdAt).toLocaleDateString()} · Last signed in{" "}
            {open.lastSignInAt ? new Date(open.lastSignInAt).toLocaleDateString() : "never"} · {open.trips.length} trips
            saved
          </p>
          <p className="mt-2 text-sm">
            Access right now: <span className="font-semibold">{open.effectiveBundle}</span> (from{" "}
            {open.effectiveSource.replace(/_/g, " ")})
            {open.overlapping ? <span className="text-muted-foreground"> · overlapping grants</span> : null}
          </p>
          {open.state === "suspended" ? (
            <p className="mt-2 text-sm font-semibold text-foreground">
              Suspended — {open.stateReason} ({open.stateChangedAt ? new Date(open.stateChangedAt).toLocaleString() : ""}
              )
            </p>
          ) : null}

          <Field label="Reason (recorded in the audit log)">
            <input className={inputClass} value={reason} onChange={(e) => setReason(e.target.value)} />
          </Field>

          {role === "super_admin" ? (
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                variant={open.state === "suspended" ? "collaborative" : "outline"}
                className="text-sm"
                onClick={() =>
                  setStateFn({
                    data: {
                      userId: open.id,
                      state: open.state === "suspended" ? "active" : "suspended",
                      reason,
                    },
                  })
                    .then(() => refresh(open.id))
                    .then(() => setNotice(open.state === "suspended" ? "Account restored." : "Account suspended."))
                    .catch((e) => setNotice(String(e.message ?? e)))
                }
              >
                {open.state === "suspended" ? "Restore access" : "Suspend this account"}
              </Button>
            </div>
          ) : (
            <p className="mt-2 text-xs text-muted-foreground">Only a super admin can suspend or restore an account.</p>
          )}

          <div className="mt-4 border-t border-border pt-3">
            <h3 className="font-bold">Give complimentary access</h3>
            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              <Field label="Plan">
                <input className={inputClass} value={bundle} onChange={(e) => setBundle(e.target.value)} />
              </Field>
              <Field label="Days">
                <input
                  className={inputClass}
                  type="number"
                  value={days}
                  onChange={(e) => setDays(Number(e.target.value))}
                />
              </Field>
              <Field label="Type">
                <select
                  className={inputClass}
                  value={source}
                  onChange={(e) => setSource(e.target.value as "complimentary" | "trial")}
                >
                  <option value="complimentary">Complimentary</option>
                  <option value="trial">Trial</option>
                </select>
              </Field>
            </div>
            <Button
              className="mt-2 text-sm"
              onClick={() =>
                grantFn({ data: { userId: open.id, bundle, source, days, reason } })
                  .then(() => refresh(open.id))
                  .then(() => setNotice("Access granted."))
                  .catch((e) => setNotice(String(e.message ?? e)))
              }
            >
              Grant
            </Button>
          </div>

          <div className="mt-4 border-t border-border pt-3">
            <h3 className="font-bold">Grants on this account</h3>
            <ul className="mt-2 flex flex-col gap-2 text-sm">
              {open.grants.map((g) => (
                <li key={g.id} className="flex flex-wrap items-center justify-between gap-2">
                  <span>
                    {g.bundle} · {g.source.replace(/_/g, " ")} ·{" "}
                    {g.endsAt ? `until ${new Date(g.endsAt).toLocaleDateString()}` : "no end date"} · {g.status}
                    <span className="block text-muted-foreground">{g.reason}</span>
                  </span>
                  {g.status === "active" ? (
                    <Button
                      variant="outline"
                      className="px-3 text-sm"
                      onClick={() =>
                        revokeFn({ data: { grantId: g.id, reason } })
                          .then(() => refresh(open.id))
                          .then(() => setNotice("Grant revoked."))
                          .catch((e) => setNotice(String(e.message ?? e)))
                      }
                    >
                      Revoke
                    </Button>
                  ) : null}
                </li>
              ))}
              {open.grants.length === 0 ? <li className="text-muted-foreground">None yet.</li> : null}
            </ul>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Suspending or expiring access never deletes anything a group owns — trips, votes and history stay intact.
          </p>
        </Card>
      ) : null}
    </>
  );
}

function PromotionsTab({ role }: { role: AdminRole }) {
  const list = useServerFn(adminListPromotions);
  const create = useServerFn(adminCreatePromotion);
  const setStatus = useServerFn(adminSetPromotionStatus);
  const [rows, setRows] = useState<Awaited<ReturnType<typeof adminListPromotions>>>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [form, setForm] = useState({ code: "", campaign: "", bundle: "team", durationDays: 90, cap: 0, notes: "" });
  const reload = useMemo(() => () => list().then(setRows).catch(() => undefined), [list]);
  useEffect(() => {
    reload();
  }, [reload]);
  const canEdit = role === "super_admin" || role === "billing_admin";

  return (
    <>
      {canEdit ? (
        <Card>
          <h2 className="text-lg font-bold">New promo code</h2>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <Field label="Code">
              <input
                className={inputClass}
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
              />
            </Field>
            <Field label="Campaign">
              <input
                className={inputClass}
                value={form.campaign}
                onChange={(e) => setForm({ ...form, campaign: e.target.value })}
              />
            </Field>
            <Field label="Grants plan">
              <input
                className={inputClass}
                value={form.bundle}
                onChange={(e) => setForm({ ...form, bundle: e.target.value })}
              />
            </Field>
            <Field label="Days">
              <input
                className={inputClass}
                type="number"
                value={form.durationDays}
                onChange={(e) => setForm({ ...form, durationDays: Number(e.target.value) })}
              />
            </Field>
            <Field label="Maximum uses (0 = no limit)">
              <input
                className={inputClass}
                type="number"
                value={form.cap}
                onChange={(e) => setForm({ ...form, cap: Number(e.target.value) })}
              />
            </Field>
            <Field label="Internal notes">
              <input
                className={inputClass}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </Field>
          </div>
          <Button
            className="mt-2 text-sm"
            onClick={() =>
              create({ data: form })
                .then(() => reload())
                .then(() => setNotice("Code created."))
                .catch((e) => setNotice(String(e.message ?? e)))
            }
          >
            Create code
          </Button>
          <Notice text={notice} />
        </Card>
      ) : null}
      <Card>
        <h2 className="text-lg font-bold">Promo codes</h2>
        <ul className="mt-2 flex flex-col gap-2 text-sm">
          {rows.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-2">
              <span>
                <span className="font-semibold">{p.code}</span> · {p.campaign} · {p.bundle} · {p.durationDays} days ·{" "}
                {p.redemptions}
                {p.cap ? ` / ${p.cap}` : ""} used
              </span>
              <span className="flex items-center gap-2">
                <Chip tone={p.status === "active" ? "lime" : "neutral"}>{p.status}</Chip>
                {canEdit ? (
                  <Button
                    variant="outline"
                    className="px-3 text-sm"
                    onClick={() =>
                      setStatus({ data: { id: p.id, status: p.status === "active" ? "paused" : "active" } })
                        .then(() => reload())
                        .catch((e) => setNotice(String(e.message ?? e)))
                    }
                  >
                    {p.status === "active" ? "Pause" : "Resume"}
                  </Button>
                ) : null}
              </span>
            </li>
          ))}
          {rows.length === 0 ? <li className="text-muted-foreground">No codes yet.</li> : null}
        </ul>
      </Card>
    </>
  );
}

function AuditTab() {
  const load = useServerFn(adminAuditLog);
  const [rows, setRows] = useState<Awaited<ReturnType<typeof adminAuditLog>>>([]);
  const [query, setQuery] = useState("");
  useEffect(() => {
    load({ data: { query: "" } })
      .then(setRows)
      .catch(() => undefined);
  }, [load]);
  return (
    <Card>
      <h2 className="text-lg font-bold">Audit log</h2>
      <p className="text-sm text-muted-foreground">Every admin action, kept permanently. Nothing here can be edited.</p>
      <div className="mt-2 flex gap-2">
        <input
          className={inputClass}
          placeholder="Filter by action or target"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <Button
          variant="outline"
          className="text-sm"
          onClick={() =>
            load({ data: { query } })
              .then(setRows)
              .catch(() => undefined)
          }
        >
          Filter
        </Button>
      </div>
      <ul className="mt-3 flex flex-col gap-2 text-sm">
        {rows.map((r) => (
          <li key={r.id} className="border-t border-border pt-2">
            <span className="font-semibold">{r.action}</span> · {r.actor ?? "unknown"} · {r.targetType} {r.targetId}
            <span className="block text-muted-foreground">
              {new Date(r.at).toLocaleString()}
              {r.reason ? ` · ${r.reason}` : ""}
            </span>
          </li>
        ))}
        {rows.length === 0 ? <li className="text-muted-foreground">Nothing recorded yet.</li> : null}
      </ul>
    </Card>
  );
}

function AdminsTab() {
  const list = useServerFn(adminListAdmins);
  const setRole = useServerFn(adminSetAdminRole);
  const [rows, setRows] = useState<Awaited<ReturnType<typeof adminListAdmins>>>([]);
  const [email, setEmail] = useState("");
  const [role, setRoleValue] = useState<AdminRole | "none">("support_admin");
  const [notice, setNotice] = useState<string | null>(null);
  const reload = useMemo(() => () => list().then(setRows).catch(() => undefined), [list]);
  useEffect(() => {
    reload();
  }, [reload]);
  return (
    <Card>
      <h2 className="text-lg font-bold">Operators</h2>
      <p className="text-sm text-muted-foreground">
        People here can open this console. They must have signed in to the app at least once.
      </p>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <Field label="Sign-in email">
          <input className={inputClass} value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Role">
          <select
            className={inputClass}
            value={role}
            onChange={(e) => setRoleValue(e.target.value as AdminRole | "none")}
          >
            <option value="super_admin">Super admin</option>
            <option value="billing_admin">Billing admin</option>
            <option value="support_admin">Support admin</option>
            <option value="read_only_admin">Read only</option>
            <option value="none">Remove access</option>
          </select>
        </Field>
      </div>
      <Button
        className="mt-2 text-sm"
        onClick={() =>
          setRole({ data: { email, role } })
            .then(() => reload())
            .then(() => setNotice("Saved."))
            .catch((e) => setNotice(String(e.message ?? e)))
        }
      >
        Save
      </Button>
      <Notice text={notice} />
      <ul className="mt-3 flex flex-col gap-2 text-sm">
        {rows.map((r) => (
          <li key={r.userId} className="flex items-center justify-between gap-2 border-t border-border pt-2">
            <span>{r.email ?? r.userId}</span>
            <Chip tone={r.status === "active" ? "lime" : "neutral"}>{r.role.replace(/_/g, " ")}</Chip>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function TelegramTab({ role }: { role: AdminRole }) {
  const getStatus = useServerFn(getAdminTelegramStatus);
  const startAdminTelegramLink = useServerFn(startAdminTelegramLinkFn);
  const sendAdminTelegramTest = useServerFn(sendAdminTelegramTestFn);
  const disconnectAdminTelegram = useServerFn(disconnectAdminTelegramFn);
  const registerTelegramWebhook = useServerFn(registerTelegramWebhookFn);
  const [status, setStatus] = useState<{
    configured: boolean;
    status: string;
    eventPrefs: Record<string, boolean>;
  } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [webhookUrl, setWebhookUrl] = useState("");

  function refresh() {
    setLoadError(null);
    getStatus()
      .then(setStatus)
      .catch((err: unknown) => {
        setStatus(null);
        setLoadError(err instanceof Error ? err.message : "Couldn't load Telegram status");
      });
  }
  useEffect(refresh, []);

  if (loadError)
    return (
      <Card className="space-y-2">
        <p className="text-sm text-foreground">Couldn't load Telegram alerts: {loadError}</p>
        <Button variant="outline" onClick={refresh}>
          Retry
        </Button>
      </Card>
    );
  if (!status) return <Card>Loading…</Card>;
  if (!status.configured)
    return (
      <Card>
        <h2 className="text-lg font-bold text-foreground">Telegram admin alerts</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Telegram is not configured on this server. The bot token and webhook secret must be set
          as protected server secrets before admin alerts can be connected.
        </p>
      </Card>
    );

  return (
    <Card className="space-y-3">
      <h2 className="text-lg font-bold text-foreground">Telegram admin alerts</h2>
      <p className="text-sm text-muted-foreground">
        Operational alerts can be delivered to your Telegram through the CommonRoute bot. Alerts
        are generic and read-only — they never contain sensitive narratives, and nothing can be
        actioned from Telegram.
      </p>
      <p className="text-sm font-semibold text-foreground">
        Status: {status.status === "active" ? "Connected" : status.status === "needs_attention" ? "Needs attention — reconnect" : "Not connected"}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          onClick={async () => {
            setNotice(null);
            try {
              const { url } = await startAdminTelegramLink();
              window.open(url, "_blank", "noopener");
              setNotice("Finish connecting in Telegram (tap START), then refresh this page.");
            } catch (err) {
              setNotice(err instanceof Error ? err.message : "Couldn't start the connection");
            }
          }}
        >
          {status.status === "active" ? "Reconnect" : "Connect Telegram"}
        </Button>
        {status.status === "active" && (
          <>
            <Button
              variant="outline"
              onClick={async () => {
                setNotice(null);
                try {
                  await sendAdminTelegramTest();
                  setNotice("Test alert sent — check Telegram.");
                } catch (err) {
                  setNotice(err instanceof Error ? err.message : "Couldn't send the test");
                  refresh();
                }
              }}
            >
              Send test alert
            </Button>
            <Button
              variant="outline"
              onClick={async () => {
                setNotice(null);
                await disconnectAdminTelegram();
                refresh();
              }}
            >
              Disconnect
            </Button>
          </>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        Event categories: operations, billing, accounts. Category toggles and severity thresholds
        are stored per destination; delivery failures pause alerts for that destination only.
      </p>

      {role === "super_admin" && (
        <div className="space-y-2 border-t border-border pt-3">
          <h3 className="text-sm font-bold text-foreground">Webhook registration</h3>
          <p className="text-xs text-muted-foreground">
            Point Telegram at this deployment's webhook endpoint. The signing secret stays on the
            server and is registered automatically.
          </p>
          <Field label="Public site origin (https://…)">
            <input
              className={inputClass}
              value={webhookUrl}
              placeholder="https://example.com"
              onChange={(e) => setWebhookUrl(e.target.value)}
            />
          </Field>
          <Button
            variant="outline"
            disabled={!webhookUrl.trim()}
            onClick={async () => {
              setNotice(null);
              try {
                const r = await registerTelegramWebhook({ data: { publicUrl: webhookUrl.trim() } });
                setNotice(`Webhook registered: ${r.url}`);
              } catch (err) {
                setNotice(err instanceof Error ? err.message : "Couldn't register the webhook");
              }
            }}
          >
            Register webhook with Telegram
          </Button>
        </div>
      )}
      <Notice text={notice} />
    </Card>
  );
}

function SignupsTab({ role }: { role: AdminRole }) {
  const getSettings = useServerFn(adminGetSignupSettings);
  const saveSettings = useServerFn(adminSetSignupSettings);
  const list = useServerFn(adminListApprovals);
  const decide = useServerFn(adminDecideApproval);
  const [settings, setSettings] = useState<{
    approvalRequired: boolean;
    alertPending: boolean;
    alertFirstEntry: boolean;
  } | null>(null);
  const [filter, setFilter] = useState<"pending" | "rejected">("pending");
  const [rows, setRows] = useState<{ userId: string; email: string | null; createdAt: string }[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const canWrite = role !== "read_only_admin";

  useEffect(() => {
    getSettings().then(setSettings).catch(() => setSettings(null));
  }, [getSettings]);
  useEffect(() => {
    list({ data: { status: filter } }).then(setRows).catch(() => setRows([]));
  }, [list, filter]);

  async function toggle(key: "approvalRequired" | "alertPending" | "alertFirstEntry") {
    if (!settings) return;
    setNotice(null);
    try {
      setSettings(await saveSettings({ data: { ...settings, [key]: !settings[key] } }));
      setNotice("Saved.");
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Couldn't save");
    }
  }

  const items: { key: "approvalRequired" | "alertPending" | "alertFirstEntry"; label: string; help: string }[] = [
    { key: "approvalRequired", label: "Require approval for new accounts", help: "New sign-ups wait on a holding screen until an operator approves them. The demo trip and invite joining still work." },
    { key: "alertPending", label: "Telegram alert: new sign-up waiting for approval", help: "Sent once, when a new account joins the approval queue." },
    { key: "alertFirstEntry", label: "Telegram alert: account entered the app for the first time", help: "Information only. Sent once per account, the first time it gets into the app." },
  ];

  return (
    <div className="space-y-4">
      <Card className="space-y-3">
        <h2 className="text-lg font-bold text-foreground">Sign-up settings</h2>
        {!settings ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          items.map((it) => (
            <label key={it.key} className="flex min-h-11 items-start gap-3">
              <input
                type="checkbox"
                className="mt-1 size-5"
                checked={settings[it.key]}
                disabled={role !== "super_admin"}
                onChange={() => void toggle(it.key)}
              />
              <span>
                <span className="block text-sm font-semibold text-foreground">{it.label}</span>
                <span className="block text-xs text-muted-foreground">{it.help}</span>
              </span>
            </label>
          ))
        )}
        <p className="text-xs text-muted-foreground">
          Only super admins can change these. Alerts go to operators with a connected Telegram
          destination and the accounts category on. Alerts never include a link to this console.
        </p>
        <Notice text={notice} />
      </Card>

      <Card className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-bold text-foreground">Approval queue</h2>
          <div className="flex gap-2">
            {(["pending", "rejected"] as const).map((f) => (
              <Button key={f} variant={filter === f ? "primary" : "outline"} className="px-4 text-sm" onClick={() => setFilter(f)}>
                {f === "pending" ? "Waiting" : "Rejected"}
              </Button>
            ))}
          </div>
        </div>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing here.</p>
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((r) => (
              <li key={r.userId} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span className="min-w-0 break-all text-sm">
                  <span className="font-semibold text-foreground">{r.email ?? r.userId}</span>
                  <span className="block text-xs text-muted-foreground">
                    Signed up {new Date(r.createdAt).toLocaleString()}
                  </span>
                </span>
                {canWrite && (
                  <span className="flex gap-2">
                    <Button
                      className="px-4 text-sm"
                      onClick={async () => {
                        await decide({ data: { userId: r.userId, decision: "approved" } });
                        setRows((x) => x.filter((y) => y.userId !== r.userId));
                      }}
                    >
                      Approve
                    </Button>
                    {filter === "pending" && (
                      <Button
                        variant="outline"
                        className="px-4 text-sm"
                        onClick={async () => {
                          await decide({ data: { userId: r.userId, decision: "rejected" } });
                          setRows((x) => x.filter((y) => y.userId !== r.userId));
                        }}
                      >
                        Reject
                      </Button>
                    )}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
