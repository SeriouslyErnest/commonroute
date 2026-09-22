import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { Button, Card, Chip, Field, inputClass } from "@/components/kintrip/ui";
import {
  adminAccountDetail,
  adminAuditLog,
  adminCreateGrant,
  adminCreatePromotion,
  adminDashboard,
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

type Tab = "dashboard" | "accounts" | "promotions" | "usage" | "audit" | "admins";

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
    { id: "accounts", label: "Accounts" },
    { id: "promotions", label: "Promotions" },
    { id: "usage", label: "Usage" },
    { id: "audit", label: "Audit log" },
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
      {tab === "accounts" && <AccountsTab role={role} />}
      {tab === "promotions" && <PromotionsTab role={role} />}
      {tab === "usage" && <UsageTab />}
      {tab === "audit" && <AuditTab />}
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
