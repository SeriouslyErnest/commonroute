# CommonRoute Product Guide

Last reviewed: 21 September 2026

## 1. Product overview

CommonRoute helps a group turn different interests, budgets, energy levels, mobility needs, and fixed commitments into one practical trip plan.

The product is designed for:

- multi-generational families;
- groups of friends;
- organisers coordinating people with different comfort or access needs;
- travellers who want to participate directly; and
- children or assisted travellers whose answers are entered by a named adult.

The core product principle is: **everyone can contribute, practical needs outrank popularity, and the organiser retains control of the published plan.**

## 2. Typical journey

1. **Start a trip.** Enter the destination, dates, and group size.
2. **Invite the group.** Share the trip's invite link or code.
3. **Gather preferences and needs.** Travellers record interests, pace, walking comfort, rest needs, and constraints.
4. **Discover and vote.** Search for places and vote using must-go, would-like, don't-mind, or skip.
5. **Review choices.** Organisers approve, decline, or keep suggestions as backups; sponsors decide on shared spending.
6. **Build the itinerary.** CommonRoute recommends one area-aware plan with meals, rests, travel time, and fixed commitments.
7. **Check and publish.** Fairness, opening hours, travel feasibility, access evidence, bookings, and unresolved questions are reviewed before publication.
8. **Travel together.** Today view shows what is next, where to meet, how to get there, who is coming, booking summaries, and the group's stay.
9. **Respond to change.** Re-plan a day, preserve locked stops, split into subgroups, or publish a revised version with a change summary.

## 3. Accounts and membership

- Sign-in uses a time-limited link sent by email. There is no password and no code to type.
- A person can create or join a trip without signing in, but signing in links non-demo trips to their account for use across devices.
- Accounts have a display name and sign-in email.
- People can change their email, sign out locally or globally, and close their account.
- Closing an account removes its profile and saved membership list. Shared trip content remains available to the rest of the group, and local device data is not automatically erased.
- The Japan demo never links to an account.

## 4. Collaboration and governance

### Roles

Trip roles are separate from assisted-traveller relationships:

- **Owner** — final ownership and publication authority.
- **Organiser** — manages the planning workflow and group decisions.
- **Sponsor** — approves or declines shared spending assigned to them.
- **Contributor** — participates in planning and voting.
- **Viewer** — can follow the plan without editing it.

A traveller may hold more than one role. Helping another traveller does not grant organiser, owner, or spending authority.

### Decisions

Suggestions move through explicit states such as suggested, under review, provisionally approved, sponsor approval required, approved, backup, declined, booked, or cancelled.

Organisers can:

- review suggestions individually or in bulk;
- record a public decision reason and an optional private note;
- set the group decision mode and vote threshold;
- maintain a trip currency and shared budget;
- protect fixed or important itinerary stops; and
- see a history of material planning actions.

Planning approval, funding approval, and booking confirmation remain separate decisions.

### Fairness and group fit

CommonRoute presents:

- vote totals and per-place group-fit detail;
- needs and hard-limit warnings;
- an "Everyone gets a win" check;
- publication checks that must be resolved or acknowledged; and
- day-level energy, comfort, meal, and travel checks.

Profiles marked as unable to vote are excluded from vote denominators but remain included in care-needs and fairness checks.

## 5. Assisted travellers

An organiser can add a child or another traveller without requiring that person to have an account.

- Each traveller is self-managed or assisted by a named adult.
- The adult must accept help, or the helper must confirm responsibility for a dependent.
- The helper can answer only for assigned travellers.
- Proxy-entered needs and votes record who entered them and for whom.
- Assistance can be revoked; previous history remains.
- A non-voting profile can still hold care needs.
- Claiming a profile later should preserve the traveller's existing participation rather than create a duplicate person.

## 6. Places, maps, and voting

### Search providers

Discover supports two place-search modes:

- **Free map search** — the default; uses Geoapify when configured, otherwise OpenStreetMap Nominatim.
- **Google Maps** — optional and available when the Google Maps connector is configured.

Search is scoped by the active trip destination and returns up to eight results. Saved places retain a stable internal ID plus their source, provider identifier, coordinates, map link, search query, and capture time where available. Duplicate provider records and close same-name matches are rejected.

### Map and grouping

The map shows shortlisted attractions and eateries with lettered pins so meaning does not depend on colour alone. Users can:

- filter attractions and eateries;
- group only the currently shown places by straight-line distance;
- choose a threshold from 0.5 km to 10 km;
- rename groups or move places between them; and
- keep places without valid coordinates in an explicit Ungrouped section.

Groups are planning aids, not automatically assigned itinerary days. OpenStreetMap raster tiles are used for the current map display.

## 7. Scheduling and access

CommonRoute stores venue-local opening-hour evidence, exceptions, last admission or food-order offsets, verification state, source, and checked date. It resolves hours against the intended visit date and venue time zone.

