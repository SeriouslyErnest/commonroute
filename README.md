# CommonRoute

CommonRoute is a remix of [Kintrip](https://github.com/ernestsee/kintrip), a collaborative trip planner originally built for multi-generational families. It helps groups plan a trip together, vote on places, and produce one fair, shareable itinerary.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Open your project in the [Lovable editor](https://lovable.dev) and keep building.

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: connect the project to GitHub and every change made in Lovable is committed straight to your repository.
- **Full ownership**: this code is yours. Push to your repository and your changes sync back into Lovable, ready for your next prompt.

## Running your own copy

These instructions are for anyone forking or remixing the code outside the original project.

### 1. Clone and install

```sh
git clone <your-forked-repository-url>
cd <repository-name>
npm install
npm run dev
```

The app expects a Lovable Cloud / Supabase backend. If you are using a fresh backend instance, run the migrations in `drizzle/migrations/` in order and regenerate types before starting the dev server.

### 2. Required environment variables

Create a `.env` file in the project root with at least these values:

```env
VITE_SUPABASE_URL=https://<your-project>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<your-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
```

The service-role key is used only by server functions (never in the browser) for privileged operations such as admin account lookup and account deletion.

### 3. Configure passwordless sign-in

The app uses passwordless email-link sign-in only. In your Supabase project:

1. Go to **Authentication > Providers** and enable **Email**.
2. Disable **Confirm email** if you want a smooth magic-link flow, or keep it enabled and configure your email templates.
3. Add your preview and production domains to **Authentication > URL Configuration > Redirect URLs**.
4. Set **Site URL** to the root of your deployed app (for example `https://commonroute.lovable.app`).

When a new user signs in, a `profiles` row is created automatically by the `handle_new_user` database trigger.

### 4. Configure the admin console

The app ships an internal operations console for reviewing accounts, pausing or restoring access, and managing complimentary access or trials.

#### Set the console path

Choose an unlisted path and set it in your environment:

```env
ADMIN_CONSOLE_PATH=/ops/console
```

If `ADMIN_CONSOLE_PATH` is not set, the console defaults to `/admin/admin`. The other built-in route (`/admin/admin` or `/ops/console`, whichever is **not** configured) will return a plain "page not found".

> **Important:** the path is only an extra layer of obscurity, not the protection itself. Every console action still requires a signed-in operator account.

#### Bootstrap the first operator

Set the email address that should become the first super admin:

```env
ADMIN_BOOTSTRAP_EMAIL=you@yourdomain.com
```

The first person who signs in with that exact email address is automatically promoted to `super_admin`. After that, you can add other operators from the **Operators** tab in the console.

#### Optional: hash salt for the audit log

Admin actions are written to a permanent audit log. Operator emails are stored as a one-way salted hash rather than plain text. If you want a different salt from the default, set:

```env
ADMIN_EMAIL_HASH_SALT=<a-long-random-string>
```

If this is not set, the app generates and uses a stable fallback value. Changing the salt later will break the ability to correlate historical audit entries with current operators.

### 5. Promotions (optional)

If you want to offer promo codes or trials, create promotions from the admin console. Customer redemption is not wired up by default — add the public redemption flow only when you are ready to sell or give away access.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
npm i
npm run dev
```

## Built with

- TanStack Start
- TypeScript
- React
- Tailwind CSS
- Lovable Cloud

## Demo mode

The Japan "Tan Family" sample trip is local-only. It never syncs to the cloud and never requires sign-in, so anyone can preview the features without affecting real trips.
