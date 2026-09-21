# CommonRoute Documentation Refresh

## Goal
Create an accurate, GitHub-friendly documentation set for people evaluating, forking, operating, or contributing to CommonRoute, without exposing the currently published private admin path or any credentials.

## Documentation changes
- Rewrite `README.md` as the repository entry point: product summary, screenshots/features overview, quick start, supported deployment paths, configuration checklist, project status, and links to detailed guides.
- Add `docs/PRODUCT.md` covering the intended users, complete planning journey, shipped capabilities, roles and governance, accounts, demo behaviour, languages, offline behaviour, admin operations, and honest limitations/deferred work.
- Add `docs/SETUP.md` with a reproducible fork guide: prerequisites, install commands, environment-variable reference, database migrations, passwordless email-link setup, optional maps providers, routing/tile dependencies, admin bootstrap, local development, deployment, and post-deployment checks.
- Add `docs/ARCHITECTURE.md` explaining the app structure, data flow, trip storage and sync, authentication boundaries, server functions, maps/scheduling modules, localisation, PWA cache, migrations, and where to extend each area.
- Add `docs/SECURITY.md` documenting the current trust model, share-code access, row-level policies, privileged server operations, operator authorization, audit email fingerprinting, secret handling, account suspension/deletion, known trade-offs, and a safe disclosure process.
- Add `docs/CONTRIBUTING.md` with branch/change expectations, formatting and checks, migration requirements, translation requirements, metadata requirements, accessibility expectations, and the local-only demo invariant.
- Update the code-facing routes guide where needed so it reflects the current routing and metadata conventions.

## Accuracy and safety
- Derive all claims from the current implementation and migrations; distinguish shipped, optional, and deferred capabilities.
- Use placeholders only—never copy project URLs, database identifiers, API keys, emails, salts, or other credentials.
- Document `/admin/admin` as the default fork console path and `ADMIN_CONSOLE_PATH` as configurable; do not publish the production console path.
- State clearly that an unlisted path is not an authorization control and that operator authentication remains mandatory.
- Correct unsafe or inaccurate setup guidance, including server/client environment-variable boundaries and the external backend steps required by non-Lovable forks.

## Validation
- Check every internal documentation link and referenced command/file path.
- Search the new public docs for secrets and the production-only console path.
- Confirm documentation-only changes leave the app build clean.
