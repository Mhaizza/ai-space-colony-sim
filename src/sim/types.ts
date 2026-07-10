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

// --- M5 Colonist State data shapes -----------------------------------------
// M5 owns data residence and invariants; the attached systems (M6-M11) own
// the rules that change it. [engineering-specification.md §2 M5]

/** Level in [0, 100] per need, 100 = fully satisfied. */
export type NeedLevels = Record<NeedKind, number>;

export interface StressState {
  level: number;
  /** Last-tick per-source/relief contribution — the traceability record. [decision-loop.md §7] */
  attribution: Partial<Record<StressSource | StressRelief, number>>;
}

export type GoalStatus = "active" | "suspended" | "blocked" | "queued";

export interface GoalStackEntry {
  readonly id: string;
  readonly source: GoalSource;
  readonly tier: PriorityTier;
  /** Recorded at adoption — "adopted because...". [decision-loop.md §11] */
  readonly motivation: string;
  taskId: string | undefined;
  status: GoalStatus;
  readonly createdAt: SimTime;
}

export type DiscoveryState = "unknown" | "observed" | "confirmed";

export interface TraitInstance {
  readonly traitId: string;
  readonly category: TraitCategory;
  discovery: DiscoveryState;
}

export type MemoryImpact = "low" | "medium" | "high";

export interface MemoryEntry {
  readonly id: string;
  readonly type: MemoryType;
  readonly formedAt: SimTime;
  readonly impact: MemoryImpact;
  readonly description: string;
  /** Match keys, per type — used by M9's match-and-tilt queries. [decision-loop.md §8] */
  readonly personId?: string;
  readonly needKind?: NeedKind;
  readonly situationKind?: string;
}

export interface ColonistIdentity {
  readonly id: string;
  readonly name: string;
  /** Immutable after arrival. [colonist-agent-model.md] */
  readonly skills: readonly string[];
}

export interface ColonistState {
  readonly identity: ColonistIdentity;
  needs: NeedLevels;
  stress: StressState;
  observableState: ObservableState;
  goalStack: GoalStackEntry[];
  traits: TraitInstance[];
  memoryPool: MemoryEntry[];
}

// --- M2 World State data shapes ---------------------------------------------

/** Five-state module health classification — closed. [ADR-13] */
export type HealthState = "nominal" | "stressed" | "warning" | "critical" | "failing";

export type ModuleKind = "food-station" | "rest-area" | "workstation";

export interface ModuleState {
  readonly id: string;
  readonly kind: ModuleKind;
  health: HealthState;
  /** Derived from health, but tracked explicitly — a Failing module may still be partially usable in richer worlds. */
  functional: boolean;
  readonly capacity: number;
  occupancy: number;
  /** Only meaningful for resource-bearing modules (e.g. food-station). */
  resourceStock?: number;
}

/** Station-wide survival conditions — Tier 1 sources, trait-immune. [ADR-01] */
export type SurvivalCondition = "depressurization" | "oxygen-failure";

// --- M3 Policy System data shapes -------------------------------------------

/** ADR-01 Tier 1 shift skeleton periods. */
export type ShiftPeriod = "work" | "free" | "rest";

export interface Policy {
  /** Which module this colonist is assigned to work during the work period. */
  readonly assignedWorkstationId: string;
}

// --- M4 Snapshot Service data shapes -----------------------------------------

export interface ModuleCondition {
  readonly id: string;
  readonly kind: ModuleKind;
  readonly health: HealthState;
  readonly functional: boolean;
  readonly hasCapacity: boolean;
  readonly hasResource: boolean;
}

/** Nearby colonists: Tier-1 observable facts only — never internals. [locked #21] */
export interface ObservedColonist {
  readonly id: string;
  readonly state: ObservableState;
}

/**
 * The fixed, per-decision world snapshot. Transient — never persisted,
 * discarded after the decision. [decision-loop.md §1b]
 */
export interface WorldSnapshot {
  readonly time: SimTime;
  readonly shiftPeriod: ShiftPeriod;
  readonly assignedWorkstationId: string;
  readonly moduleConditions: readonly ModuleCondition[];
  readonly survivalConditions: readonly SurvivalCondition[];
  readonly nearbyColonists: readonly ObservedColonist[];
}
