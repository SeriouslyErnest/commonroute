# Fork and Deployment Setup

This guide is for someone creating an independent CommonRoute installation from a GitHub fork. Use placeholders throughout and keep every private value outside version control.

## 1. Prerequisites

- Node.js 20+
- Bun 1.2+ (recommended) or npm
- Git
- A PostgreSQL backend with compatible authentication, row-level security, and server credentials
- An email delivery configuration for passwordless links

Lovable Cloud is the supported low-configuration option. A separate compatible backend can also work, but its operator is responsible for database access, authentication redirects, email delivery, backups, secrets, and production hardening.

## 2. Create your fork

Fork the repository on GitHub, then clone your fork:

```sh
git clone https://github.com/<your-account>/<your-repository>.git
cd <your-repository>
bun install
```

Use `npm install` if Bun is unavailable. Keep the existing lockfile strategy consistent in your branch rather than switching package managers repeatedly.

## 3. Configure environment variables

Create `.env.local` for local development or define the same variables in your hosting provider. Do not commit this file.

### Required browser-safe values

```env
VITE_SUPABASE_URL=https://<your-backend-host>
VITE_SUPABASE_PUBLISHABLE_KEY=<publishable-key>
```

Only `VITE_` values are exposed to browser code. A publishable key is designed for browser use but still relies on row-level security.

### Required server-only values

```env
SUPABASE_URL=https://<your-backend-host>
SUPABASE_PUBLISHABLE_KEY=<publishable-key>
SUPABASE_SERVICE_ROLE_KEY=<server-secret-key>
```

`SUPABASE_SERVICE_ROLE_KEY` bypasses row-level security. It must exist only in the server runtime. Never prefix it with `VITE_`, embed it in client code, print it, or commit it.

### Database migration connection

If you run migrations with Drizzle tooling, configure a privileged PostgreSQL connection only for the migration process:

```env
LOVABLE_DB_MIGRATION_URL=postgresql://<user>:<password>@<host>:5432/<database>
```

Do not expose this value to the browser or retain it in CI logs.

### Admin console

```env
ADMIN_BOOTSTRAP_EMAIL=owner@example.com
ADMIN_EMAIL_HASH_SALT=<long-random-secret>
ADMIN_CONSOLE_PATH=/admin/admin
```

- `ADMIN_BOOTSTRAP_EMAIL` identifies the first super admin. The matching person must sign in before automatic bootstrap occurs.
- `ADMIN_EMAIL_HASH_SALT` should be a high-entropy value generated for this installation and kept stable. Changing it prevents correlation with older audit fingerprints.
- `ADMIN_CONSOLE_PATH` is optional and defaults to `/admin/admin`. Use a leading slash, no trailing slash, and a maximum of 120 characters.

The path is not the security boundary. Server-side operator authorization protects every console action.

### Optional place search

Free search works without a key through OpenStreetMap Nominatim. For production volume, configure Geoapify:

```env
GEOAPIFY_API_KEY=<server-api-key>
```

The Google Maps search option is implemented through Lovable's managed connector gateway:

```env
LOVABLE_API_KEY=<lovable-project-secret>
GOOGLE_MAPS_API_KEY=<linked-connection-key>
```

These two values are server-only and are created when the Google Maps connector is linked to the Lovable project. A non-Lovable deployment must replace that gateway adapter or use only the free provider; a raw Google API key is not a drop-in replacement for `GOOGLE_MAPS_API_KEY` in the current gateway code.

## 4. Create the database

Migration files are in `drizzle/migrations/`. For a new installation, apply:

1. `0000_accounts_profiles_memberships.sql`
2. `0001_admin_console_entitlements.sql`
3. `0003_lock_down_security_definer_functions.sql`
4. `0004_hash_admin_audit_emails.sql`

Do **not** apply `0002_seed_test_super_admin.sql`. It is a historical development seed tied to an account in the original test environment. Use `ADMIN_BOOTSTRAP_EMAIL` for your installation.

Because that development seed remains in the historical migration journal, do not run an unreviewed blanket migration command against a fresh external database. Apply the four production SQL files above through your backend's migration mechanism, preserving the listed order. Record them as applied in your own migration system.

After migration, confirm:

