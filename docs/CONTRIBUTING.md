# Contributing to CommonRoute

## Before changing the project

Read:

- [Product guide](PRODUCT.md)
- [Architecture](ARCHITECTURE.md)
- [Security](SECURITY.md)
- [Fork and deployment setup](SETUP.md)

Keep changes focused. Preserve existing user data and routes unless a migration or product decision explicitly requires otherwise.

## Development workflow

```sh
bun install
bun run dev
```

Before opening a pull request:

```sh
bun run format
bun run lint
bun run build
```

Test the central flow in a real browser, not only by inspecting source or loading empty states.

## Non-negotiable product invariants

- The Japan demo is local-only. It must never upload, download, or appear in account memberships.
- Sign-in is passwordless by email link unless a separately approved product change says otherwise.
- Real-trip participants answer and vote only as themselves or for an explicitly assigned assisted traveller.
- Helping a traveller never grants owner, organiser, or sponsor authority.
- Unknown opening, route, access, dietary, or accessibility information remains unknown.
- Planning approval, sponsor approval, and booking confirmation are distinct.
- User-facing language should refer to a group, families and friends—not assume every group is a family.
- Existing `kintrip_*` database names, local-storage keys, and internal module identifiers remain for compatibility unless a migration plan explicitly changes them.

## Routes

- Use TanStack file-based routes under `src/routes/`.
- Do not add React Router, `src/pages`, or an application-level page switcher.
- Parent/layout routes must render `<Outlet />`.
- Do not edit `src/routeTree.gen.ts`.
- Create every route referenced by a link in the same change.
- Every content route needs an app-specific title, description, Open Graph title/description, `og:type`, and Twitter card metadata.
- Internal operations routes must remain `noindex, nofollow`.

## Components and styling

- Reuse the shared Button and product UI components for interactive controls.
- Use semantic design tokens rather than hardcoded colours in page components.
- Preserve light and automatic dark themes.
- Maintain at least 44 px touch targets; use 48 px for Simple view's primary actions.
- Ensure keyboard focus is visible and meaning does not depend on colour alone.
- Check narrow phone layouts, large text, Simplified Chinese, and reduced motion.

## State and domain changes

When adding a field to `KintripState`:

1. update `src/lib/kintrip/types.ts`;
2. backfill it in `normalizeState()`;
3. update empty and demo seed data;
4. add permission-enforced actions;
5. review sync payload size and old-cache compatibility;
6. translate all new interface states; and
7. test the demo exclusion.

Do not create a second store for a feature that belongs to a trip.

Use stable internal place IDs independent of provider IDs. At provider boundaries, validate longitude/latitude order, preserve provenance, and return explicit unknown/error states.

## Authentication and server functions

- Import `createServerFn` from `@tanstack/react-start`.
- Protected functions use `requireSupabaseAuth`.
- Never call a protected function from a public route loader.
- Read server environment variables inside handlers.
- Import privileged server clients dynamically only after authorization.
- Validate all external input.
- Preserve provider status and useful failure text without leaking credentials.

## Database migrations

For every new public table, use this order in the same migration:

1. `CREATE TABLE`;
2. explicit `GRANT` statements;
3. `ENABLE ROW LEVEL SECURITY`;
4. policies.

Grant only what policies permit. Include the server role for trusted server operations. Never grant anonymous access unless the feature deliberately supports anonymous reads and has a matching narrow policy.

Store authorization roles in a dedicated role table, never in profiles or browser storage. Security-definer functions must set `search_path` and have explicit execution grants.

Do not edit an applied production migration casually. Add a forward migration and document its rollout and rollback.

## Translations

English is the source interface language and Simplified Chinese is supported.

For every user-facing addition:

- add its exact translation or dynamic translation pattern;
- include buttons, errors, empty states, notifications, accessibility names, and metadata;
- preserve user-entered content;
- verify switching both directions and persistence after reload; and
- check for overflow at phone widths.

## Documentation

Update documentation in the same pull request when a change affects:

- configuration or environment variables;
- database migrations;
- user-visible capabilities or limitations;
- authentication or authorization;
- external providers;
- data retention or privacy; or
- deployment and operations.

Never put a production-only console path, secret, real account identifier, or private service URL in public documentation.

## Pull request checklist

- [ ] Scope is limited to the requested change.
- [ ] Existing trips and older local caches still normalize.
- [ ] Action-layer permissions match the interface.
- [ ] Demo mode remains local-only.
- [ ] English and Simplified Chinese are complete.
- [ ] Phone, desktop, keyboard, and large-text layouts work.
- [ ] Every new route has complete metadata.
- [ ] New tables have grants, row-level security, and policies.
- [ ] Secrets remain server-only.
- [ ] Lint and production build pass.
- [ ] The primary user flow was tested end to end.
- [ ] Product, setup, architecture, or security docs were updated where needed.