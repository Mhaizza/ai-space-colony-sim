// Closed-list vocabularies fixed by accepted architecture. Extending any list
// here is an architecture decision (a new/revised ADR), never a code change.
// [decision-loop.md B4; ADR-17 D1; ADR-05; goal-system.md]

/** The five-need taxonomy — closed. [ADR-17 D1] */
export type NeedKind = "hunger" | "rest" | "safety" | "social" | "purpose";

export const NEED_KINDS: readonly NeedKind[] = [
  "hunger",
  "rest",
  "safety",
  "social",
  "purpose",
];

/** Biological needs have a critical threshold; psychological needs never do. [ADR-17 D4] */
export type NeedCategory = "biological" | "psychological";

export const NEED_CATEGORY: Readonly<Record<NeedKind, NeedCategory>> = {
  hunger: "biological",
  rest: "biological",
  safety: "psychological",
  social: "psychological",
  purpose: "psychological",
};

/** ADR-01's five priority tiers, highest (1) to lowest (5). */
export type PriorityTier = 1 | 2 | 3 | 4 | 5;

/**
 * The five closed goal sources, each mapped to its tier.
 * [decision-loop.md §2 "Generate"; ADR-01]
 */
export type GoalSource =
  | "survival-condition" // tier 1
  | "critical-need" // tier 2
  | "shift-assignment" // tier 3
  | "low-need" // tier 4
  | "voluntary"; // tier 5

export const GOAL_SOURCE_TIER: Readonly<Record<GoalSource, PriorityTier>> = {
  "survival-condition": 1,
  "critical-need": 2,
  "shift-assignment": 3,
  "low-need": 4,
  voluntary: 5,
};

/** The seven Tier-1 ambient behavioral states — closed. [ADR-05] */
export type ObservableState =
  | "working"
  | "resting"
  | "eating"
  | "socializing"
  | "stressed"
  | "blocked"
  | "in-conflict";

/** The five conceptual task classes — closed. Social class members are ADR-18 scope. [decision-loop.md §5] */
export type TaskClass =
  | "assignment"
  | "satisfaction"
  | "response"
  | "social"
  | "transit-idle";

/** The four trait categories — closed. [personality-traits.md] */
export type TraitCategory =
  | "work-disposition"
  | "stress-response"
  | "social-disposition"
  | "need-disposition";

/** The four memory types — closed. [memory-system.md] */
export type MemoryType = "relational" | "deprivation" | "crisis" | "condition";

/** The six stress accumulation sources — closed. [decision-loop.md §7] */
export type StressSource =
  | "unmet-psychological-need"
  | "biological-strain"
  | "hostile-proximity"
  | "crisis-exposure"
  | "overwork"
  | "memory-amplification";

/** The four stress dissipation reliefs — closed. [decision-loop.md §7] */
export type StressRelief =
  | "adequate-rest"
  | "satisfied-needs"
  | "positive-social-proximity"
  | "stable-conditions";

/** The six closed re-decision triggers. [decision-loop.md §2] */
export type ReDecisionTrigger =
  | "completion"
  | "interruption"
  | "blockage"
  | "need-threshold-crossing"
  | "shift-boundary"
  | "suspension-resolved";

/** In-game duration, expressed in seconds of simulated time. */
export type SimDuration = number;

/** An absolute point in simulated time (seconds since epoch of the run). */
export type SimTime = number;
