// M11 — Decision System. Runs the decision at each triggered decision point:
// candidate generation, ADR-01 priority filtering, weight composition,
// seeded-stochastic selection, task resolution, and goal commitment.
// [engineering-specification.md §2 M11; decision-loop.md §2-§6, §10]

import { GOAL_STACK_MAX_DEPTH, WEIGHT_CALIBRATION } from "./calibration.js";
import type { WeightDecomposition } from "../services/events.js";
import { computeUrgencies, isBelowCritical, isBelowLow, type NeedTraitModifiers } from "./needs.js";
import { acceptanceSuppression } from "./stress.js";
import { materialMemories, memoryWeightTilt } from "./memory.js";
import { traitWeightTilt } from "./traits.js";
import type { PrngState } from "../services/prng.js";
import { weightedPick } from "../services/prng.js";
import { NEED_KINDS } from "./types.js";
import type {
  ColonistState,
  GoalCandidate,
  GoalSource,
  GoalStackEntry,
  NeedKind,
  PriorityTier,
  ResolvedTask,
  SimTime,
  WorldSnapshot,
} from "./types.js";

const TIERS: readonly PriorityTier[] = [1, 2, 3, 4, 5];

/** Generate — candidates from the five closed sources. [decision-loop.md §2] */
export function generateCandidates(
  colonist: ColonistState,
  snapshot: WorldSnapshot,
  mods: NeedTraitModifiers,
): GoalCandidate[] {
  const candidates: GoalCandidate[] = [];

  for (const condition of snapshot.survivalConditions) {
    candidates.push({ id: `survival-${condition}`, source: "survival-condition", tier: 1, survivalCondition: condition });
  }

  for (const need of NEED_KINDS) {
    if (isBelowCritical(colonist, need, mods)) {
      candidates.push({ id: `critical-${need}`, source: "critical-need", tier: 2, needKind: need });
    }
  }

  if (snapshot.shiftPeriod === "work") {
    candidates.push({ id: "shift-assignment", source: "shift-assignment", tier: 3 });
  }

  for (const need of NEED_KINDS) {
    if (isBelowLow(colonist, need, mods)) {
      candidates.push({ id: `low-${need}`, source: "low-need", tier: 4, needKind: need });
    }
  }

  if (snapshot.shiftPeriod === "free") {
    candidates.push({ id: "voluntary-free-time", source: "voluntary", tier: 5 });
  }

  return candidates;
}

/**
 * Resolve — an adopted goal finds a concrete task via eligibility ∩
 * availability. Stage 1's reduced concrete task list (sanctioned
 * simplification, engineering-specification.md §10): one task per serviced
 * goal, no multi-task choice yet (DQ-D4 is content/engineering scope beyond
 * Stage 1). Safety and Social have no dedicated Stage-1 task — Safety is
 * satisfied ambiently by stable conditions (M6 satisfying-condition input,
 * not a decision-visible task); Social has no task because Stage 1 has no
 * other colonist to socialize with. Their candidates persist as Blocked,
 * exactly as the fall-through rule intends. [decision-loop.md §5]
 */
export function resolveTask(candidate: GoalCandidate, snapshot: WorldSnapshot): ResolvedTask | undefined {
  const moduleCondition = (id: string) => snapshot.moduleConditions.find((m) => m.id === id);
  const workstation = moduleCondition(snapshot.assignedWorkstationId);

  switch (candidate.source) {
    case "survival-condition":
      // The response task class is abstract at this granularity (§5) — the
      // colonist responds; the concrete evacuate/shelter content is DQ-D4.
      return { taskId: `respond-${candidate.survivalCondition}`, moduleId: "station", taskClass: "response" };

    case "critical-need":
    case "low-need": {
      if (candidate.needKind === "hunger") {
        const m = moduleCondition("food-station-1");
        if (m?.functional && m.hasCapacity && m.hasResource) {
          return { taskId: "eat", moduleId: m.id, taskClass: "satisfaction" };
        }
        return undefined;
      }
      if (candidate.needKind === "rest") {
        const m = moduleCondition("rest-area-1");
        if (m?.functional && m.hasCapacity) {
          return { taskId: "sleep", moduleId: m.id, taskClass: "satisfaction" };
        }
        return undefined;
      }
      if (candidate.needKind === "purpose") {
        // Purpose is satisfied by performing skill-matched, completed work — the
        // same assignment task the shift-assignment source resolves to. [ADR-17 D9]
        if (snapshot.shiftPeriod === "work" && workstation?.functional && workstation.hasCapacity) {
          return { taskId: "work", moduleId: workstation.id, taskClass: "assignment" };
        }
        return undefined;
      }
      // Safety, Social: no Stage-1 task — blocked, not eliminated (§3).
      return undefined;
    }

    case "shift-assignment":
      if (workstation?.functional && workstation.hasCapacity) {
        return { taskId: "work", moduleId: workstation.id, taskClass: "assignment" };
      }
      return undefined;

    case "voluntary":
      return { taskId: "free-time", moduleId: "station", taskClass: "transit-idle" };
  }
}

function baseWeight(candidate: GoalCandidate, urgencies: Record<NeedKind, number>): number {
  if (candidate.needKind) return Math.max(0.05, urgencies[candidate.needKind]);
  return 1; // presence-based base: an active assignment, or the openness of a free period
}

/** Stress as a weight family: relief-serving candidates rise, demanding ones are suppressed. Bound, never veto. [decision-loop.md §7] */
function stressTiltFraction(candidate: GoalCandidate): number {
  if (candidate.needKind === "rest" || candidate.source === "voluntary") {
    return WEIGHT_CALIBRATION.stressReliefTiltMagnitude;
  }
  if (candidate.source === "shift-assignment" || candidate.needKind === "purpose") {
    return -WEIGHT_CALIBRATION.stressSuppressionTiltMagnitude;
  }
  return 0;
}

