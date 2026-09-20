# CommonRoute v2.2 — Phase A

The v2.2 document lists eight features in two phases. This plan builds **Phase A (F01–F04)** in the order the document specifies, each usable on its own. Phase B (change summaries, attendance, comfort/meals, map view) follows afterwards as a separate round.

Everything already built stays as it is: sign-in by email link, roles and review decisions, sponsor money, voting, fairness, publishing, offline plan, printing, English/简体中文, and the local-only Japan demo.

## F01 — Travellers who need help taking part

- A traveller is no longer tied to an account. Each person is either **answering for themselves** or **helped by a named adult**.
- An organiser can add a child or an assisted relative with just a name and age band — no email needed.
- A helper can fill in needs, preferences and votes only for the people assigned to them. Every such entry is stamped **"Entered by Mei for Ah Gong"** and shown that way in history.
- Adults being helped can accept or withdraw help at any time; withdrawing stops new entries immediately but keeps the record of past ones.
- Some people (a toddler) can have care needs without a vote; they are left out of vote counts but stay in the fairness and needs checks.
- Helping someone never grants organiser, owner or spending powers.
- When a helped person later gets their own account, their needs and votes carry across without becoming a second person in the group.

## F02 — Today view

- A new **Today** screen becomes the default once a plan is published: **Next**, **Later**, **Done**, with any other day browsable.
- Each stop shows meeting time in the destination's local time, address, map link, who to contact and the matching booking summary — never presented as confirmed by the venue.
- An optional **Simple view** with larger text, plain labels and few buttons (not called "elderly mode"), usable at 200% text size.
- A **Find our stay** card: the lodging address in its original script, an optional translated line, and a copy button.
- The chosen published day is kept for offline use, showing plan version, last sync time and whether it is out of date. Draft edits never show up here.
- Clear empty states for days with nothing planned.

## F03 — Bookings and stay details

- Manual booking entries: type, title, link, status, start/end time with its time zone, who it covers, place, who booked it, optional cancellation deadline.
- Bookings attach to itinerary stops. A confirmed timed booking becomes a fixed point — moving it asks for confirmation first.
- Approving an activity, funding it and actually booking it stay three separate things.
- Group members see a short summary; the confirmation reference is visible to the booker only unless they share it. No passport or card details stored.
- Cancelling a booking removes the "confirmed" label and flags the plan for review.

## F04 — Shared jobs and packing

- **Jobs**: title, one person accountable, optional helpers, deadline, optional linked stop. States: unassigned → awaiting acceptance → accepted → done, plus cancelled. Completion can be undone and is recorded.
- Organisers assign; the assignee accepts or declines. Removing an assignee leaves the job open, not lost. Assigning a job never grants spending approval.
- **Packing**: personal items, items for someone you help, and shared supplies with needed / committed / packed quantities and a responsible person.
- Editable starting templates for multi-generational and friends trips.
- Overdue accepted jobs are flagged privately to the organiser, no public blame.
- Private care items stay personal or helper-visible, never group-wide by default.
- Jobs and packing live inside a single **Getting ready** area, not a new bottom-tab section.

## Technical notes

- Extend `KintripState` in `src/lib/kintrip/types.ts` with `bookings`, `tasks`, `packing`, and extend `Traveller` with management mode, manager id, consent history and voting eligibility. No parallel trip store — this keeps existing share-code sync, offline cache and account membership working unchanged.
- `normalizeState` in `governance.ts` backfills the new fields so existing saved trips and the demo load without migration.
- New actions in `src/lib/kintrip/actions.ts`; permission helpers extended (`canEditFor(actor, traveller)`), enforced in the action layer as well as the UI.
- New routes: `src/routes/today.tsx`, `src/routes/bookings.tsx`, `src/routes/getting-ready.tsx`; `travellers` management folded into the existing `/family` and `/roles` screens.
- Vote tallies, fairness and publication checks updated to exclude non-voting profiles from denominators.
- Every new label added to the ZH dictionary in `src/lib/i18n.tsx`; existing brand tokens and 44/48px touch targets reused; new routes get their own head metadata.
- Demo trip stays local-only and gains sample managed travellers, a booking and a packing list so the features can be tried without signing in.

## Verification

Browser pass in both languages covering: adding a managed traveller and entering needs as their helper, a helper being blocked from another person's profile, adding a timed booking and moving its stop, assigning and accepting a job, claiming the last shared packing item twice, Today view offline in airplane mode, and simple view at 200% text.
