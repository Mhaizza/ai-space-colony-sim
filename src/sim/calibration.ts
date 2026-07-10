// Prototype calibration constants.
//
// Every value in this file is deliberately NOT architecture — it fills a slot
// that ADR-17, the decision loop, and the engineering specification each name
// and explicitly defer to "the prototype" (DQ-17.1-17.5, DQ-D1, DQ-D3, DQ-D8,
// EQ-2). Changing a number here is calibration; changing the shape a number
// fills (e.g. adding a threshold, removing a family) is an architecture change
// and requires an ADR. [ADR-17 D10; decision-loop.md B1]
//
// Time unit: seconds of simulated time. Calibrated against the ~20-minute-day
// hypothesis [ADR-06] using a placeholder 1 in-game day = 1200 simulated
// seconds (20 real-time minutes at 1x) — Stage 1 does not validate this
// hypothesis (that is a Stage-4, 24-colonist target per engineering-spec §10);
// it only needs a consistent unit to decay against.

export const SIM_SECONDS_PER_DAY = 1200;

/** Need decay/threshold calibration. [ADR-17 D2-D5, D9; DQ-17.1, DQ-17.2, DQ-17.5] */
export const NEED_CALIBRATION = {
  /** Level is in [0, 100], 100 = fully satisfied. */
  max: 100,
  /** Baseline decay per simulated second, before trait modifiers. */
  baseDecayPerSecond: {
    hunger: 100 / (SIM_SECONDS_PER_DAY * 1.5), // fully depletes over ~1.5 days
    rest: 100 / (SIM_SECONDS_PER_DAY * 2),
    safety: 100 / (SIM_SECONDS_PER_DAY * 4),
    social: 100 / (SIM_SECONDS_PER_DAY * 3),
    purpose: 100 / (SIM_SECONDS_PER_DAY * 3),
  },
  /** Restoration rate per second while satisfaction-condition inputs hold. */
  restorePerSecond: {
    hunger: 100 / 180, // eating fills over 3 simulated minutes
    rest: 100 / (SIM_SECONDS_PER_DAY * 0.35),
    safety: 100 / 600,
    social: 100 / 400,
    purpose: 100 / 400,
  },
  /** Low threshold: below this, a low-need (tier 4) candidate is generated. */
  lowThreshold: 40,
  /** Critical threshold: biological only (ADR-17 D4 — psychological never has one). */
  criticalThreshold: 15,
  /**
   * Satisfaction point sits strictly above the low threshold — structural
   * hysteresis preventing satisfy/re-trigger oscillation. [ADR-17 D3]
   */
  satisfactionPoint: 70,
  /** Rest-amplifier: sustained Rest deprivation amplifies other needs' urgency. [ADR-17 D6] */
  restAmplifier: {
    /** Rest level below which the amplifier is active ("sustained deprivation"). */
    activationThreshold: 30,
    /** Multiplier applied to other needs' urgency while active. Amplifies urgency only, never creates it from zero. */
    multiplier: 1.5,
  },
} as const;

/** Stress calibration. [decision-loop.md §7; DQ-17.5] */
export const STRESS_CALIBRATION = {
  max: 100,
  /** Per-second accumulation contribution, before trait modulation, per active source. */
  accumulationPerSecond: {
    "unmet-psychological-need": 100 / (SIM_SECONDS_PER_DAY * 6),
    "biological-strain": 100 / (SIM_SECONDS_PER_DAY * 5),
    "hostile-proximity": 100 / (SIM_SECONDS_PER_DAY * 3), // inert at Stage 1 (no other colonists)
    "crisis-exposure": 100 / (SIM_SECONDS_PER_DAY * 1),
    overwork: 100 / (SIM_SECONDS_PER_DAY * 4),
    "memory-amplification": 100 / (SIM_SECONDS_PER_DAY * 8),
  },
  /** Per-second dissipation contribution, before trait modulation, per active relief. */
  dissipationPerSecond: {
    "adequate-rest": 100 / (SIM_SECONDS_PER_DAY * 1),
    "satisfied-needs": 100 / (SIM_SECONDS_PER_DAY * 6),
    "positive-social-proximity": 100 / (SIM_SECONDS_PER_DAY * 4), // inert at Stage 1
    "stable-conditions": 100 / (SIM_SECONDS_PER_DAY * 8),
  },
  /** Behavioral threshold — above this, ambient state reads Stressed. [ADR-05] */
  behavioralThreshold: 60,
  /** Task-acceptance suppression begins above this stress level (weight-family input, never a veto). */
  acceptanceSuppressionThreshold: 70,
} as const;

/** Weight composition scale. [decision-loop.md §6; DQ-D1] */
export const WEIGHT_CALIBRATION = {
  /** Bound on any single modifier family's contribution, as a fraction of base — "bound, never veto". */
  maxFamilyContributionFraction: 0.6,
  traitTiltMagnitude: 0.3,
  memoryTiltMagnitude: 0.25,
  stressReliefTiltMagnitude: 0.4,
  stressSuppressionTiltMagnitude: 0.5,
} as const;

/** Memory pool calibration. [memory-system.md; ADR-16 referenced] */
export const MEMORY_CALIBRATION = {
  poolSize: 12,
  /** Influence decays toward zero; higher impact events decay slower. */
  recencyHalfLifeSecondsByImpact: {
    low: SIM_SECONDS_PER_DAY * 3,
    medium: SIM_SECONDS_PER_DAY * 10,
    high: SIM_SECONDS_PER_DAY * 40,
  },
  /** Materiality operationalization (DQ-D7): a memory is material if its tilt could plausibly have changed the winning candidate. */
  materialityInfluenceThreshold: 0.15,
} as const;

/** Goal stack depth bound. [decision-loop.md DQ-D8] */
export const GOAL_STACK_MAX_DEPTH = 5;

/**
 * Shift skeleton calibration (ADR-01 Tier 1). Three contiguous fractions of
 * the simulated day, summing to 1 — no wraparound edge case since the rest
 * period ends exactly at the day boundary.
 */
export const SHIFT_CALIBRATION = {
  workEndFraction: 0.45,
  freeEndFraction: 0.6,
} as const;
