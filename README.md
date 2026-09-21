# CommonRoute

**Plan together. Find your common route.**

CommonRoute is a mobile-first collaborative trip planner for families and friends. A group can collect preferences and practical needs, shortlist and vote on places, review costs and trade-offs, and publish one shared itinerary that remains useful during the trip.

CommonRoute is a remix of [Kintrip](https://github.com/ernestsee/kintrip), originally created for multi-generational family travel. The product now supports broader groups, assisted travellers, organiser governance, bookings, preparation lists, day-of travel views, maps, scheduling checks, and account-linked trips.

Built with [Lovable](https://lovable.dev), TanStack Start, React, TypeScript, Tailwind CSS, and a PostgreSQL-backed authentication service.

## What is included

- Passwordless email-link accounts and cross-device trip lists
- Invite links and shared-trip synchronization
- Personal preferences, accessibility and comfort needs, place voting, and group-fit summaries
- Owner, organiser, sponsor, contributor, and viewer roles
- Suggestion review, spending decisions, publication checks, and an audit history
- Assisted traveller profiles for children or people who want help participating
- Recommended itineraries, locked stops, day splitting, attendance, change acknowledgement, and re-planning
- Today and Simple views, bookings and stay details, shared jobs, and packing lists
- English and Simplified Chinese interfaces
- Place search, category maps, nearby grouping, driving-time checks, date-aware opening hours, and onward-access journeys
- Installable app behavior and offline access to saved trip information
- An internal operations console for account review, suspension, operator roles, grants, promotions, and audit records
- A local-only Japan demo that never syncs to the backend

See [Product guide](docs/PRODUCT.md) for the complete user journey, product rules, and current limitations.

## Documentation

| Guide | Purpose |
| --- | --- |
| [Product guide](docs/PRODUCT.md) | Users, workflows, shipped capabilities, and limitations |
| [Fork and deployment setup](docs/SETUP.md) | Local setup, backend, authentication, integrations, admin bootstrap, and deployment |
| [Architecture](docs/ARCHITECTURE.md) | Application structure, data flow, storage, security boundaries, maps, and offline behavior |
| [Security](docs/SECURITY.md) | Trust model, secrets, authorization, known trade-offs, and reporting |
| [Contributing](docs/CONTRIBUTING.md) | Change workflow, checks, migrations, translations, accessibility, and metadata |
| [Roadmap](roadmap.md) | Implemented product milestones |

## Quick start

The fastest way to make your own copy is to fork the repository, connect it to a new backend, and provide your own environment variables.

### Prerequisites

- Node.js 20 or later
- Bun 1.2 or later (recommended), or npm
- A PostgreSQL backend with compatible authentication and row-level security; Lovable Cloud is the easiest supported path

### Install and run

```sh
git clone https://github.com/<your-account>/<your-repository>.git
cd <your-repository>
bun install
bun run dev
```

If you use npm instead:

```sh
npm install
npm run dev
```

Then open the local address printed by Vite.

The application will not be fully functional until authentication, the database migrations, and the required environment variables are configured. Follow [docs/SETUP.md](docs/SETUP.md) before deploying.

## Essential configuration

At minimum, a self-hosted copy needs public browser credentials and separate server credentials:

```env
# Browser-safe public configuration
VITE_SUPABASE_URL=https://<your-backend-host>
VITE_SUPABASE_PUBLISHABLE_KEY=<publishable-key>

# Server-only configuration
SUPABASE_URL=https://<your-backend-host>
SUPABASE_PUBLISHABLE_KEY=<publishable-key>
SUPABASE_SERVICE_ROLE_KEY=<server-secret-key>

# First operator for a new installation
ADMIN_BOOTSTRAP_EMAIL=owner@example.com
ADMIN_EMAIL_HASH_SALT=<long-random-secret>

# Optional; defaults to /admin/admin
ADMIN_CONSOLE_PATH=/admin/admin
```

Never commit `.env`, `.env.local`, server keys, database URLs, connector keys, real operator email addresses, or audit salts.

The admin path is only an unlisted address, not an authorization control. Every operation is still checked against the signed-in operator account on the server. Forks default to `/admin/admin`; choose another path with `ADMIN_CONSOLE_PATH` if desired.

## Backend migrations

The SQL migrations are in `drizzle/migrations/`. A fresh fork should apply the production schema migrations in this order:

1. `0000_accounts_profiles_memberships.sql`
2. `0001_admin_console_entitlements.sql`
3. `0003_lock_down_security_definer_functions.sql`
4. `0004_hash_admin_audit_emails.sql`

Do **not** apply `0002_seed_test_super_admin.sql` to a new backend. It is a development-only historical seed tied to the original test environment. New installations bootstrap their first operator with `ADMIN_BOOTSTRAP_EMAIL` instead.

See [Fork and deployment setup](docs/SETUP.md#4-create-the-database) for the complete procedure.

## Development commands

```sh
bun run dev       # development server
bun run build     # production build
bun run lint      # lint the project
bun run format    # format supported files
bun run preview   # preview a production build locally
```

## Demo mode

The Japan sample trip is intentionally local-only. It does not require sign-in, does not upload to the shared backend, and must remain excluded from every current or future synchronization feature.

## Project status and limits

CommonRoute is a working product prototype with a broad planning workflow. Before operating a public service, review the security model, configure provider quotas and email delivery, run the full test checklist, and establish privacy, retention, support, and incident-response policies.

Not currently included: booking transactions, payment processing, customer promo redemption, in-app chat, live location tracking, live transport disruption alerts, guaranteed accessibility certification, worldwide transit schedules, turn-by-turn navigation, or offline map tiles.

## Licensing

This repository does not currently include an open-source license file. A public GitHub repository can be viewed and forked through GitHub, but reuse and redistribution rights are not granted automatically. Repository owners should add an appropriate license before inviting third-party reuse.