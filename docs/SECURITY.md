# Security Guide

## Supported security model

CommonRoute combines three different access models:

1. **Account data** uses authenticated sessions and row-level database policies.
2. **Shared trip data** uses a high-entropy invite/share code as a bearer secret.
3. **Operations data** uses authenticated operator roles checked by server functions with a privileged server client.

An unlisted URL is never treated as authorization.

## Secrets

Server-only secrets include:

- service-role database keys;
- database migration URLs;
- connector and gateway keys;
- `TELEGRAM_BOT_TOKEN` and `TELEGRAM_WEBHOOK_SECRET` (protected server secrets only — never in source, frontend variables, database tables, logs, screenshots, or docs);
- `ADMIN_BOOTSTRAP_EMAIL`;
- `ADMIN_EMAIL_HASH_SALT`; and
- any private provider API key.

Non-secret Telegram configuration (`TELEGRAM_BOT_USERNAME`, the bot's display name, and public deep links) may live in ordinary configuration.

Never:

- prefix a server secret with `VITE_`;
- import the privileged server client into a React component;
- put secrets in a query string, route metadata, screenshot, issue, or test fixture;
- commit `.env` or `.env.local`; or
- log complete provider error bodies if they may contain credentials or personal data.

Publishable browser keys are not authorization. Their safety depends on row-level security and narrow grants.

## Shared-trip access

The current invite code is ten characters from a 32-symbol alphabet, generated with the platform cryptographic random source when available. The server verifies that:

- a code cannot point to two trips;
- an existing trip cannot be overwritten with another code;
- identifiers match narrow formats; and
- serialized state does not exceed 512 KiB.

The code is no longer a bearer credential. Holding it reveals only the trip title (rate-limited). Reading or writing a trip requires a signed-in account with an `approved` row in `trip_access` (or being the trip's `owner_user_id`). Invitees file a `pending` request; organisers approve, decline or remove people through permission-checked server functions. On approval the server adds the person's own traveller to the trip, and their device acts as that traveller. Declined or removed people lose access on their next sync. Changing the code stops new requests only; approved people keep access.

- Only organisers can list requests; requester emails are stored masked.
- Organiser checks for code rotation, deletion and access decisions run on the server.
- Avoid putting sensitive passport, card or medical details into shared trip text.

The current implementation does not provide per-member server-side authorization for every field inside the shared JSON trip payload. UI and action-layer rules enforce product roles, while the share code protects the aggregate. A higher-assurance deployment should migrate shared entities to membership-scoped rows with field-level policies.

## Account security

- Sign-in links are time-limited and sent by the configured authentication provider.
- Return paths accept only same-origin paths, preventing open redirects.
- Protected server functions require the attached session token.
- CSRF middleware covers server-function requests.
- Profile and membership tables restrict users to their own rows.
- Global sign-out is available.
- Suspended accounts are blocked from profile and membership writes.
- Closing an account deletes its profile, membership list, and sign-in identity; shared trip data remains.

Email-link security depends on control of the email account. Operators should configure secure email delivery, short link lifetimes, allowed redirect origins, and abuse controls with their authentication provider.

## Admin console

The console path defaults to `/admin/admin` for forks and can be changed with `ADMIN_CONSOLE_PATH`. Do not publish a production installation's chosen path in public documentation.

Every admin function independently requires:

- a valid authenticated account;
- an active row in the operator table;
- a permitted role; and
- validated input.

Roles are:

- `super_admin`;
- `billing_admin`;
- `support_admin`; and
- `read_only_admin`.

Only super admins manage operators and suspend or restore accounts. Commercial operations are limited to super and billing admins where appropriate. Read-only admins cannot mutate data.

Admin operations are audited. The database does not retain readable operator email addresses in audit rows: it stores a salted SHA-256 fingerprint. Authorized console views resolve current account emails live from the operator's account ID. Changing the salt breaks historical fingerprint correlation.

The operator and audit tables are server-only. Browser roles must not be granted access. Security-definer helper functions have public execution revoked.

## Database rules

- Enable row-level security on every public user-facing table.
- Add explicit grants before policies; row-level policies do not create Data API privileges by themselves.
- Keep authorization roles separate from profiles.
- Never make a role decision from browser storage or a client-provided claim alone.
- Use the request-scoped authenticated client for ordinary reads and writes.
- Use the privileged client only after authenticating and authorizing the caller.
- Review all migration files before applying them.

The historical `0002_seed_test_super_admin.sql` migration is development-only and must not be applied to a new deployment.

## Maps and external services

- Provider calls using private credentials run in server functions.
- User input is length-limited and validated before provider calls.
- Coordinates are range-validated before routing.
- Routing failures return unavailable rather than a plausible-looking estimate.
- External links open with `noreferrer` where used in a new tab.
- Map tile attribution must remain visible.

Public Nominatim, OpenStreetMap tiles, and the OSRM demonstration service have usage policies and capacity limits. Production operators must select appropriate providers and comply with their terms.

## Personal and sensitive information

CommonRoute can hold names, relationships, preferences, constraints, attendance, booking summaries, and private planning notes. It is not designed to store:

- passports or identity documents;
- payment-card details;
- precise continuous location history;
- medical records; or
- unencrypted booking documents.

Private-field visibility in the interface is not equivalent to cryptographic isolation inside the current aggregate trip payload. Avoid highly sensitive free text and review the field-level storage model before regulated or high-risk use.

## Offline data

Trip state and published pages may remain on a device after access changes. A device that is offline cannot receive immediate revocation. Signing out should be part of any shared-device procedure, but operators should not promise remote deletion of already cached offline data.

## Dependency and release checks

Before release:

```sh
bun install
bun run lint
bun run build
```

Also run the workspace dependency and security scanners, inspect newly introduced packages, and test both authorized and unauthorized paths. Do not upgrade server-framework packages blindly; verify production runtime compatibility.

## Reporting a vulnerability

Do not disclose a suspected vulnerability in a public issue. Contact the repository owner privately with:

- the affected version or commit;
- reproduction steps;
- impact;
- whether data or credentials may have been exposed; and
- a suggested mitigation, if known.

Repository owners should add a private security contact or GitHub Security Advisory process before public launch.
## Sign-up approval and operator sign-up alerts

- `account_approvals` (own-row read only) records each account's approval state and first entry; `app_settings` is server-only. Existing accounts were grandfathered as approved.
- With approval switched on, new accounts see a holding screen and account-level writes are refused server-side until an operator approves them. Operators are never gated.
- Two independent Telegram alerts (new sign-up waiting; first entry into the app) go only to active operators' destinations with the accounts category on. Emails are masked. No Telegram message ever contains a link to the operations console.

## Operator authenticator step (TOTP)

Every operator must complete an authenticator-app (TOTP) step before the console opens. The first visit shows a setup QR code; later visits ask for the 6-digit code. Every admin and operator Telegram server function refuses sessions that have not completed this step (`aal2`), so hiding the screen is not the control. Travellers never see it — their sign-in stays email-link only.
