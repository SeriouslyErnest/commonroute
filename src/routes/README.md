# Routes

CommonRoute uses TanStack Start file-based routing. Every route belongs under this directory; do not create `src/pages/`, add React Router, or build a manual page switcher.

## Naming

| File | URL |
| --- | --- |
| `index.tsx` | `/` |
| `about.tsx` | `/about` |
| `users/index.tsx` | `/users` |
| `users/$id.tsx` | `/users/:id` |
| `posts/{-$category}.tsx` | `/posts/:category?` |
| `files/$.tsx` | `/files/*` (read via `_splat`) |
| `_layout.tsx` | Pathless layout; must render `<Outlet />` |
| `__root.tsx` | Shared document shell; must render `<Outlet />` |

`src/routeTree.gen.ts` is generated automatically. Never edit it.

## Route requirements

- Create the target route in the same change as any new `Link`, `navigate`, or redirect.
- Use `Link` and router navigation instead of manual URL switching for internal pages.
- Keep browser-only packages behind a dynamic import and client-only rendering boundary.
- Avoid protected server functions in public route loaders; call them from authenticated components or protected route trees.
- Preserve the shared shell, locale provider, query client, and error boundaries in `__root.tsx`.

## Metadata

Every content route defines its own `head()` metadata:

- unique CommonRoute title;
- unique description;
- `og:title`;
- `og:description`;
- `og:type`;
- `twitter:card`.

Only add social images when the route displays a meaningful absolute HTTPS image URL. Internal operations routes use `robots: noindex, nofollow` and deliberately generic metadata.

## Operations console routes

Two fixed routes are compiled for the configurable console entry point:

- `/admin/admin` — documented default for forks;
- a separate private deployment route retained for the hosted installation.

`ADMIN_CONSOLE_PATH` decides which route is active. The inactive route returns a generic not-found page. Never add the hosted installation's private path to public documentation.

The path gate is not authorization. Every console server action must continue to require a signed-in operator and an allowed server-side role.