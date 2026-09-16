# No-trip setup experience

## Goal
Add a true first-time state so Kintrip is useful and understandable before any trip exists, while preserving the current Japan demo and saved trips during testing.

## What will change
- Show a welcoming Trip screen when there are no trips, with the fixed Kintrip slogan and two clear choices: **Create your first trip** or **Join a trip**.
- Hide trip-only navigation and offline-itinerary messaging until a trip exists, so users cannot enter empty Discover, Itinerary, or Family screens.
- Add a **Test first-time setup** action on My Trips. It temporarily stores the current trips and opens the no-trip experience.
- Add **Restore previous trips** during test mode, so testing does not destroy the Japan scenario or other saved trips.
- Ensure completing Create Trip exits the no-trip state and continues naturally to inviting family members.
- Make My Trips itself display an appropriate empty state rather than an empty list.

## Technical details
- Extend the local trip store to support an empty collection and a temporary backup for first-time-flow testing.
- Add safe hooks/actions for checking whether a trip exists, entering test mode, and restoring backed-up trips.
- Update the shared app frame and the Trip/My Trips pages to render from that state without assuming an active trip.
- Keep the existing multi-trip data format and automatic migration intact.

## Verification
- Enter first-time test mode from My Trips and confirm the empty Trip screen appears.
- Create a trip and confirm the setup continues to Invite Family.
- Re-enter test mode and restore the previous trips, confirming the Japan sample returns unchanged.
- Check the experience at mobile and desktop widths and confirm there are no browser errors.
