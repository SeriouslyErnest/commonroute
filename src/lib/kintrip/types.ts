export type AgeGroup = "child" | "teen" | "adult" | "senior";
export type Pace = "relaxed" | "balanced" | "packed";
export type Walking = "low" | "moderate" | "high";
export type VoteValue = "MUST_GO" | "WOULD_LIKE" | "DONT_MIND" | "SKIP";
export type PrefStatus = "not_started" | "complete";

export interface Preferences {
  interests: string[];
  pace: Pace;
  walking: Walking;
  mustDo: string;
  avoid: string;
  constraints: string;
}

export interface Traveller {
  id: string;
  name: string;
  relationship: string;
  ageGroup: AgeGroup;
  role: "organiser" | "member";
  joined: boolean;
  prefStatus: PrefStatus;
  preferences: Preferences;
}

export interface Attraction {
  id: string;
  name: string;
  city: "Tokyo" | "Kyoto";
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
}

export interface ItineraryDay {
  day: number;
  date: string;
  city: "Tokyo" | "Kyoto";
  areaLabel: string;
  items: ItineraryItem[];
  note?: undefined | string;
  timingNote?: undefined | string;
}

export interface Itinerary {
  tripId: string;
  version: number;
  generatedAt: string;
  days: ItineraryDay[];
  fit: { good: string[]; watch: string[] };
  summary: string;
  finalised: boolean;
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
  itinerary: Itinerary | null;
  notes: Note[];
  activeTravellerId: string;
  currentDay: number;
  replanLog: { day: number; at: string; reason: string; changes: string[] }[];
  cachedAt: string | null;
}
