# CommonRoute Architecture

## 1. Stack

- **Application:** React 19 with TanStack Start and TanStack Router
- **Build:** Vite
- **Styling:** Tailwind CSS v4 and shared design components
- **Data fetching:** TanStack Query and typed TanStack server functions
- **Backend:** PostgreSQL, authentication, row-level security, and generated clients
- **Validation:** Zod at public server-function boundaries
- **Maps:** MapLibre GL with OpenStreetMap raster tiles
- **Routing:** OSRM HTTP adapter
- **Offline:** Vite PWA service worker plus local device state

## 2. Repository map

```text
src/
  components/kintrip/       Shared product and operations UI
  components/ui/            Reusable low-level controls
  integrations/supabase/    Generated browser/server clients and auth middleware
  lib/i18n.tsx              English/Simplified Chinese translation layer
  lib/kintrip/              Product state, actions, rules, sync, maps, and scheduling
  routes/                    TanStack file-based pages
  start.ts                   Request, CSRF, and authenticated server-function middleware
  styles.css                 Theme tokens and global styles
drizzle/migrations/          Authoritative SQL migrations for account/admin additions
public/                      Static public assets
```

`src/routeTree.gen.ts` is generated. Do not edit it.

## 3. Routing and rendering

TanStack Router derives URLs from files in `src/routes/`. The root route owns the document shell, locale provider, query client, service-worker setup, shared error page, and nested `<Outlet />`.

Most product pages render inside `AppShell`. The print and authentication experiences use standalone layouts. Browser-only map code is dynamically imported to avoid server-rendering failures.

Each content route should define route-specific title, description, Open Graph title/description, Open Graph type, and Twitter card metadata.

## 4. Product state

`KintripState` in `src/lib/kintrip/types.ts` is the central aggregate. It contains the trip, travellers, attractions, votes, suggestions, itinerary, governance settings, bookings, preparation items, changes, attendance, map clusters, and related audit information.

There is intentionally no parallel store for newer features. `normalizeState()` backfills optional fields when an older trip is loaded. This allows existing device caches and shared trips to survive additive model changes.

The client-side store in `src/lib/kintrip/store.ts`:

- hydrates after the initial server render to avoid hydration mismatches;
- supports multiple trips;
- persists local state under existing `kintrip.*` keys;
- creates high-entropy share codes;
- schedules shared-trip writes;
- merges newer remote state by timestamp; and
- permanently excludes the demo trip from synchronization and account linking.

## 5. Shared-trip sync

Shared trip payloads live in the `kintrip_trips` backend table. Browser clients do not query that table directly.

`src/lib/kintrip/sync.functions.ts` provides public server functions that:

- validate trip identifiers and share-code format;
- reject malformed or payloads larger than 512 KiB;
- require the existing trip's exact share code for updates;
- prevent a share code from being reused for another trip; and
- return an explicit not-found result for unknown codes.

The share code acts as a bearer secret. Anyone holding it can retrieve and update that trip through the current server functions. Account membership improves cross-device discovery but is not the authorization boundary for shared-trip payloads.

## 6. Accounts and authenticated functions

The browser auth client persists sessions. `src/start.ts` attaches the current bearer token to server-function calls. Protected functions use `requireSupabaseAuth`, then use the request-scoped database client so row-level security applies as that user.

Account functions manage:

- the user's own profile;
- the user's own account-linked trip memberships;
- account suspension checks on profile and membership writes; and
- account deletion through a dynamically loaded privileged server client.

Privileged server clients are imported inside handlers from `client.server.ts`. They must never be imported into browser components or used for ordinary user-scoped reads.

## 7. Governance and actions

Product rules live outside route components:

- `governance.ts` — permissions, vote tallies, group fit, fairness, publication checks, and normalization;
- `actions.ts` — state transitions and permission-enforced mutations;
- `engine.ts` — itinerary generation and re-planning;
- `travel.ts` — travel gaps and comfort/meal review;
- `schedule.ts` — hours, access, bookings, and day validation; and
- `access.ts` / `hours.ts` — evidence-aware domain rules.

