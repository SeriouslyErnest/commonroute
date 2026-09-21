# CSV/ICS Export Release E1

Build a complete first export release so families and friends can use a published CommonRoute trip in a spreadsheet, Google My Maps, or a calendar, and open directions in their preferred map app.

## What to build

1. **Export selection and preview page**
   - New route `/trips/:tripId/export` with format selector (CSV / Calendar), scope selector (full trip / date range / my activities / managed traveller / bookings only), and category filters.
   - CSV purpose toggle: "Google My Maps import" vs "Readable itinerary".
   - Readable CSV options: coordinates, map links, or both; map provider pick (Google Maps, Apple Maps, or both).
   - Preview card showing scope, included/omitted counts, revision, generation time, and a clear warning that the file is a snapshot, not a live sync.

2. **CSV serializers**
   - **My Maps preset**: UTF-8 CSV with BOM, CRLF endings, one header row, columns for identity, map location, trip context, travel info, and version metadata. Uses separate latitude/longitude columns; blocks export if >2,000 rows.
   - **Readable itinerary preset**: one row per itinerary item, translated headings, sorted by local date and order, with day/time/activity/address/booking status/travel/access notes. Includes coordinates, navigation links, or both based on selection.
   - Proper CSV quoting, formula injection neutralisation, and explicit "unknown"/"unavailable" placeholders.

3. **Navigation links**
   - Google Maps URLs with `api=1` and supported travel modes; Apple Maps URLs using documented destination/mode params.
   - Leg-level links plus optional route-section links for consecutive same-mode driving/walking legs, with max 3 waypoints and 2,048-char URL limit.
   - Restricted-car access targets the gateway/parking coordinate; attractions target entrance.

4. **ICS calendar export**
   - RFC 5545 VCALENDAR/VEVENT output with stable UID, DTSTAMP, DTSTART/DTEND in UTC, SUMMARY, DESCRIPTION containing local time/zone/map links/CommonRoute URL.
   - Scope options: whole trip, selected dates, my activities, managed traveller, bookings/transport only.
   - Optional display alarm (15/30/60/none minutes). Confirmed events use `CONFIRMED`, provisional use `TENTATIVE`.
   - Exclude rest/transfer by default but allow inclusion; all-day activities use date values.

5. **Access control and versioning**
   - Server-side auth check: requester must be a trip member; removed members rejected.
   - Generate from one published revision; filename includes trip slug, purpose, revision, and UTC date.
   - Never export private needs, medical details, hidden notes, invitation secrets, participant emails, or booking confirmation codes.
   - Include only permitted booking-status summary and authenticated CommonRoute link.

6. **Download and help**
   - Server function returns `{ filename, mimeType, content, includedCount, omitted }`.
   - Client triggers a browser download using a Blob and hidden `<a>`.
   - Inline help explains Google My Maps import, Google Calendar/Apple Calendar/Outlook import, stale-file handling, and that external maps ignore CommonRoute constraints.

7. **Translations**
   - All new labels added to English and Simplified Chinese dictionaries in `src/lib/i18n.tsx`.

## Technical notes

- Implement in `src/lib/kintrip/export.functions.ts` and `src/lib/kintrip/export.ts`.
- Server function `generateExport` validates `ExportRequest` with Zod and checks membership via existing trip loaders/auth helpers.
- Keep generated content in memory; do not write temp files to disk in the serverless runtime.
- Reuse existing types (`Itinerary`, `ItineraryItem`, `Attraction`, `Booking`, `AttendanceRecord`).
- Add route file `src/routes/trips.$tripId.export.tsx` using TanStack Router conventions.
- Place a "Share or export" link on the itinerary page.

## Out of scope for E1

- XLSX, KML, GPX, ZIP bundles.
- Connected Google Sheets or calendar subscriptions.
- Booking extraction or payment integrations.
- Direct Google My Maps account publishing.
