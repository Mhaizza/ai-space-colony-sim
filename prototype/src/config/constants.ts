// STRUCTURAL constants — values fixed by accepted architecture (plan: Configuration split).
// Rule: every entry cites its source; changing a value here means an architecture document
// changed first. Provisional calibration values NEVER live here — they belong in tuning.ts.

/** The five canonical needs — closed taxonomy (ADR-17 D1; freeze locked #6). */
export const NEEDS = ["hunger", "rest", "safety", "social", "purpose"] as const;
export type NeedId = (typeof NEEDS)[number];

/** Biological needs — the only needs with a critical threshold (ADR-17 D3–D4; locked #7). */
export const BIOLOGICAL_NEEDS = ["hunger", "rest"] as const satisfies readonly NeedId[];

/** Psychological needs — escalate through stress only, never override (ADR-17 D4). */
export const PSYCHOLOGICAL_NEEDS = ["safety", "social", "purpose"] as const satisfies readonly NeedId[];

/** The seven ambient behavioral states — fixed output vocabulary (ADR-05; locked #29). */
export const AMBIENT_STATES = [
  "working",
  "resting",
  "eating",
  "socializing",
  "stressed",
  "blocked",
  "inConflict",
] as const;
export type AmbientState = (typeof AMBIENT_STATES)[number];

/** ADR-01 priority tiers, highest first: survival, critical need, assignment, deferred need, voluntary. */
export const PRIORITY_TIERS = [1, 2, 3, 4, 5] as const;
export type PriorityTier = (typeof PRIORITY_TIERS)[number];

/** The five closed goal sources, mapped one-to-one onto tiers (goal-system; locked #15). */
export const GOAL_SOURCES = [
  "survivalCondition",
  "criticalNeed",
  "shiftAssignment",
  "lowNeed",
  "voluntary",
] as const;
export type GoalSource = (typeof GOAL_SOURCES)[number];

/** The one-to-one goal-source → ADR-01 tier mapping (goal-system; locked #15). Closed, structural. */
export const GOAL_SOURCE_TIER: Readonly<Record<GoalSource, PriorityTier>> = {
  survivalCondition: 1,
  criticalNeed: 2,
  shiftAssignment: 3,
  lowNeed: 4,
  voluntary: 5,
};

/** The five conceptual task classes (decision-loop §5; locked #26). Social is empty until stage 2 (ADR-18). */
export const TASK_CLASSES = ["assignment", "satisfaction", "response", "social", "transitIdle"] as const;
export type TaskClass = (typeof TASK_CLASSES)[number];

/** The closed six re-decision triggers (decision-loop §2; locked #23). */
export const REDECISION_TRIGGERS = [
  "completion",
  "higherPriorityCondition",
  "blockage",
  "needThresholdCrossing",
  "shiftBoundary",
  "suspensionResolved",
] as const;
export type RedecisionTrigger = (typeof REDECISION_TRIGGERS)[number];

/** The four memory types — closed influence-surface classification (ADR-16; locked #18). */
export const MEMORY_TYPES = ["relational", "deprivation", "crisis", "condition"] as const;
export type MemoryType = (typeof MEMORY_TYPES)[number];

/** Speed control range (ADR-06): pause plus three multipliers. 0 = paused. */
export const SPEED_LEVELS = [0, 1, 2, 4] as const;
export type SpeedLevel = (typeof SPEED_LEVELS)[number];

// --- Unit definitions and engineering capacities (structural in the "limits" sense) ---

/** Ticks per in-game day — the time unit definition (ADR-02 unit; minute resolution). */
export const TICKS_PER_DAY = 1440;

/** In-game ticks one simulation step advances at 1x speed (engineering step-size capacity). */
export const BASE_TICKS_PER_STEP = 1;

/** Stage 1 minimal station: exactly three modules (engineering spec §10 stage-1 scope). */
export const MODULE_IDS = ["foodStation", "restBunk", "workstation"] as const;
export type ModuleId = (typeof MODULE_IDS)[number];

/** Food resource stock capacity — an engineering capacity/limit, not a calibration rate. */
export const FOOD_STOCK_CAPACITY = 100;
