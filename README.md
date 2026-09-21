# Welcome to your Lovable project

CommonRoute is a remix of [Kintrip](https://github.com/ernestsee/kintrip), a collaborative trip planner originally built for multi-generational families.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Open your project in the [Lovable editor](https://lovable.dev) and keep building.

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: connect the project to GitHub and every change made in Lovable is committed straight to your repository.
- **Full ownership**: this code is yours. Push to your repository and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

## Built with

- TanStack Start
- TypeScript
- React
- Tailwind CSS

## Internal admin console (forks)

This project ships an internal operations console for reviewing accounts,
pausing or restoring access, and managing access grants. It is never linked
from the app and is excluded from search engines.

The console is served at the path set in the `ADMIN_CONSOLE_PATH` environment
variable (for example `/ops/console`). If the variable is not set, the console
is served at the documented default:

```
/admin/admin
```

**If you fork or remix this project, set `ADMIN_CONSOLE_PATH` to your own
unlisted path before going live.** Both `/admin/admin` and `/ops/console`
exist in the code, but only the configured path answers with the console —
every other path returns a plain "page not found".

The address is only an extra layer of obscurity, not the protection itself:
every console action requires a signed-in operator account, and the first
operator is bootstrapped by the `ADMIN_BOOTSTRAP_EMAIL` environment variable
(the first person who signs in with that email becomes the super admin).
