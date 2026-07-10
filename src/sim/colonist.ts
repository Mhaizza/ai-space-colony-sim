// M5 — Colonist State. The per-colonist container: identity, long-term state,
// short-term state. M5 owns data residence and invariants; the attached
// systems (M6-M11) own the rules that change it. No system outside the
// colonist's own decision path writes its short-term state, and no other
// colonist ever reads it. [engineering-specification.md §2 M5; locked #21]

import { NEED_CALIBRATION } from "./calibration.js";
import { NEED_KINDS } from "./types.js";
import type {
  ColonistIdentity,
  ColonistState,
  NeedLevels,
  SimTime,
} from "./types.js";

export function createColonist(
  identity: ColonistIdentity,
  now: SimTime,
): ColonistState {
  const needs = Object.fromEntries(
    NEED_KINDS.map((k) => [k, NEED_CALIBRATION.satisfactionPoint]),
  ) as NeedLevels;

  return {
    identity,
    needs,
    stress: { level: 0, attribution: {} },
    observableState: "working",
    goalStack: [],
    traits: [],
    memoryPool: [],
  };
}

/** Convenience read: is this colonist currently doing anything (active goal)? */
export function hasActiveGoal(colonist: ColonistState): boolean {
  return colonist.goalStack.some((g) => g.status === "active");
}

export function activeGoal(colonist: ColonistState) {
  return colonist.goalStack.find((g) => g.status === "active");
}