/**
 * Compose — base + four modifier families, decomposable, bounded, order-
 * independent. Relationships are structurally zero at Stage 1 (M10 is out of
 * scope — no other colonist exists to have a relationship with).
 * [decision-loop.md §6]
 */
export function composeWeight(
  candidate: GoalCandidate,
  colonist: ColonistState,
  urgencies: Record<NeedKind, number>,
  now: SimTime,
): WeightDecomposition {
  const base = baseWeight(candidate, urgencies);
  const traits = clampTilt(traitWeightTilt(colonist, candidate.source)) * base;
  const memoryQuery = candidate.needKind ? { needKind: candidate.needKind } : {};
  const memory = clampTilt(memoryWeightTilt(colonist, memoryQuery, now)) * base;
  const suppression = acceptanceSuppression(colonist);
  const stress = clampTilt(stressTiltFraction(candidate) * suppression) * base;
  const relationships = 0;
  const total = Math.max(0.0001, base + traits + memory + stress + relationships);
  return { base, traits, relationships, memory, stress, total };
}

function clampTilt(fraction: number): number {
  const bound = WEIGHT_CALIBRATION.maxFamilyContributionFraction;
  return Math.max(-bound, Math.min(bound, fraction));
}

function motivationFor(candidate: GoalCandidate, decomposition: WeightDecomposition): string {
  const base = `adopted because ${candidate.source.replace(/-/g, " ")}`;
  const suffix = candidate.needKind ? ` (${candidate.needKind} urgency ${decomposition.base.toFixed(2)})` : "";
  return base + suffix;
}

export interface DecisionOutcome {
  readonly candidate: GoalCandidate;
  readonly task: ResolvedTask;
  readonly decomposition: WeightDecomposition;
  readonly materialMemoryIds: readonly string[];
  readonly stochastic: boolean;
  readonly motivation: string;
  readonly goal: GoalStackEntry;
}

/**
 * The full decision pass: Perceive is the caller's job (the snapshot is
 * already fixed by the time this runs); this covers Generate through Commit.
 * Returns undefined when no tier has an actionable candidate — the caller
 * (M12) reads that as the Blocked ambient state. [decision-loop.md §2-§6]
 */
export function decide(
  colonist: ColonistState,
  snapshot: WorldSnapshot,
  needMods: NeedTraitModifiers,
  prng: PrngState,
  now: SimTime,
): DecisionOutcome | undefined {
  const candidates = generateCandidates(colonist, snapshot, needMods);
  const urgencies = computeUrgencies(colonist, needMods);

  for (const tier of TIERS) {
    const atTier = candidates.filter((c) => c.tier === tier);
    const actionable = atTier
      .map((candidate) => ({ candidate, task: resolveTask(candidate, snapshot) }))
      .filter((x): x is { candidate: GoalCandidate; task: ResolvedTask } => x.task !== undefined);

    if (actionable.length === 0) continue;

    if (tier === 1) {
      // Trait-immune, unconditional, no weighing of any kind. [decision-loop.md §3]
      const winner = actionable[0]!;
      const decomposition: WeightDecomposition = { base: 1, traits: 0, relationships: 0, memory: 0, stress: 0, total: 1 };
      return commit(colonist, winner.candidate, winner.task, decomposition, [], false, now);
    }

    const withWeights = actionable.map((x) => ({
      ...x,
      decomposition: composeWeight(x.candidate, colonist, urgencies, now),
    }));
    const chosen =
      withWeights.length === 1
        ? withWeights[0]!
        : weightedPick(prng, withWeights, (w) => w.decomposition.total, `goal-select-tier-${tier}`);

    const materialIds = chosen.candidate.needKind
      ? materialMemories(colonist, { needKind: chosen.candidate.needKind }, now).map((m) => m.id)
      : [];
    return commit(colonist, chosen.candidate, chosen.task, chosen.decomposition, materialIds, withWeights.length > 1, now);
  }

  return undefined;
}

function commit(
  colonist: ColonistState,
  candidate: GoalCandidate,
  task: ResolvedTask,
  decomposition: WeightDecomposition,
  materialMemoryIds: readonly string[],
  stochastic: boolean,
  now: SimTime,
): DecisionOutcome {
  const motivation = motivationFor(candidate, decomposition);

  const current = colonist.goalStack.find((g) => g.status === "active");
  if (current && current.taskId !== task.taskId) {
    current.status = "suspended";
  }

  const goal: GoalStackEntry = {
    id: `${candidate.id}-${now}`,
    source: candidate.source,
    tier: candidate.tier,
    motivation,
    taskId: task.taskId,
    status: "active",
    createdAt: now,
    ...(candidate.needKind !== undefined ? { needKind: candidate.needKind } : {}),
    ...(candidate.survivalCondition !== undefined ? { survivalCondition: candidate.survivalCondition } : {}),
  };
  colonist.goalStack.push(goal);
  pruneGoalStack(colonist);

  return { candidate, task, decomposition, materialMemoryIds, stochastic, motivation, goal };
}

/** Enforces the goal stack depth bound by abandoning the stalest non-active entries first. [decision-loop.md DQ-D8] */
function pruneGoalStack(colonist: ColonistState): void {
  while (colonist.goalStack.length > GOAL_STACK_MAX_DEPTH) {
    const idx = colonist.goalStack.findIndex((g) => g.status !== "active");
    if (idx === -1) break;
    colonist.goalStack.splice(idx, 1);
  }
}

export type { GoalSource };
