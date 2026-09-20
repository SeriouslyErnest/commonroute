# CommonRoute Rebrand

## Goal
Rebrand the existing KINTRIP product as **CommonRoute** while preserving all routes, saved trips, cloud sharing, map search, voting, itinerary, offline, and demo behaviour.

## What will change
- Replace every user-facing KINTRIP/Kintrip reference with **CommonRoute** and use the tagline **“Plan together. Find your common route.”** where the PRD calls for it.
- Add the supplied PNG as the temporary production logo, create a compact favicon from its symbol area, and update headers, the setup screen, welcome page, footer, alt text, metadata, theme colour, and PWA identity.
- Replace the current turquoise/cobalt/coral visual system with the PRD’s central blue–teal–green and navy tokens, including complete light and device-preference dark themes.
- Standardise typography on Nunito Sans, 12–16px control/card radii, subtle borders and shadows, 44px touch targets, and visible keyboard focus.
- Restyle shared controls first, then apply the new states across setup, dashboard, invitations, profiles, Discover/voting, consensus, itinerary, replanning, offline messages, trip list, and demo mode.
- Keep trip photography prominent, add a visible `Demo trip` badge, and update copy so CommonRoute clearly serves families **and friends** rather than only kin.

## Technical details
- Keep existing `kintrip_*` database names, storage keys, module paths, cache identifiers, API contracts, and server functions unchanged unless text is displayed to users.
- Preserve the Japan demo as local-only; no rebrand work will alter its cloud-sync exclusion.
- Use semantic Tailwind tokens in the global theme instead of hardcoded screen colours.
- Add automatic dark mode using the device preference, without introducing a manual theme control.
- Use the supplied PNG at supported sizes; do not invent a final vector logo. The production SVG variants remain a future brand-asset task.

## Validation
- Search all user-facing surfaces for legacy naming while leaving intentional internal identifiers intact.
- Check every content page has CommonRoute-specific title, description, Open Graph title/description, `og:type`, and Twitter card metadata.
- Verify core flows and visual states at approximately 360px, 768px, and 1440px, in light and dark themes.
- Check touch targets, keyboard focus, contrast, long labels, selected voting states, offline messaging, and logo sizing.
- Confirm the preview builds cleanly and that existing trip creation, demo entry/exit, discovery, voting, itinerary, replanning, and shared-trip behaviour remain intact.

## Not included
- No new product functionality from the future feature expansion yet.
- No database or API renaming.
- No map-provider replacement.
- No trademark/domain work or claim that the supplied PNG is a final production SVG.
