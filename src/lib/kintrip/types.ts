export type AgeGroup = "child" | "teen" | "adult" | "senior";
export type Pace = "relaxed" | "balanced" | "packed";
export type Walking = "low" | "moderate" | "high";
export type VoteValue = "MUST_GO" | "WOULD_LIKE" | "DONT_MIND" | "SKIP";
export type PrefStatus = "not_started" | "complete";

/* ---------------- governance ---------------- */

export type TripRole = "owner" | "organiser" | "sponsor" | "contributor" | "viewer";

export type SuggestionStatus =
  | "suggested"
  | "under_review"
  | "provisionally_approved"
  | "sponsor_approval_required"
  | "approved"
  | "backup"
  | "declined"
  | "booked"
  | "cancelled";

export type DecisionMode = "organiser" | "majority" | "sponsor" | "consensus";

export type FundingType = "free" | "self_paid" | "shared" | "major" | "already_booked";

export type EstimateType = "exact" | "estimated" | "range" | "unknown";

export type Rigidity = "anchor" | "preferred" | "flex" | "rest";

export type Severity = "preference" | "comfort_need" | "hard_limit";

export type NeedVisibility = "group" | "organisers" | "private";

export type ConstraintType =
  | "step_free"
  | "max_walk"
  | "rest_window"
  | "dietary"
  | "heat"
  | "crowds"
  | "noise"
  | "accompaniment"
  | "other";

export interface TravellerConstraint {
  id: string;
  type: ConstraintType;
  severity: Severity;
  label: string;
  visibility: NeedVisibility;
  /** Set when a helper entered this on someone else's behalf. */
  enteredBy?: undefined | string;
  enteredAt?: undefined | string;
}

export interface Preferences {
  interests: string[];
  pace: Pace;
  walking: Walking;
  mustDo: string;
  avoid: string;
  constraints: string;
  earliestStart?: undefined | string;
  latestFinish?: undefined | string;
  restWindow?: undefined | string;
}

/** How a traveller's answers are entered: by themselves, or by a trusted adult. */
export type ManagementMode = "self" | "assisted";

export interface ConsentEvent {
  at: string;
  action: "assigned" | "accepted" | "revoked" | "responsibility_confirmed" | "claimed";
  by: string;
  note?: undefined | string;
}

export interface Traveller {
  id: string;
  name: string;
  relationship: string;
  ageGroup: AgeGroup;
  role: "organiser" | "member";
  roles: TripRole[];
  managed?: undefined | boolean;
  responsibleAdultId?: undefined | string;
  /** "assisted" means a named adult may enter answers for this person. */
  managementMode?: undefined | ManagementMode;
  /** An adult being helped must accept; a dependent needs the adult to confirm responsibility. */
  assistAccepted?: undefined | boolean;
  /** False for people who have needs but no vote (for example a toddler). */
  canVote?: undefined | boolean;
  consentLog?: undefined | ConsentEvent[];
  needs: TravellerConstraint[];
  joined: boolean;
  prefStatus: PrefStatus;
  preferences: Preferences;
}

/* ---------------- opening hours ---------------- */

/** How trustworthy an hours record is. Absence of data is never "open". */
export type HoursVerification = "confirmed" | "reported" | "needs_check" | "unknown";

/** One opening session. `close` earlier than `open` means it runs past midnight. */
export interface HoursInterval {
  /** 0 = Sunday … 6 = Saturday. */
  weekday: number;
  open: string; // HH:MM, venue local
  close: string; // HH:MM, venue local
}

/** A dated override — a holiday, a seasonal or a temporary closure. */
export interface HoursException {
  date: string; // YYYY-MM-DD, venue local
  closed: boolean;
  open?: undefined | string;
  close?: undefined | string;
  label?: undefined | string;
}

export interface HoursRecord {
  intervals: HoursInterval[];
  exceptions: HoursException[];
  /** Minutes before closing that last entry / last food order is taken. */
  lastAdmissionMin?: undefined | number;
  lastOrderMin?: undefined | number;
  /** The window this record is known to describe. Outside it, treat as unverified. */
  validFrom?: undefined | string;
  validTo?: undefined | string;
  sourceName?: undefined | string;
  sourceUrl?: undefined | string;
  checkedAt?: undefined | string;
  enteredBy?: undefined | string;
  verification: HoursVerification;
}

/* ---------------- car access and onward journeys ---------------- */

export type CarStatus =
  | "direct"
  | "park_and_transfer"
  | "restricted"
  | "prohibited"
  | "unknown";

export type LegMode =
  | "drive"
  | "park"
  | "walk"
  | "bus"
  | "shuttle"
  | "rail"
  | "cable_car"
  | "ferry"
  | "taxi";

/** Recorded evidence, never inferred from the absence of a barrier. */
export type EvidenceState = "confirmed" | "reported" | "unsuitable" | "unknown";

export interface AccessLeg {
  id: string;
  mode: LegMode;
  from: string;
  to: string;
  durationMin?: undefined | number;
  /** Local clock time of the last service of the day, where known. */
  lastDeparture?: undefined | string;
  operatingNote?: undefined | string;
  bookingRequired?: undefined | "yes" | "no" | "unknown";
  walkMetres?: undefined | number;
  steps?: undefined | number;
  stepFree: EvidenceState;
  wheelchair: EvidenceState;
  stroller: EvidenceState;
  sourceUrl?: undefined | string;
}

