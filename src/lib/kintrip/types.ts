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

export interface Traveller {
  id: string;
  name: string;
  relationship: string;
  ageGroup: AgeGroup;
  role: "organiser" | "member";
  roles: TripRole[];
  managed?: undefined | boolean;
  responsibleAdultId?: undefined | string;
  needs: TravellerConstraint[];
  joined: boolean;
  prefStatus: PrefStatus;
  preferences: Preferences;
}

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
}

export interface Note {
  id: string;
  scope: "trip" | "day" | "activity";
  refId?: undefined | string;
  text: string;
  author: string;
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
  activeTravellerId: string;
  currentDay: number;
  replanLog: { day: number; at: string; reason: string; changes: string[] }[];
  cachedAt: string | null;
}
