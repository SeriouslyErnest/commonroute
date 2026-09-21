# Maps, Scheduling and Access (module v1.0)

Yes — all six capabilities can be built. M01–M05 ship together, M06 behind its own switch.
Everything already working stays untouched: sign-in by email link, roles and approvals, money,
voting, fairness, publishing, Today, bookings, getting ready, English/简体中文, and the local-only Japan demo.

## What you get

**Group places on the map (M01)**
"Group nearby" on Discover and when planning a day. Groups only the places currently shown,
using real straight-line distance, with a slider from 0.5 km to 10 km (2 km default).
Every group shows its label, how many places, categories and how spread out it is.
Places with no location go into an "Ungrouped" list with a "set location" action — never guessed.
Groups can be renamed and places dragged between them; manual edits survive regrouping.
Distances are always labelled "straight-line" — a place across a bay can be near but slow to reach.

**Opening hours that matter for the actual day (M02)**
Each place stores weekly hours, date exceptions, seasonal and temporary closures, last admission,
last food order, and where the information came from and when it was checked.
A place detail shows one of: open for your visit, closed that date, visit runs past closing,
last admission missed, hours unknown, or hours need checking.
When a stop doesn't fit you can move it to another day, shorten it, swap in a backup, or keep it
as provisional — provisional stops stay visibly flagged and keep the day out of "checked" status.

**Driving routes (M03)**
Routed driving legs between stops with distance and time, replacing today's rough estimate where a
route exists. If no route comes back, the leg reads "Driving route unavailable" rather than a guess.

**Map with categories (M04)**
A real map view of saved places with distinct pins for attractions and eateries, filters for either
or both, list/map toggle, and pin shapes plus labels so meaning never depends on colour alone.

**How you actually get there (M05)**
Each place can carry an access profile: can you drive to it, is it park-and-transfer, are private
cars banned, or is it unknown. Journeys are recorded as ordered legs (drive, park, walk, bus,
shuttle, train, cable car, ferry, taxi) with times, operating dates, last departure and whether
booking is needed. Activity cards read "Drive to [gateway], then [transport]", expandable into the
full leg list with source links and a return deadline.
Where the car is left is tracked, so a one-way mountain crossing can't quietly end with "drive to hotel".
Step-free, wheelchair, stroller, walking distance and steps are recorded per leg as confirmed,
reported, unsuitable or unknown — never inferred from the absence of a barrier.

**Day check before publishing**
The plan builder loads approved places, bookings, rest and meal windows, resolves hours for the real
date, routes the legs, orders the day, then validates the whole day including the journey home.
Hard blocks (closed venue, booked slot, last transport missed, a known barrier against an essential
need) are never silently broken. Unknowns become visible warnings, not green ticks.
The organiser can accept an unresolved stop, but the day is then marked as having open questions.

**Find food nearby (M06, optional switch)**
On an attraction and on meal gaps: search around the entrance or gateway, 1 km default radius,
filters for cuisine, price, meal time and party size. Up to eight results ranked by whether they
actually fit the meal window, with the reason shown. Save as a suggestion or propose for the meal —
existing approval rules still apply. Dietary claims are shown as claims, never as safety guarantees.

## Honest limits

- Global coverage, but data quality varies a lot by place. Unknowns stay visible instead of being filled in.
- No live turn-by-turn navigation, no traffic prediction, no ticket booking, no offline maps,
  no worldwide transit timetable engine, no location tracking. External navigation handoff only.
- Special transport (shuttles, ropeways) comes from sourced records entered or fed in, not from
  automatic worldwide discovery.
- Accessibility is recorded evidence, not certification.

## Technical notes

- Extend existing models; no parallel trip store. `Attraction` gains hours, access profile,
  gateway and entrance references, time zone and evidence fields; new `Cluster`, `RouteLeg`,
  `AccessProfile`, `HoursRecord` and `ScheduleCheck` records keyed by stable internal IDs.
  Internal UUIDs are independent of provider IDs; provider IDs stay namespaced. Existing places
  and Google links are preserved.
- Clustering: complete-linkage on Haversine distance, longitude wrap handled, stable ID tie-breaks,
  deterministic, run in a worker for large sets.
- Hours: normalised weekly intervals plus dated exceptions, resolved in the venue's IANA zone against
  the visit date; overnight and multi-session intervals supported; unparseable rules become unknown.
- Provider-independent adapters behind server functions: place search/details, hours, driving routes,
  map tiles. Keys stay server-side. Renderer: MapLibre with a licensed tile source; routing via OSRM
  or a managed equivalent. Each capability degrades on its own — tiles failing must not break the list.
- Scheduler extends the current engine rather than replacing it; it returns an explained draft with
  conflicts and unknowns attached, for organiser review.
- All new UI text added to the Chinese dictionary; dates shown in the event's time zone.

## Order of work

1. Foundation: place/hours/access/route data model, coordinate backfill, adapters and fixtures.
2. M01 grouping + M04 map and filters.
3. M03 driving routes.
4. M02 hours + M05 access journeys + whole-day validator.
5. Translation, offline saved-plan checks, permission and fixture tests.
6. M06 eatery assistance, separately switchable.

Test fixtures cover Singapore, Tokyo/Kyoto, a Japanese mountain gateway and one destination outside
Asia, plus a daylight-saving change, overnight hours and a public-holiday closure.

## Before I start

Map tiles and routing need a hosted provider. I can start with the free/open services already used
for place search and add a paid tile/routing key later, or wire it to your Google Maps connection —
tell me which you prefer and I'll set it up that way.