export interface AccessProfile {
  carStatus: CarStatus;
  conditions?: undefined | string;
  /** Where the car actually stops when it cannot reach the place itself. */
  gatewayName?: undefined | string;
  gatewayLatitude?: undefined | number;
  gatewayLongitude?: undefined | number;
  parkingNote?: undefined | string;
  outbound: AccessLeg[];
  inbound: AccessLeg[];
  /** Local clock time the group must start heading back by. */
  returnDeadline?: undefined | string;
  /** True when the journey ends somewhere other than where the car was left. */
  oneWay?: undefined | boolean;
  carEndsAt?: undefined | string;
  transferBufferMin?: undefined | number;
  sourceName?: undefined | string;
  sourceUrl?: undefined | string;
  checkedAt?: undefined | string;
}

export type PlaceKind = "attraction" | "eatery";

export interface Attraction {
  id: string;
  name: string;
  city: string;
  area: string;
  category: string;
  description: string;
  durationMin: number;
  walking: Walking;
  cost: "Free" | "$" | "$$";
  indoor: boolean;
  opens: string;
  closes: string;
  sourceUrl: string;
  /* Where this place came from, so duplicates can be spotted and data refreshed. */
  latitude?: undefined | number;
  longitude?: undefined | number;
  provider?: undefined | "free" | "google" | "curated";
  providerPlaceId?: undefined | string;
  sourceQuery?: undefined | string;
  capturedAt?: undefined | string;
  /** Attraction or somewhere to eat — drives map pins and filters. */
  kind?: undefined | PlaceKind;
  /** IANA zone of the venue; opening hours are always resolved in it. */
  timeZone?: undefined | string;
  hours?: undefined | HoursRecord;
  access?: undefined | AccessProfile;
}

/** A saved geographic grouping of places. A planning aid, not a day. */
export interface PlaceCluster {
  id: string;
  label: string;
  placeIds: string[];
  /** Metres: the maximum pairwise distance the grouping was built with. */
  thresholdM: number;
  algorithm: string;
  manual: boolean;
  revision: number;
}

export interface SuggestionCost {
  currency: string;
  perPerson: number;
  estimateType: EstimateType;
  funding: FundingType;
  bookingDeadline?: undefined | string;
  refundable?: undefined | boolean;
}

export type DeclineReasonCode =
  | "OVER_BUDGET"
  | "TOO_FAR"
  | "DOES_NOT_FIT_NEEDS"
  | "NOT_ENOUGH_TIME"
  | "SIMILAR_SELECTED"
  | "UNAVAILABLE"
  | "CONFLICTS_BOOKING"
  | "LOW_INTEREST"
  | "SAVED_AS_ALTERNATIVE"
  | "OTHER";

export interface DecisionEvent {
  id: string;
  at: string;
  actorId: string;
  actorName: string;
  from: SuggestionStatus;
  to: SuggestionStatus;
  reasonCode?: undefined | DeclineReasonCode;
  note?: undefined | string;
  privateReason?: undefined | boolean;
  voteSnapshot?: undefined | string;
  fitSnapshot?: undefined | string;
}

export type SponsorDecision = "group_funded" | "individually_paid" | "hold" | "declined";

export interface SponsorApproval {
  id: string;
  suggestionId: string;
  sponsorId: string;
  sponsorName: string;
  decision: SponsorDecision;
  amount: number;
  currency: string;
  note?: undefined | string;
  at: string;
}

export interface Suggestion {
  attractionId: string;
  status: SuggestionStatus;
  cost: SuggestionCost;
  backupTags: string[];
  suggestedBy?: undefined | string;
  sponsorRequestedAt?: undefined | string;
  history: DecisionEvent[];
}

export interface DecisionSettings {
  mode: DecisionMode;
  voteThreshold: number;
  quorum: number;
  organiserOverrideAllowed: boolean;
  sponsorThreshold: number;
  currency: string;
  publication: "owner" | "organisers";
  sharedBudget?: undefined | number;
}

export interface Notification {
  id: string;
  at: string;
  text: string;
  audience: "all" | "organisers" | "sponsors";
  read: boolean;
}

export interface AuditEvent {
  id: string;
  at: string;
  actorName: string;
  action: string;
  detail: string;
}

export type ItemKind = "activity" | "meal" | "rest" | "travel";

export interface ItineraryItem {
  id: string;
  kind: ItemKind;
  title: string;
  start: string; // HH:MM
  durationMin: number;
  attractionId?: undefined | string;
  address?: undefined | string;
  note?: undefined | string;
  transport?: undefined | string;
  walking?: undefined | Walking;
  rigidity?: undefined | Rigidity;
  locked?: undefined | boolean;
  lockedBy?: undefined | string;
}

export interface SubgroupPlan {
  id: string;
  label: string;
  memberIds: string[];
  activity: string;
  note?: undefined | string;
}

