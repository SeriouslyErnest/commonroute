# Responsive interface cleanup

## Changes

- Rework the shared header so the CommonRoute identity remains visible on small phones, secondary actions no longer collide, and account/trip controls stay easy to tap.
- Increase undersized language, filter, link, and itinerary controls to mobile-friendly tap targets without making desktop layouts bulky.
- Make trip date fields stack cleanly on narrow screens and keep navigation labels stable when text sizing is increased.
- Widen and rebalance the shared navigation and selected content layouts on desktop so the larger canvas is used more effectively.
- Remove any remaining horizontal-edge risk from full-width imagery and keep the floating navigation clear of final page content.

## Validation

- Check welcome, trip home, Discover, Itinerary, Group, planning tools, pricing, and About at small-phone and desktop sizes.
- Confirm there is no horizontal overflow, clipped text, overlapping controls, inaccessible final content, or new console errors.
- Check both English and Simplified Chinese layouts and confirm the project still builds successfully.

## Technical details

- Keep the current CommonRoute visual system, routes, data, permissions, and local-only demo behavior unchanged.
- Use existing semantic colour tokens and shared controls; this is presentation-only work with no backend or product-logic changes.
