# Roadmap

- [x] CSV/ICS export: per-trip and per-day CSV, calendar (.ics) export, share-sheet friendly output (PRD v1.0)


- [x] Redesign Kintrip as a phone-first experience matching the supplied visual reference; adapt cleanly to larger screens.
- [x] Apply the approved UI/UX refinements across navigation, readability, Discover, Consensus, Family, and desktop layouts.
- [x] Make the no-trip home a mobile-first trip setup screen; keep the existing planning dashboard inside Demo mode.
- [x] Add a clear Demo-mode return action that restores the editable starting page.
- [x] Keep Back to start visible on every Demo screen and reduce expensive mobile blur effects.
- [x] Match the starting screen to the supplied setup reference and keep Japan exclusively in Demo mode.
- [x] Link the managed Google Maps Platform connection to the remixed project.
- [x] Verify Discover search pulls real Google Places results.
- [x] Rebrand the complete product as CommonRoute while preserving all existing functionality and local-only Demo mode.

- [x] Organiser governance: roles, review queue, decision reasons, sponsor money decisions, needs/hard limits, group fit, publishing checks, locked stops
- [x] Group updates inbox, everyone-gets-a-win check, per-place fit detail, split-a-day between two groups, printable plan / PDF
- [x] Passwordless accounts: email-link sign in, profile name, trips saved to your account across devices (PRD v2.1 P0)
- [x] PRD v2.1 follow-ups: place coordinates + source captured, duplicate shortlist prevention, trip currency choice, better free map search, email change / sign out everywhere / close account
- [x] English / Simplified Chinese language switch and complete interface translation
- [x] PRD v2.2 Phase A: helped travellers (F01), Today and simple view (F02), bookings and stay (F03), shared jobs and packing (F04)
- [x] PRD v2.2 Phase B (F05–F08): change summaries and acknowledgement, travel buffers, comfort/meal planning, personal attendance
- [x] Admin console v1.0: operator roles, account review + suspend/restore, entitlement grants, promo codes, audit log
- [x] Maps, scheduling and access: map view with category pins, nearby grouping, driving times, opening hours per visit date, car access and onward journeys, whole-day check
- [x] Public repository documentation: product guide, fork setup, architecture, security, contribution rules, and refreshed README
- [x] Paid features C1 (PRD v1.0, excluding P02/P05/P09/P11/P12 and tax): group questions and deadlines (P01/P03/P04), stay comparison (P06), plan alternatives (P07), cost-aware re-planning (P08), starter lists (P10), one-off Trip Plus pass with allowances and refund-safe usage counting (P14), promo redemption (P15), plans page (P16), private counts view in the operations console (P17), disclosed outside links (P18)
- [x] Responsive interface audit and cleanup across phone and desktop layouts, shared navigation, date entry, and touch targets.

## Trip coordination (built)

- TC02 offline pack — `/offline`, device-only, checksum verified, no central tracking
- TC03 rooms and vehicles — `/logistics`, capacity and accompaniment rules, private room numbers
- TC05 private break requests — `/breaks`, note seen only by named handlers, group sees times only
- TC06 booking dependencies — `/dependencies`, cycle detection, waivers with reason
- TC07 after-trip learning — `/feedback`, two separate explicit consents, deletable
- Gap items — split-day subgroups (Itinerary), organiser day note (Today), contact cards (Logistics), check-out sweep list (Getting ready)
- Not built by decision: TC01 meetup check-ins and TC04 activity questions (messaging and tracking dropped)