export interface DaySplit {
  id: string;
  groups: SubgroupPlan[];
  meetingPoint: string;
  meetingTime: string;
  approved: boolean;
}

export interface ItineraryDay {
  day: number;
  date: string;
  city: string;
  areaLabel: string;
  items: ItineraryItem[];
  note?: undefined | string;
  timingNote?: undefined | string;
  split?: undefined | DaySplit;
}

export interface Itinerary {
  tripId: string;
  version: number;
  generatedAt: string;
  days: ItineraryDay[];
  fit: { good: string[]; watch: string[] };
  summary: string;
  finalised: boolean;
  published?: undefined | boolean;
  publishedAt?: undefined | string;
  publishedBy?: undefined | string;
  acknowledged?: undefined | string[];
}

export interface Trip {
  id: string;
  title: string;
  destination: string;
  startDate: string;
  endDate: string;
  travellerCount: number;
  organiserId: string;
  status: "planning" | "final" | "travelling";
  /** Invite secret used to sync this trip between group members' phones. */
  shareCode?: undefined | string;
  /** IANA time zone of the destination; times are shown in this zone. */
  timeZone?: undefined | string;
}

export interface Note {
  id: string;
  scope: "trip" | "day" | "activity";
  refId?: undefined | string;
  text: string;
  author: string;
}

/* ---------------- bookings ---------------- */

export type BookingType = "stay" | "activity" | "transport" | "meal" | "other";
export type BookingStatus = "planned" | "confirmed" | "cancelled";

export interface Booking {
  id: string;
  type: BookingType;
  title: string;
  provider?: undefined | string;
  link?: undefined | string;
  status: BookingStatus;
  /** Local date/time at the destination, e.g. 2027-03-21T10:30 — never UTC-shifted. */
  startLocal?: undefined | string;
  endLocal?: undefined | string;
  timeZone: string;
  travellerIds: string[];
  location?: undefined | string;
  /** Address in its original local script, plus an optional translated line. */
  addressLocal?: undefined | string;
  addressTranslated?: undefined | string;
  contact?: undefined | string;
  ownerId: string;
  /** Confirmation reference: the booker only, unless shared explicitly. */
  reference?: undefined | string;
  referenceSharedWith: string[];
  cancellationDeadline?: undefined | string;
  attractionId?: undefined | string;
  note?: undefined | string;
  createdAt: string;
  version: number;
}

/* ---------------- shared jobs and packing ---------------- */

export type TaskState = "unassigned" | "awaiting_acceptance" | "accepted" | "complete" | "cancelled";

export interface TripTask {
  id: string;
  title: string;
  detail?: undefined | string;
  assigneeId?: undefined | string;
  helperIds: string[];
  deadline?: undefined | string;
  timeZone?: undefined | string;
  state: TaskState;
  attractionId?: undefined | string;
  visibility: NeedVisibility;
  version: number;
  history: { at: string; actorName: string; action: string }[];
}

export type PackingScope = "personal" | "dependent" | "shared";

export interface PackingItem {
  id: string;
  label: string;
  scope: PackingScope;
  /** Whose list this belongs to (personal), or who it is for (dependent). */
  travellerId?: undefined | string;
  responsibleId?: undefined | string;
  quantityNeeded?: undefined | number;
  quantityCommitted?: undefined | number;
  quantityPacked?: undefined | number;
  packed: boolean;
  visibility: NeedVisibility;
  version: number;
}

/* ---------------- published changes, attendance ---------------- */

export type ChangeKind = "added" | "removed" | "moved" | "split" | "booking" | "other";

export interface PlanChange {
  kind: ChangeKind;
  text: string;
  dayNumber?: undefined | number;
  /** A material change needs everyone to see it (time, place, or who goes where). */
  material: boolean;
  affected: string[];
}

export interface PublishedChange {
  id: string;
  version: number;
  previousVersion: number;
  at: string;
  by: string;
  changes: PlanChange[];
  acknowledged: string[];
}

export type AttendanceState = "coming" | "sitting_out" | "unsure";

export interface AttendanceRecord {
  travellerId: string;
  itemId: string;
  state: AttendanceState;
  arriveLate?: undefined | string;
  leaveEarly?: undefined | string;
  at: string;
}

export interface KintripState {
  trip: Trip;
  travellers: Traveller[];
  attractions: Attraction[];
  votes: Record<string, Record<string, VoteValue>>; // travellerId -> attractionId -> vote
  suggestions: Record<string, Suggestion>; // attractionId -> governance record
  decisions: DecisionSettings;
  sponsorApprovals: SponsorApproval[];
  notifications: Notification[];
  audit: AuditEvent[];
  itinerary: Itinerary | null;
  notes: Note[];
  bookings: Booking[];
  tasks: TripTask[];
  packing: PackingItem[];
  publishedChanges: PublishedChange[];
  attendance: AttendanceRecord[];
  /** Snapshot of the last published days, so changes can be described plainly. */
  publishedSnapshot: { version: number; days: ItineraryDay[] } | null;
  activeTravellerId: string;
  currentDay: number;
  replanLog: { day: number; at: string; reason: string; changes: string[] }[];
  cachedAt: string | null;
}
