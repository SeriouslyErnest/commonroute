/**
 * Offers, prices and what each one unlocks (Paid Features PRD, section 1).
 *
 * Remixed from the original Kintrip project.
 *
 * Prices are launch hypotheses, shown as customer totals in SGD. Nothing here
 * changes anybody's role: paying for a trip unlocks advanced tools for the
 * whole group, and invited travellers never pay.
 */

export type FeatureCode = "compare_bases" | "scenarios" | "cost_replan";

export const FEATURE_LABEL: Record<FeatureCode, string> = {
  compare_bases: "Compare places to stay",
  scenarios: "Compare alternative plans",
  cost_replan: "Replan with costs shown",
};

export interface Offer {
  code: "free" | "trip_plus" | "annual";
  name: string;
  priceMinor: number;
  currency: string;
  priceLabel: string;
  summary: string;
  includes: string[];
  features: FeatureCode[];
  jobQuota: number;
  pageQuota: number;
  /** Offers that are specified but not yet on sale are shown as roadmap only. */
  available: boolean;
}

export const OFFERS: Offer[] = [
  {
    code: "free",
    name: "Free",
    priceMinor: 0,
    currency: "SGD",
    priceLabel: "S$0",
    summary: "Everything a group needs to plan together by hand.",
    includes: [
      "Unlimited trips and travellers",
      "Polls for dates and destinations",
      "Booking readiness list and deadline reminders",
      "Shortlisting, voting, roles and approvals",
      "Maps, opening hours, access journeys and day checks",
      "Spending ledger and settle-up suggestions",
      "CSV and calendar exports, offline saved plan",
    ],
    features: [],
    jobQuota: 0,
    pageQuota: 0,
    available: true,
  },
  {
    code: "trip_plus",
    name: "Trip Plus",
    priceMinor: 1900,
    currency: "SGD",
    priceLabel: "S$19 one time",
    summary: "One trip. Advanced comparisons for the whole group.",
    includes: [
      "Compare up to five places to stay against the real plan",
      "Compare up to three alternative plans side by side",
      "Replanning that shows money already spent and what it would cost",
      "20 advanced jobs and 30 processed pages, shared by the trip",
      "Covers every invited traveller — nobody else pays",
    ],
    features: ["compare_bases", "scenarios", "cost_replan"],
    jobQuota: 20,
    pageQuota: 30,
    available: true,
  },
  {
    code: "annual",
    name: "Annual Organiser",
    priceMinor: 5900,
    currency: "SGD",
    priceLabel: "S$59 per year",
    summary: "Planned for organisers who travel repeatedly. Not on sale yet.",
    includes: [
      "Up to four trip activations a year",
      "Saved group and packing templates",
      "Same advanced tools as Trip Plus on each activated trip",
    ],
    features: ["compare_bases", "scenarios", "cost_replan"],
    jobQuota: 20,
    pageQuota: 30,
    available: false,
  },
];

export function offerByCode(code: string): Offer | undefined {
  return OFFERS.find((o) => o.code === code);
}

/** One preview job per account, so the value can be seen before paying. */
export const PREVIEW_JOB_QUOTA = 1;
export const PREVIEW_PAGE_QUOTA = 3;

/** Bound on what advanced automation will process in this release. */
export const MAX_ADVANCED_DAYS = 14;
export const MAX_ADVANCED_ITEMS_PER_DAY = 20;
