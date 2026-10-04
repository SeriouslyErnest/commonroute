# Invite links: sign in first, then organiser approval

## What people will experience

**Someone opening an invite link**
1. Sees the trip name only (no dates, people or plans) and a box for their email.
2. Gets the sign-in email, taps it, and comes back to the invite.
3. Enters their name, relationship and age group, then taps "Ask to join".
4. Sees a waiting screen: "Your request has been sent to the organiser. You'll be able to see and vote on this trip once they approve you. Nothing about the trip is shared with you until then." They can cancel the request.
5. When approved, the trip opens normally. If declined, they see a short polite message.

**Organiser**
- A new "Join requests" panel on the trip home (with a count badge) and under More tools.
- Each request shows name, relationship, age group, masked email and when they asked. Buttons: Approve / Decline.
- A "People with access" list to remove someone later (removing also stops them seeing future changes).
- Optional Telegram alert for the organiser when a new request arrives (uses the existing bot, no links to private pages).

**Privacy, stated plainly in the app and guide**
- An invite link alone shows nothing but the trip name.
- Until approved, a person cannot see who is going, the plan, votes, needs or notes.
- Only organisers see join requests and requesters' emails (masked).
- Removed or declined people lose access immediately.

## What stays the same
- The Japan demo stays local-only and untouched.
- Sign-in stays email-link only.
- Existing members of existing trips keep their access (grandfathered as approved; the trip creator becomes organiser).

## Technical details
- New table `trip_access` (trip_id, user_id, status pending/approved/declined/removed, role organiser/member, requested profile fields, decided_by/at) with grants, RLS (users read own row; writes via server functions only).
- `kintrip_trips` gains `owner_user_id`; backfill from earliest membership.
- `pullTrip` / `pushTrip` switch to `requireSupabaseAuth` and require an approved `trip_access` row (or owner). A new public `peekInvite(code)` returns only the title.
- New server functions: `requestToJoin`, `cancelJoinRequest`, `listJoinRequests`, `decideJoinRequest`, `removeTripMember` — organiser checks done on the server.
- On approval, the server adds the traveller to the shared trip state so the member acts only as themselves.
- `/join` rewritten into steps: email → check inbox → profile → pending/declined/open. Account gate no longer exempts invite guests.
- English + Simplified Chinese strings, route metadata, phone/desktop checks, user guide, About, PRODUCT/ARCHITECTURE/SECURITY docs updated.
- Test end-to-end with two temporary accounts (organiser + joiner), then delete them.