The day checker distinguishes:

- open for the visit;
- closed on the selected date;
- visit exceeds closing time;
- last admission missed;
- hours need verification; and
- hours unknown.

Driving-time checks currently use the public OSRM routing service. A routing failure is shown as unavailable rather than replaced with a fabricated estimate.

Access profiles can describe:

- direct private-car access;
- park-and-transfer journeys;
- restricted or prohibited private-car access;
- gateways and parking notes;
- ordered outward and return legs;
- last departures and return deadlines;
- walking distance, steps, and transfer buffers; and
- reported evidence for step-free, wheelchair, or stroller suitability.

Unknown access information remains unknown. Car access is never treated as proof of traveller accessibility.

## 8. Itinerary and day-of travel

The itinerary engine uses approved places and group constraints to recommend a day-by-day plan. Organisers can edit, lock, split, rejoin, unpublish, or re-publish the plan.

Today view uses the published itinerary and provides:

- Next, Later, and Done sections;
- destination-local meeting times;
- addresses and external map links;
- group-recorded booking summaries;
- attendance responses;
- travel-time guidance;
- a Find our stay card; and
- version/change acknowledgement.

Simple view increases text and control sizes and reduces the number of visible actions. It is not described as an age-specific mode.

Publishing a changed plan creates a summary. Each traveller can acknowledge that version.

## 9. Bookings, jobs, and packing

Bookings are manually recorded and may include type, title, provider link, status, local start/end time, IANA time zone, covered travellers, location, owner, cancellation deadline, and linked itinerary stop.

- A confirmed timed booking is treated as a fixed point.
- Moving a linked stop requires explicit acknowledgement.
- Group-visible summaries are separate from restricted confirmation references.
- The product does not store passport or payment-card details.
- Cancelling a booking removes the confirmed state and flags the plan for review.

Getting ready combines:

- jobs with one accountable assignee, helpers, a deadline, acceptance, decline, completion, cancellation, and reversible completion; and
- personal, assisted-traveller, and shared packing items with needed, committed, and packed quantities.

Private care items are intended to remain personal or helper-visible.

## 10. Languages and accessibility

- Interface languages: English and Simplified Chinese.
- The selected language is remembered on the device.
- User-entered names, notes, destinations, and place content are not machine-translated.
- The visual system uses large touch targets, visible focus states, light and automatic dark themes, and reduced-motion support.
- Pin meaning includes letters and labels rather than relying only on colour.

## 11. Offline and demo behavior

The published app registers a service worker and caches navigations and same-origin assets. Saved trip state also lives on the device.

Offline support is designed for reading the most recently saved itinerary and Today information. Live provider data cannot refresh while offline, collaborative conflict-free offline editing is not guaranteed, and map tiles are not promised for offline use.

The Japan demo:

- is loaded only on the current device;
- never uploads to shared-trip storage;
- never appears in an account membership list; and
- can be reset without touching real trips.

This local-only rule is a permanent product invariant.

## 12. Internal operations console

The unlinked operations console supports:

- account search and review;
- account suspension and restoration;
- complimentary and trial grants;
- promotion creation and status changes;
- append-only operator action records; and
- super-admin management of operator roles.

The available operator roles are super admin, billing admin, support admin, and read-only admin. The console never serves as a trip-content editor.

The console address is configurable. Its obscurity is only a minor defence-in-depth measure; every operation requires a valid session and an authorized server-side operator role.

## 13. Current limitations

The following are not part of the current implementation:

- payments, booking checkout, or expense settlement;
- customer-facing promotion redemption;
- automatic booking import, mailbox access, OCR, or ticket storage;
- in-app group chat or a social feed;
- continuous location tracking;
- live traffic, transport disruption alerts, or a worldwide transit timetable engine;
- turn-by-turn navigation or voice guidance;
- guaranteed accessibility, dietary safety, opening status, or availability;
- offline map downloads;
- automated restaurant reservations; and
- the optional nearby-eatery recommendation module described in the maps roadmap.

Provider coverage and quality vary by destination. Missing or unverified data is intentionally shown as unknown instead of being guessed.
## Paid features (C1)

Planning together stays free: group questions, deadlines and readiness, starter
packing/job lists, the full itinerary, re-planning and exports.

One optional purchase, **Trip Plus**, covers a single trip and adds three
advanced tools: comparing places to stay, comparing alternative versions of a
plan, and showing the money already committed when a day is re-planned. Each
trip with a pass gets a fixed allowance of advanced runs; a run that fails is
never counted. Every trip may try one advanced run before buying.

No payment provider is connected yet, so checkout records the request and says
so plainly instead of pretending to take money. Passes can also be granted from
the operations console or through a promotion code.

Advanced results are always suggestions. They never change the shared plan by
themselves, never book or cancel anything, and are marked as out of date when
the plan they were based on has moved on.
