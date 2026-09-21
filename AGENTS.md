<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## CommonRoute contributor context

Before changing product behavior, read `docs/PRODUCT.md`, `docs/ARCHITECTURE.md`,
`docs/SECURITY.md`, and `docs/CONTRIBUTING.md`. Fork and deployment requirements
are documented in `docs/SETUP.md`.

Preserve these invariants in every change:

- The Japan demo is local-only and is never synchronized or linked to an account.
- Real-trip participants act only as themselves or an explicitly assisted traveller.
- Unknown route, hours, access, dietary, and accessibility data stays unknown.
- Product permissions are enforced in the action/server layer, not only hidden in the UI.
- English and Simplified Chinese, route metadata, mobile accessibility, and older-trip normalization ship with each user-facing feature.
- Secrets remain server-only; operator roles remain in a separate table and are verified server-side.
- Every new public table includes explicit grants, row-level security, and policies in the same migration.
- Public documentation never names a production-only console path, real operator identity, credential, or private service URL.