UI checks improve clarity, but permission-sensitive product actions must also enforce their rules in the action layer.

## 8. Places and maps

`places.functions.ts` exposes a provider-independent place result:

- free mode uses Geoapify when a server key exists and otherwise Nominatim;
- Google mode calls the Lovable connector gateway with server-only credentials;
- both modes return source identity, label, address, coordinates, and a map URL.

Place records keep a stable internal ID independent of provider IDs. The Discover flow applies duplicate detection before adding a result.

`geo.ts` contains Haversine distance and deterministic complete-linkage clustering. `PlaceMap.tsx` renders only in the browser. Tile failure must not break the surrounding list.

`routing.functions.ts` accepts validated coordinates and calls OSRM. It returns explicit unavailable legs on failures instead of invented values.

## 9. Opening hours and access

Hours are stored as venue-local rules with IANA time zones, weekly intervals, dated exceptions, verification state, provenance, and validity dates. Missing records are not treated as open.

Access profiles separate private-car reachability from traveller accessibility. Ordered journey legs can describe parking, walking, bus, shuttle, rail, cable car, ferry, or taxi segments and their evidence.

The scheduler loads these records for the intended visit date. Known impossibilities become blocking conflicts; missing or stale evidence becomes an open question.

## 10. Localization

`src/lib/i18n.tsx` provides English and Simplified Chinese. The current layer translates known interface text and patterns after hydration and remembers the choice in local storage.

When adding user-facing copy:

1. add the English label in the relevant component;
2. add the exact Chinese translation or supported dynamic pattern;
3. verify switching in both directions after reload; and
4. check long labels on narrow screens.

User-entered content is preserved exactly.

## 11. Offline behavior

`vite.config.ts` creates the web app manifest and Workbox runtime rules. `pwa.ts` registers the service worker only in production and unregisters it in development, known previews, embedded frames, or when `?sw=off` is present.

Navigation uses a network-first strategy. Same-origin scripts, styles, fonts, and images use cache-first storage. Current trip state is also stored locally.

Offline support is read-oriented. Do not claim offline maps, live information, conflict-free collaborative offline editing, or remote revocation of already cached data.

## 12. Admin architecture

The two compiled route files are fixed entry points. `AdminGate` asks the server whether the requested path matches `ADMIN_CONSOLE_PATH`; only the configured one renders the console.

The path gate is not authorization. Every admin server function:

- requires an authenticated session;
- resolves the active role through the privileged server client;
- checks an explicit allowed-role list;
- validates inputs; and
- writes an audit record for mutations.

Operator emails in audit rows are stored as salted SHA-256 fingerprints. The console resolves current operator addresses live by account ID for authorized display.

The admin console may manage account status and commercial entitlements. It must not become an unrestricted editor for customer trip content.

## 13. Database migrations

SQL migrations include explicit grants, row-level security, and policies. Every new public table must follow this order:

1. create table;
2. grant only required privileges;
3. enable row-level security; and
4. create policies.

Roles belong in a separate authorization table, never in profiles or browser storage. Security-definer functions must set a safe search path and revoke public execution unless a browser role genuinely needs them.

The checked-in `drizzle/schema.ts` is intentionally empty. Treat the reviewed SQL migration files as the current source of truth for backend additions.

## 14. Extension points

- New route: `src/routes/` plus route metadata and translation coverage.
- New trip field: `types.ts`, `normalizeState()`, demo/empty seeds, actions, and sync-size review.
- New permission: `governance.ts` and action-layer enforcement.
- New place provider: return the existing `PlaceResult` contract from a server-only adapter.
- New route provider: preserve explicit unknown/error states and provenance.
- New admin action: authenticated function, role allowlist, validation, immutable audit entry, and console UI.
- New synchronized feature: explicitly verify the demo exclusion before release.