- row-level security is enabled on user-facing tables;
- authenticated users can read and update only their own profile and memberships;
- browser roles cannot read the operator, promotion, or audit tables;
- the new-user trigger creates a profile; and
- the security-definer routines are not executable by browser roles.

The current `drizzle/schema.ts` is intentionally empty and is not a complete schema source. The checked-in SQL migrations are authoritative for the backend additions in this repository.

## 5. Configure passwordless email sign-in

In your authentication provider:

1. Enable email sign-in links.
2. Configure an email sender and templates suitable for your domain.
3. Set the site's primary URL to your deployed origin, for example `https://travel.example.com`.
4. Allow redirect URLs for every environment that will send links:
   - `http://localhost:3000/auth` or the local Vite origin you use;
   - `https://preview.example.com/auth`; and
   - `https://travel.example.com/auth`.
5. Decide whether new users may be created automatically. The current client requests account creation when sending a sign-in link.
6. Test the entire link flow on the same domain where sessions will be used.

Do not add passwords or typed OTP codes unless you intentionally redesign the current account flow.

## 6. Run locally

```sh
bun run dev
```

The terminal prints the local URL. Test at least:

- the no-trip start screen;
- the local-only demo;
- creating a real trip;
- email-link sign-in;
- joining with a share code from a second browser context;
- place search with your selected provider; and
- an authorized and unauthorized admin-console visit.

## 7. Maps, tiles, and routing

These are separate capabilities:

- **Place search:** Geoapify/Nominatim or the managed Google Maps connector.
- **Map rendering:** MapLibre GL in the browser.
- **Map tiles:** the current code uses public OpenStreetMap raster tiles.
- **Driving routes:** the current code uses the public OSRM demonstration server.

Public community endpoints are useful for development and light testing, but they are not a production capacity guarantee. Before operating at scale, select providers with terms, quotas, attribution, uptime, and privacy policies that match your usage. Update the adapters rather than putting provider secrets in browser code.

## 8. Configure the first operator

1. Set `ADMIN_BOOTSTRAP_EMAIL` before starting the server.
2. Set a stable `ADMIN_EMAIL_HASH_SALT`.
3. Optionally choose `ADMIN_CONSOLE_PATH`; otherwise use `/admin/admin`.
4. Sign in to the main app with the exact bootstrap email.
5. Open the configured console path.
6. The server creates the first `super_admin` record and writes an audit event.
7. Add additional operators from the Operators tab and assign the least privilege they need.

The first operator should add a backup super admin and establish a private operations runbook. Do not place a deployment's actual private console URL, operator emails, or recovery details in this public repository.

## 9. Build and deploy

```sh
bun run build
```

Deploy the generated TanStack Start application to a platform that supports its server runtime. Configure the same environment variables in the deployment service. Keep server-only secrets out of build-time browser injection.

Production requirements include:

- HTTPS;
- correct email-link redirect origins;
- persistent server environment variables;
- a database backup and migration process;
- provider quota and failure monitoring;
- privacy and retention policies;
- an incident-response and account-recovery procedure; and
- a custom email sender suitable for real users.

The service worker registers only in production and is disabled in development, embedded frames, and known preview hosts.

## 10. Post-deployment checks

- [ ] No secret values appear in the browser bundle, page source, or network responses.
- [ ] A new account receives a working sign-in link.
- [ ] A signed-in account sees its trips on a second device.
- [ ] A non-operator receives a generic not-found screen at the console path.
- [ ] The bootstrap operator can enter the console and add a limited operator.
- [ ] Suspension blocks profile and membership writes and signs the account out globally.
- [ ] Demo mode never appears in backend trip or membership records.
- [ ] Shared-trip writes reject a wrong share code and oversized state.
- [ ] English and Simplified Chinese controls work after reload.
- [ ] The published itinerary remains readable after going offline.
- [ ] Map attribution is visible and routing failures display as unavailable.
- [ ] Database backups and restore procedures have been exercised.

## 11. Updating a fork

When pulling upstream changes:

1. Review all new migrations before applying them.
2. Back up the database.
3. Compare environment-variable requirements.
4. Run lint and a production build.
5. Test authentication, shared-trip sync, admin authorization, translations, and the local-only demo.
6. Apply migrations in a controlled deployment window.

Never resolve a migration conflict by weakening row-level security or granting browser access to server-only tables.