// M3 — Policy System. Owns policy state and resolves the effective policy per
// colonist via the cascade. Stage 1 (1 colonist, 1 workstation) exercises the
// shift-skeleton cascade element only — module/role/scope cascade complexity
// is deferred to multi-colonist stages, where more than one scope can
// disagree. [engineering-specification.md §2 M3; ADR-01 Tier 1; ADR-11]

import { SHIFT_CALIBRATION, SIM_SECONDS_PER_DAY } from "./calibration.js";
import type { Policy, ShiftPeriod, SimTime } from "./types.js";

export function createStage1Policy(assignedWorkstationId: string): Policy {
  return { assignedWorkstationId };
}

/**
 * Pure: resolves the shift period from absolute simulated time.
 * [ADR-01 Tier 1; ADR-02 — condition-triggered boundaries at elapsed duration]
 */
export function resolveShiftPeriod(time: SimTime): ShiftPeriod {
  const timeOfDay = time % SIM_SECONDS_PER_DAY;
  const workEnd = SIM_SECONDS_PER_DAY * SHIFT_CALIBRATION.workEndFraction;
  const freeEnd = SIM_SECONDS_PER_DAY * SHIFT_CALIBRATION.freeEndFraction;
  if (timeOfDay < workEnd) return "work";
  if (timeOfDay < freeEnd) return "free";
  return "rest";
}

/**
 * True at the instant a shift boundary is crossed between two times —
 * the condition-triggered re-decision trigger 5. [ADR-02]
 */
export function crossedShiftBoundary(prevTime: SimTime, nextTime: SimTime): boolean {
  return resolveShiftPeriod(prevTime) !== resolveShiftPeriod(nextTime);
}
