# English and Simplified Chinese language support

## Goal
Add a language switch for English and Simplified Chinese across CommonRoute, remember the selection on each device, and keep the Japan demo local-only.

## What will change
- Add a compact `EN / 简中` language control to the shared header and the first-run screen so it is always reachable.
- Translate navigation, forms, buttons, alerts, trip setup, invitations, preferences, discovery and voting, consensus, itineraries, re-planning, governance, account pages, updates, print view, errors, and the About page.
- Translate dynamic labels and messages, including roles, vote choices, decision states, costs, publication checks, accessibility labels, and empty/loading states.
- Format dates, times, and counts using the selected locale where the app presents them.
- Remember the language on the device and update the page language for accessibility without causing a loading flicker.
- Keep trip names, traveller names, destinations, notes, and place data exactly as users entered them.

## Technical details
- Add a small typed translation layer with English as the fallback and Simplified Chinese (`zh-CN`) as the second locale.
- Use a React language provider at the app root; read saved browser preference only after hydration, then persist future changes locally.
- Split translations into focused dictionaries where needed so screens remain maintainable.
- Keep URLs, cloud data structure, map providers, account behavior, and Demo-mode isolation unchanged.
- Give each content page localized titles and descriptions.

## Verification
- Walk every route in both languages on mobile and desktop.
- Test switching languages, reloading, account screens, demo flow, forms, voting, itinerary actions, and print view.
- Check for untranslated interface text, overflow, accessibility labels, console errors, and build errors.
