// Tick assembly — engineering spec §5's fixed seven-phase update order, realized for one
// colonist. This module owns ORCHESTRATION ONLY: it calls the already-built modules in a
// fixed sequence and threads state between them. It contains no need/stress/trait/memory/
// decision/task/execution rule of its own — the one piece of genuinely new logic here is
// re-decision TRIGGER DETECTION (comparing before/after state across one tick), which no
// other module owns (decide.ts is explicitly "invoked only at re-decision trigger points";
// this is the file that finds those points).
//
// Perception discipline carried forward: every task/decision read of the world goes through
// one WorldSnapshot built once per tick (§4's "no direct world reads outside Snapshot").
// Execution's consequence application is the documented exception (Build Step 7): it writes
// live NeedsState/WorldState as an *outcome*, which is a different pipeline stage from
// decision-time perception, not a violation of it.
//
// Single PRNG stream: `SimulationState.prng` is the only chance source; every call site that
// might draw threads it through and returns the successor state — never re-seeded mid-run.
// No hidden state: everything tick() reads or needs across calls lives in SimulationState.
//
// Fixed-step rule (review fix 2, 2026-07-10): tick() advances by EXACTLY BASE_TICKS_PER_STEP
// and rejects anything else. Every fixed simulation step must be evaluated — a caller passing
// a larger delta could skip an intermediate need-threshold crossing or shift boundary that a
// step-by-step advance would have caught. Larger timeline advancement is run()'s job, calling
// tick() once per step (run.ts).

import { BASE_TICKS_PER_STEP, NEEDS, type NeedId, type PriorityTier } from "../config/constants.js";
import { TASK_TUNING } from "../config/tuning.js";
import type { ClockState } from "../core/clock.js";
import { advance, tickOfDay } from "../core/clock.js";
import type { PrngState } from "../core/prng.js";
import type { ColonistIdentity, ColonistState } from "../colonist/colonist.js";
import { withCurrentGoal, withMemory, withNeeds, withStress, withSuspendedGoal } from "../colonist/colonist.js";
import { decayNeeds, isCritical, isLow, isSatisfied, restoreNeedByAmount } from "../colonist/needs.js";
import { considerConditionFormation, considerDeprivationFormation, considerRelationalFormation } from "../colonist/memory.js";
import {
  applyAtrophy,
  applyInteraction,
  assertSafeColonistId,
  canonicalPairId,
  perspective,
  type RelationshipConsequence,
  type RelationshipStore,
} from "../colonist/relationships.js";
import { evaluateStress, type StressContribution } from "../colonist/stress.js";
import type { TraitId } from "../colonist/traits.js";
import type { ShiftPeriod, ShiftPolicy } from "../world/policy.js";
import { periodAt } from "../world/policy.js";
import type { WorldState } from "../world/world.js";
import { buildSnapshot, type ObservableColonist, type WorldSnapshot } from "../world/snapshot.js";
import {
  abandonGoal,
  completeGoal,
  generateCandidates,
  resumeGoal,
  suspendGoal,
  type Goal,
} from "../decision/goals.js";
import { decideFromCandidates, type DecisionOutcome } from "../decision/decide.js";
import { isTaskComplete, resolveTask, type TaskId, type TaskResolution } from "../task/tasks.js";
import {
  createPendingOffer,
  evictResolvedOffers,
  isInterruptibleAmbientState,
  offerGoalKey,
  resolveOffer,
  type OfferResolutionReason,
  type SocialOfferAction,
  type SocialOfferStatus,
  type SocialOfferStore,
} from "../task/socialOffers.js";
import { SOCIAL_OFFER_TUNING } from "../config/tuning.js";
import { next } from "../core/prng.js";
import {
  abortExecution,
  applyProgressConsequences,
  beginExecution,
  completeExecution,
  interruptExecution,
  progressExecution,
  resumeExecution,
  type Execution,
} from "../task/execution.js";
import { appendTickRecords, type DecisionLog, type EventLog } from "../records/logs.js";

/**
 * The complete, explicit simulation state — everything tick() reads or writes across calls.
 * `execution` is the currently-running task, if any. `suspendedExecution` is the paired
 * counterpart to `colonist.suspendedGoal` (review fix 1, 2026-07-10): when a goal is
 * suspended, its interrupted Execution is retained here — never dropped — so resuming the
 * goal resumes the SAME Execution, with `elapsedTicks` intact, instead of restarting from
 * zero. The invariant `colonist.suspendedGoal !== null` iff `suspendedExecution !== null`
 * is maintained by every function in this module that touches either slot, and checked
 * explicitly by `validateSimulationState` at tick()'s input and every exit point (review fix
 * 2, 2026-07-10) — malformed state is rejected rather than allowed to silently corrupt.
 */
export interface SimulationState {
  readonly clock: ClockState;
  readonly world: WorldState;
  readonly policy: ShiftPolicy;
  readonly colonist: ColonistState;
  readonly execution: Execution | null;
  readonly suspendedExecution: Execution | null;
  readonly prng: PrngState;
  /**
   * Memory-formation trigger-detection state (tick.ts's job — see module doc): the high-water
   * mark each need has held since it was last satisfied (or since a Deprivation memory last
   * formed from it), and the stress level as of the last Condition memory (or arrival). A
   * single tick's decay/stress movement is far below memory.ts's significance thresholds by
   * design (M6/M7 tuning) — these baselines are what let cumulative movement across many ticks
   * actually reach them, the way a real run is meant to form memories.
   */
  readonly deprivationBaselines: Readonly<Record<NeedId, number>>;
  readonly stressBaseline: number;
  /**
   * Build step 8: the same cumulative-baseline pattern as `stressBaseline`, one entry per
   * relationship partner this colonist has been observed to be party to — the affinity value
   * (this colonist's own directional perspective) as of the last time a Relational memory
   * formed from it (or as of first observing the pair). A single tick's atrophy movement is far
   * below memory.ts's significance threshold by design; this is what lets cumulative drift
   * across many ticks actually reach it, exactly like the need/stress baselines above. Keyed by
   * the other colonist's id — never by `RelationshipStore`'s own keys/history, which this module
   * still never reads directly.
   */
  readonly relationshipAffinityBaselines: Readonly<Record<string, number>>;
  /**
   * Whether tick() has ever run for this state before (review fix, cross-referenced Copilot
   * finding). Starts `false` only in a genuinely fresh `createInitialState` result; every call
   * to tick() sets it `true` in its output, permanently. Gates the one-time "bootstrap"
   * TickEvent (the trigger that kicks off the very first decision) so it fires exactly once,
   * never on every subsequent tick a colonist merely happens to have no execution — which
   * previously included every tick after a goal became blocked.
   */
  readonly hasBootstrapped: boolean;
  /**
   * Append-only behavior trace (Build Step 9). Record SEMANTICS (types, append rules, trace
   * reconstruction) belong entirely to records/logs.ts — this module only calls into it with
   * events it already produced (finish()'s job below), never constructs a record itself.
   */
  readonly eventLog: EventLog;
  readonly decisionLog: DecisionLog;
  /**
   * M10 relationship store (ADR-20 D1/D8) — centralized sparse pair records. Written once per
   * tick by the atrophy phase (build step 8) and read by candidate/decision-weight composition
   * (build step 6); tick.ts never reads the store's materialized records or their past-
   * interaction log directly beyond threading the store and atrophy's own fact-only
   * consequences through — M10 remains the sole owner of the store's shape and rules.
   */
  readonly relationships: RelationshipStore;
  /**
   * Stage 2 Slice 2 — a minimal multi-colonist roster: identity-only records for colonists
   * other than the simulated `colonist`, fixed at creation and never touched by any tick()
   * phase. This is deliberately NOT a second `ColonistState` per entry: no needs/stress/memory/
   * decision simulation exists for roster members yet (that is Stage 3-scale work, out of
   * scope here). Its entire purpose is letting a relationship pair's second party be a *known*
   * colonist id, so the relationship store can materialize, serialize, and replay a real
   * two-party pair instead of only ever rejecting one as "unknown colonist id" (build step 3's
   * documented limitation). tick.ts threads this through unchanged — it is not a decision input
   * (nearbyColonists/candidate generation remain their own, separately-approved concern).
   */
  readonly roster: readonly ColonistIdentity[];
  /**
   * Stage 2 Slice 5 — M12's social offer store (ADR-21 D1): the ADR-18 D5 offer/response
   * protocol's persisted state for Conversation and Shared Downtime. Offers are created at
   * social goal commitment (design D3, Phase 5) and resolved by the Phase 6 lifecycle pass
   * below — never on their creating tick (the one-tick response-delay floor). Resolved offers
   * are never a decision input (ADR-21 Invariant 8): the lifecycle pass reads pending offers
   * only, and everything else that touches this slice is serialization/replay/inspection.
   */
  readonly socialOffers: SocialOfferStore;
}

/** One tick's trace — the "stable replay log": what was detected, decided, resolved, executed. */
export type TickEvent =
  | { readonly kind: "bootstrap" }
  | { readonly kind: "needThresholdCrossing"; readonly needId: NeedId; readonly severity: "low" | "critical" }
  | { readonly kind: "shiftBoundary"; readonly from: ShiftPeriod; readonly to: ShiftPeriod }
  | { readonly kind: "completion"; readonly goalKey: string; readonly taskId: TaskId }
  | { readonly kind: "blockage"; readonly goalKey: string; readonly reasons: readonly string[] }
  | { readonly kind: "higherPriorityCondition"; readonly interruptedGoalKey: string; readonly interruptedTier: PriorityTier }
  | { readonly kind: "suspensionResolved"; readonly goalKey: string }
  | { readonly kind: "suspensionOverflow"; readonly abandonedGoalKey: string; readonly abandonedExecutionTaskId: TaskId | null }
  | { readonly kind: "executionInterrupted"; readonly taskId: TaskId; readonly goalKey: string }
  | { readonly kind: "executionAborted"; readonly taskId: TaskId; readonly goalKey: string }
  | { readonly kind: "executionProgressed"; readonly taskId: TaskId; readonly elapsedTicks: number }
  | { readonly kind: "executionBegun"; readonly taskId: TaskId; readonly goalKey: string }
  | { readonly kind: "executionResumed"; readonly taskId: TaskId; readonly goalKey: string; readonly elapsedTicks: number }
  | { readonly kind: "decision"; readonly outcome: DecisionOutcome }
  | { readonly kind: "taskResolution"; readonly resolution: TaskResolution }
  | {
      readonly kind: "memoryFormed";
      readonly memoryType: "deprivation" | "condition" | "relational";
      readonly needId?: NeedId;
      readonly otherId?: string;
    }
  | { readonly kind: "stressEvaluated"; readonly contributions: readonly StressContribution[] }
  | {
      readonly kind: "socialOfferCreated";
      readonly offerId: number;
      readonly initiatorId: string;
      readonly responderId: string;
      readonly action: SocialOfferAction;
      readonly respondableAtTick: number;
      readonly expiresAtTick: number;
    }
  | {
      readonly kind: "socialOfferResolved";
      readonly offerId: number;
      readonly status: Exclude<SocialOfferStatus, "pending">;
      readonly reason: OfferResolutionReason | null;
    };

export interface TickResult {
  readonly state: SimulationState;
  readonly events: readonly TickEvent[];
}

/**
 * Validates the cross-field goal/execution invariants. Suspended pair (review fix 2,
 * 2026-07-10): `colonist.suspendedGoal` is null iff `suspendedExecution` is null — the pair is
 * retained or cleared together, never one without the other. When both are present, checks
 * their association as far as Stage 1 data permits: the execution's `goalKey` must name the
 * suspended goal, and a genuinely suspended execution can only be in the "interrupted" status
 * (never "inProgress", "completed", or "aborted" while parked in this slot). Active pair
 * (Copilot-confirmed defect — only the suspended pair was checked before): a non-null
 * `execution` must be "inProgress" and must serve the current ACTIVE goal by key; otherwise
 * the next tick would apply that task's consequences for a goal that never resolved to it.
 * Every tick() exit point leaves the active slot in exactly this shape — completion, blockage,
 * and suspension all replace or clear goal and execution together (adoptAndResolve,
 * resumeSuspended, suspendCurrentGoal), and interrupted executions live only in the suspended
 * slot — so anything else cannot describe a state this simulation produced. Throws on
 * violation — malformed state is rejected explicitly here rather than allowed to silently
 * corrupt downstream logic.
 */
export function validateSimulationState(state: SimulationState): void {
  const { suspendedGoal, currentGoal } = state.colonist;
  const { suspendedExecution, execution } = state;

  if (execution !== null) {
    if (execution.status !== "inProgress") {
      throw new Error(
        `Invalid SimulationState: an active execution must have status "inProgress", got "${execution.status}" — ` +
          `interrupted executions belong in suspendedExecution; completed/aborted ones are never retained.`,
      );
    }
    if (currentGoal === null) {
      throw new Error(
        `Invalid SimulationState: execution ("${execution.taskId}" for goal "${execution.goalKey}") is present ` +
          `but currentGoal is null.`,
      );
    }
    if (currentGoal.status !== "active") {
      throw new Error(
        `Invalid SimulationState: execution ("${execution.taskId}") is in progress but currentGoal ` +
          `("${currentGoal.key}") has status "${currentGoal.status}" — only an active goal can be executing.`,
      );
    }
    if (execution.goalKey !== currentGoal.key) {
      throw new Error(
        `Invalid SimulationState: execution.goalKey ("${execution.goalKey}") does not match currentGoal.key ` +
          `("${currentGoal.key}").`,
      );
    }
  }

  if ((suspendedGoal === null) !== (suspendedExecution === null)) {
    // Stage 2 Slice 5 exception (design D3 step 3's hold): a suspended OFFER-BACKED goal has
    // no execution to park — its execution never began (it begins only on acceptance) — so
    // suspendedGoal non-null with suspendedExecution null is exactly the shape a survivable
    // interruption during the response-delay window produces. Recognized strictly: the goal
    // must be matched by a pending offer's derived goal key; any other one-sided pair is
    // still the malformed state this check has always rejected.
    const offerBackedSuspension =
      suspendedGoal !== null &&
      suspendedExecution === null &&
      state.socialOffers.offers.some((o) => o.status === "pending" && offerGoalKey(o) === suspendedGoal.key);
    if (!offerBackedSuspension) {
      throw new Error(
        "Invalid SimulationState: suspendedGoal and suspendedExecution must both be null or both be " +
          `present — got suspendedGoal=${suspendedGoal === null ? "null" : `"${suspendedGoal.key}"`}, ` +
          `suspendedExecution=${suspendedExecution === null ? "null" : `"${suspendedExecution.taskId}"`} ` +
          `(the only sanctioned exception is a suspended offer-backed social goal with a matching pending offer).`,
      );
    }
  }

  if (suspendedGoal !== null && suspendedExecution !== null) {
    if (suspendedExecution.goalKey !== suspendedGoal.key) {
      throw new Error(
        `Invalid SimulationState: suspendedExecution.goalKey ("${suspendedExecution.goalKey}") does not ` +
          `match suspendedGoal.key ("${suspendedGoal.key}").`,
      );
    }
    if (suspendedExecution.status !== "interrupted") {
      throw new Error(
        `Invalid SimulationState: a suspended execution must have status "interrupted", got ` +
          `"${suspendedExecution.status}".`,
      );
    }
  }

  // Roster invariant (Stage 2 Slice 2): every roster entry's id must be distinct from the
  // primary colonist's and from every other roster entry's — a duplicate id would make a
  // relationship pair's "known colonist" ambiguous between the simulated colonist and a
  // roster placeholder (or between two roster placeholders).
  assertSafeColonistId(state.colonist.identity.id, "colonist.identity.id");
  const rosterIds = state.roster.map((r) => r.id);
  if (rosterIds.includes(state.colonist.identity.id)) {
    throw new Error(
      `Invalid SimulationState: roster contains "${state.colonist.identity.id}", which duplicates the primary colonist's own id.`,
    );
  }
  const seenRosterIds = new Set<string>();
  for (const id of rosterIds) {
    assertSafeColonistId(id, "roster id");
    if (seenRosterIds.has(id)) {
      throw new Error(`Invalid SimulationState: roster contains duplicate id "${id}".`);
    }
    seenRosterIds.add(id);
  }

  const knownRosterIds = new Set(rosterIds);
  for (const [field, goal] of [
    ["currentGoal", currentGoal],
    ["suspendedGoal", suspendedGoal],
  ] as const) {
    const targetId = goal?.relatedColonistId;
    if (targetId === undefined) continue;
    assertSafeColonistId(targetId, `${field}.relatedColonistId`);
    if (targetId === state.colonist.identity.id) {
      throw new Error(`Invalid SimulationState: ${field}.relatedColonistId must not target the primary colonist's own id.`);
    }
    if (!knownRosterIds.has(targetId)) {
      throw new Error(`Invalid SimulationState: ${field}.relatedColonistId "${targetId}" is not present in the roster.`);
    }
  }
}

/**
 * Validates the outgoing state before returning it — every tick() exit point goes through here.
 * Also the one place this tick's events are committed to the append-only logs (Build Step 9):
 * `state.eventLog`/`state.decisionLog` passed in are the PRIOR logs, unappended — this appends
 * `events` on top via logs.ts (which owns what a record is), keyed to `state.clock.tick`.
 */
function finish(state: SimulationState, events: readonly TickEvent[]): TickResult {
  const { eventLog, decisionLog } = appendTickRecords(state.eventLog, state.decisionLog, state.clock.tick, events);
  const withLogs: SimulationState = {
    ...state,
    eventLog,
    decisionLog,
  };
  validateSimulationState(withLogs);
  return { state: withLogs, events };
}

/** Fresh memory-formation baselines for a newly arrived colonist: needs at 1 (matches createNeeds), stress at 0 (matches createStress), no relationship partners observed yet. */
export function createFreshMemoryBaselines(): Pick<
  SimulationState,
  "deprivationBaselines" | "stressBaseline" | "relationshipAffinityBaselines"
> {
  const deprivationBaselines = {} as Record<NeedId, number>;
  for (const id of NEEDS) deprivationBaselines[id] = 1;
  return { deprivationBaselines, stressBaseline: 0, relationshipAffinityBaselines: {} };
}

function socialNeedRestorePerTick(taskId: TaskId): number {
  switch (taskId) {
    case "conversation":
      return TASK_TUNING.conversationSocialRestorePerTick;
    case "sharedDowntime":
      return TASK_TUNING.sharedDowntimeSocialRestorePerTick;
    default:
      return 0;
  }
}

function companionshipAffinityDeltaPerTick(taskId: TaskId): number {
  switch (taskId) {
    case "conversation":
      return TASK_TUNING.conversationAffinityDeltaPerTick;
    case "sharedDowntime":
      return TASK_TUNING.sharedDowntimeAffinityDeltaPerTick;
    default:
      return 0;
  }
}

function rosterObservations(roster: readonly ColonistIdentity[]): readonly ObservableColonist[] {
  return roster.map((identity) => ({ id: identity.id, ambientState: "resting" }));
}

function sharedMealPartnerId(roster: readonly ColonistIdentity[], ownerId: string, relationships: RelationshipStore): string | undefined {
  const isNonHostile = (state: string) => state !== "hostile" && state !== "fractured";
  return roster.find((identity) => {
    if (identity.id === ownerId) return false;
    // Codex-confirmed defect: gate on BOTH directions — relationship drift is one-way, so
    // checking only ownerId's perspective let a partner who has drifted Hostile toward the
    // owner (while the owner's own view is still neutral) still count as eligible company.
    return (
      isNonHostile(perspective(relationships, ownerId, identity.id).state) &&
      isNonHostile(perspective(relationships, identity.id, ownerId).state)
    );
  })?.id;
}

function detectNeedThresholdCrossings(
  before: ColonistState["needs"],
  after: ColonistState["needs"],
  traits: readonly TraitId[],
): TickEvent[] {
  const events: TickEvent[] = [];
  for (const id of NEEDS) {
    const wasCritical = isCritical(id, before[id].level);
    const isNowCritical = isCritical(id, after[id].level);
    const wasLow = isLow(id, before[id].level, traits);
    const isNowLow = isLow(id, after[id].level, traits);
    if (!wasCritical && isNowCritical) {
      events.push({ kind: "needThresholdCrossing", needId: id, severity: "critical" });
    } else if (!wasLow && isNowLow) {
      events.push({ kind: "needThresholdCrossing", needId: id, severity: "low" });
    }
  }
  return events;
}

/**
 * Suspends the colonist's current active goal, interrupting its execution and retaining BOTH
 * as a paired unit (`suspendedGoal` / `suspendedExecution`) — never interrupting the execution
 * and then dropping it. Single-slot Stage 1 model: an already-occupied suspended pair is
 * explicitly abandoned/aborted first (never silently overwritten) — a documented limitation
 * of not yet having the full goal stack (DQ-D8), made explicit via the suspensionOverflow
 * event rather than lost silently.
 */
function suspendCurrentGoal(
  colonist: ColonistState,
  execution: Execution | null,
  suspendedExecution: Execution | null,
  events: TickEvent[],
): { colonist: ColonistState; execution: Execution | null; suspendedExecution: Execution | null } {
  let interrupted = execution;
  if (interrupted !== null && interrupted.status === "inProgress") {
    interrupted = interruptExecution(interrupted);
    events.push({ kind: "executionInterrupted", taskId: interrupted.taskId, goalKey: interrupted.goalKey });
  }

  let nextColonist = colonist;
  if (nextColonist.suspendedGoal !== null) {
    const abandoned = abandonGoal(nextColonist.suspendedGoal);
    let abandonedExecutionTaskId: TaskId | null = null;
    if (suspendedExecution !== null) {
      abandonedExecutionTaskId = abortExecution(suspendedExecution).taskId;
    }
    events.push({ kind: "suspensionOverflow", abandonedGoalKey: abandoned.key, abandonedExecutionTaskId });
    nextColonist = withSuspendedGoal(nextColonist, null);
  }

  const suspendedGoal = suspendGoal(nextColonist.currentGoal!);
  nextColonist = withSuspendedGoal(withCurrentGoal(nextColonist, null), suspendedGoal);

  return { colonist: nextColonist, execution: null, suspendedExecution: interrupted };
}

/** Adopts a goal (freshly committed) and resolves it to an executable task, beginning a NEW execution, or blocks it. */
function adoptAndResolve(
  colonist: ColonistState,
  goal: Goal,
  snapshot: WorldSnapshot,
  currentTick: number,
  events: TickEvent[],
): { colonist: ColonistState; execution: Execution | null } {
  const resolution = resolveTask(goal, colonist.identity.skills, snapshot);
  events.push({ kind: "taskResolution", resolution });
  if (resolution.kind === "executable") {
    const execution = beginExecution(resolution.task, goal, currentTick);
    events.push({ kind: "executionBegun", taskId: execution.taskId, goalKey: execution.goalKey });
    return { colonist: withCurrentGoal(colonist, goal), execution };
  }
  return { colonist: withCurrentGoal(colonist, resolution.goal), execution: null };
}

/**
 * Resumes a previously suspended goal + execution pair. Re-checks eligibility/availability
 * FIRST (through the current snapshot) — if the task the suspended execution was running is
 * no longer eligible or available, this reports blockage explicitly and discards the stale
 * execution via an explicit abort, rather than silently starting a fresh execution from zero.
 * Only when the original task is still executable does it call resumeExecution on the SAME
 * Execution object, preserving `elapsedTicks`.
 */
function resumeSuspended(
  colonist: ColonistState,
  suspendedExecution: Execution,
  snapshot: WorldSnapshot,
  events: TickEvent[],
): { colonist: ColonistState; execution: Execution | null } {
  const resumedGoal = resumeGoal(colonist.suspendedGoal!);
  const nextColonist = withSuspendedGoal(colonist, null);
  const resolution = resolveTask(resumedGoal, nextColonist.identity.skills, snapshot);
  events.push({ kind: "taskResolution", resolution });

  if (resolution.kind === "executable" && resolution.task.id === suspendedExecution.taskId) {
    const resumed = resumeExecution(suspendedExecution);
    events.push({ kind: "executionResumed", taskId: resumed.taskId, goalKey: resumed.goalKey, elapsedTicks: resumed.elapsedTicks });
    return { colonist: withCurrentGoal(nextColonist, resumedGoal), execution: resumed };
  }

  // The originally-suspended task no longer serves this goal (blocked), or — defensively,
  // though Stage 1's goal→task mapping is deterministic so this branch is not currently
  // reachable — a different task now serves it. Either way: report explicitly, never
  // silently restart the stale execution from zero.
  const aborted = abortExecution(suspendedExecution);
  events.push({ kind: "executionAborted", taskId: aborted.taskId, goalKey: aborted.goalKey });

  if (resolution.kind === "executable") {
    const fresh = beginExecution(resolution.task, resumedGoal, snapshot.tick);
    events.push({ kind: "executionBegun", taskId: fresh.taskId, goalKey: fresh.goalKey });
    return { colonist: withCurrentGoal(nextColonist, resumedGoal), execution: fresh };
  }

  events.push({ kind: "blockage", goalKey: resolution.goal.key, reasons: resolution.reasons });
  return { colonist: withCurrentGoal(nextColonist, resolution.goal), execution: null };
}

/**
 * Advances the simulation by exactly BASE_TICKS_PER_STEP. Pure: returns new state and this
 * tick's event trace; never mutates `state`. Implements the fixed phase order (engineering
 * spec §5): time advance → colonist continuous state (needs/stress) → execution progress and
 * its consequences → condition/trigger detection → decision (only if a trigger fired) → task
 * resolution → execution begin/resume. "World evolution" (phase 2) is a no-op in Stage 1:
 * nothing in the minimal station changes on its own — only execution consequences change it.
 */
export function tick(state: SimulationState, deltaTicks: number): TickResult {
  if (deltaTicks !== BASE_TICKS_PER_STEP) {
    throw new Error(
      `tick() only accepts deltaTicks === BASE_TICKS_PER_STEP (${BASE_TICKS_PER_STEP}); got ${deltaTicks}. ` +
        `Larger timeline advancement must be performed by run() calling tick() repeatedly, so every ` +
        `fixed simulation step is evaluated and no intermediate trigger can be skipped.`,
    );
  }
  validateSimulationState(state); // input boundary — reject malformed state before processing it

  const events: TickEvent[] = [];

  // --- Phase: time advance ---
  const periodBefore = periodAt(state.policy, tickOfDay(state.clock));
  const clock = advance(state.clock, deltaTicks);

  // --- Phase: colonist continuous state (needs, stress) ---
  const traits = state.colonist.identity.baseTraits;
  const needsBefore = state.colonist.needs;
  const decayedNeeds = decayNeeds(needsBefore, deltaTicks, traits);
  events.push(...detectNeedThresholdCrossings(needsBefore, decayedNeeds, traits));

  const stressBefore = state.colonist.stress;
  const isWorking = state.execution !== null && state.execution.status === "inProgress" && state.execution.taskId === "workAtWorkstation";
  const stressResult = evaluateStress(stressBefore, decayedNeeds, deltaTicks, traits, isWorking);
  let colonist = withStress(withNeeds(state.colonist, decayedNeeds), stressResult.state);
  // Retained, not discarded (Copilot-confirmed defect): decision-loop.md:192's hard
  // traceability requirement is "every stress movement must be decomposable into its sources in
  // the inspector" — evaluateStress already computes that decomposition every call, but it was
  // previously thrown away the instant this function returned. Logged only when something
  // actually moved, not on every static tick, to keep the trace meaningfully sized.
  if (stressResult.contributions.some((c) => c.rawDelta !== 0)) {
    events.push({ kind: "stressEvaluated", contributions: stressResult.contributions });
  }
  let world = state.world;
  let execution = state.execution;
  let suspendedExecution = state.suspendedExecution;
  let relationships = state.relationships;
  const relationshipConsequences: RelationshipConsequence[] = [];

  // Copilot-confirmed defect: gated on world.foodStock > 0 too — an in-progress eating
  // execution with depleted stock consumes nothing this tick (see the consumedFood guard
  // below), so it must not exempt the pair from atrophy as if a shared meal occurred.
  const activeSharedMealPartner =
    execution?.status === "inProgress" && execution.taskId === "eatAtFoodStation" && world.foodStock > 0
      ? sharedMealPartnerId(state.roster, colonist.identity.id, relationships)
      : undefined;
  const activeSocialPartner = execution?.status === "inProgress" ? (colonist.currentGoal?.relatedColonistId ?? activeSharedMealPartner) : undefined;
  const activeSocialPair =
    activeSocialPartner !== undefined && (companionshipAffinityDeltaPerTick(execution!.taskId) > 0 || execution!.taskId === "eatAtFoodStation")
      ? canonicalPairId(colonist.identity.id, activeSocialPartner)
      : undefined;
  const atrophyResult = applyAtrophy(relationships, deltaTicks, activeSocialPair);
  relationships = atrophyResult.store;
  relationshipConsequences.push(...atrophyResult.consequences);

  // --- Phase: execution progress and its owned consequences ---
  if (execution !== null && execution.status === "inProgress") {
    const progressed = progressExecution(execution, deltaTicks);
    events.push({ kind: "executionProgressed", taskId: progressed.taskId, elapsedTicks: progressed.elapsedTicks });

    const worldBeforeProgress = world;
    const consequences = applyProgressConsequences(progressed.taskId, colonist.needs, world, deltaTicks, traits);
    if (consequences.needs !== undefined) colonist = withNeeds(colonist, consequences.needs);
    if (consequences.world !== undefined) world = consequences.world;

    const consumedFood =
      progressed.taskId === "eatAtFoodStation" && consequences.world !== undefined ? worldBeforeProgress.foodStock - consequences.world.foodStock : 0;
    if (activeSharedMealPartner !== undefined && consumedFood > 0) {
      // Copilot-confirmed defect: scale by the same restorationFraction the Hunger consequence
      // uses (execution.ts:125-136) — a final tick that consumes only a fraction of
      // foodConsumptionPerTick must not grant the full per-tick Social/affinity credit.
      const fullFoodConsumption = TASK_TUNING.foodConsumptionPerTick * deltaTicks;
      const sharedMealFraction = fullFoodConsumption > 0 ? consumedFood / fullFoodConsumption : 0;
      colonist = withNeeds(
        colonist,
        restoreNeedByAmount(colonist.needs, "social", TASK_TUNING.sharedMealSocialRestorePerTick * deltaTicks * sharedMealFraction, traits),
      );
      const interaction = applyInteraction(relationships, {
        colonistAId: colonist.identity.id,
        colonistBId: activeSharedMealPartner,
        tick: clock.tick,
        changeSource: "sharedTaskCompletion",
        initiatorId: colonist.identity.id,
        responderId: activeSharedMealPartner,
        aTowardBDelta: TASK_TUNING.sharedMealAffinityDeltaPerTick * deltaTicks * sharedMealFraction,
        bTowardADelta: 0,
      });
      relationships = interaction.store;
      relationshipConsequences.push(...interaction.consequences);
    }

    const relatedColonistId = colonist.currentGoal?.relatedColonistId;
    const socialRestorePerTick = socialNeedRestorePerTick(progressed.taskId);
    const affinityDeltaPerTick = companionshipAffinityDeltaPerTick(progressed.taskId);
    if (relatedColonistId !== undefined && (socialRestorePerTick > 0 || affinityDeltaPerTick > 0)) {
      if (socialRestorePerTick > 0) {
        colonist = withNeeds(colonist, restoreNeedByAmount(colonist.needs, "social", socialRestorePerTick * deltaTicks, traits));
      }
      if (affinityDeltaPerTick > 0) {
        const interaction = applyInteraction(relationships, {
          colonistAId: colonist.identity.id,
          colonistBId: relatedColonistId,
          tick: clock.tick,
          changeSource: "sharedTaskCompletion",
          initiatorId: colonist.identity.id,
          responderId: relatedColonistId,
          aTowardBDelta: affinityDeltaPerTick * deltaTicks,
          bTowardADelta: 0,
        });
        relationships = interaction.store;
        relationshipConsequences.push(...interaction.consequences);
      }
    }

    execution = progressed;
  } else if (execution === null && !state.hasBootstrapped) {
    // Genuine initial-state adoption ONLY: fires once, on the first tick a simulation has ever
    // processed. Gating on "no execution" alone (the prior condition) fired every tick a
    // colonist had no execution for ANY reason — including every tick after a goal became
    // blocked — repeating full decision/task-resolution work with no new re-decision trigger
    // and growing the event log unboundedly. Blocked-goal retry has its own trigger (the
    // blockage detection above, and whichever of the six re-decision triggers next fires); it
    // does not need, and must not reuse, this one-time bootstrap signal.
    events.push({ kind: "bootstrap" });
  }
  // Set unconditionally: after this tick has run at all, the state is no longer "genuinely
  // fresh" — regardless of whether bootstrap actually fired (a colonist could begin life with
  // an in-progress execution in a hand-built or future-scenario state, in which case bootstrap
  // correctly never fires at all, and this still becomes permanently true from tick one).
  const hasBootstrapped = true;

  // --- Phase: condition & trigger detection input (the one snapshot this tick reads through).
  // Built here — after execution consequences have settled the world — so both the social
  // offer lifecycle pass below and the trigger/decision phases read the same fixed view.
  const snapshot = buildSnapshot(clock, state.policy, world, rosterObservations(state.roster));

  // --- Phase: social offer lifecycle (Stage 2 Slice 5 — design D3's Phase 6 steps, ADR-21).
  // Every pending offer is examined in ascending id order: expiry → cancellation → hold →
  // response delay → eligibility → acceptance draw. Runs before memory formation so a
  // decline's forcedProximityMutualStress consequence feeds the same M9 pass as every other
  // interaction this tick. Reads pending offers only (ADR-21 Invariant 8).
  let socialOffers = state.socialOffers;
  let prng = state.prng;
  for (const offer of state.socialOffers.offers) {
    if (offer.status !== "pending") continue;
    const goalKey = offerGoalKey(offer);
    const resolved = (status: Exclude<SocialOfferStatus, "pending">, reason: OfferResolutionReason | null): void => {
      socialOffers = resolveOffer(socialOffers, offer.id, status, clock.tick, reason);
      events.push({ kind: "socialOfferResolved", offerId: offer.id, status, reason });
    };
    const abandonInitiatorGoal = (): void => {
      if (colonist.currentGoal?.key === goalKey) {
        abandonGoal(colonist.currentGoal); // legality check — active/blocked → abandoned
        colonist = withCurrentGoal(colonist, null);
      } else if (colonist.suspendedGoal?.key === goalKey) {
        abandonGoal(colonist.suspendedGoal);
        colonist = withSuspendedGoal(colonist, null); // offer-backed suspension has no parked execution
      }
    };
    const declineWithFriction = (reason: OfferResolutionReason): void => {
      resolved("declined", reason);
      // ADR-18 D6's decline row: forced-proximity friction, negative, low, both directions.
      const interaction = applyInteraction(relationships, {
        colonistAId: offer.initiatorId,
        colonistBId: offer.responderId,
        tick: clock.tick,
        changeSource: "forcedProximityMutualStress",
        initiatorId: offer.initiatorId,
        responderId: offer.responderId,
        aTowardBDelta: SOCIAL_OFFER_TUNING.declineAffinityDelta,
        bTowardADelta: SOCIAL_OFFER_TUNING.declineAffinityDelta,
      });
      relationships = interaction.store;
      relationshipConsequences.push(...interaction.consequences);
      abandonInitiatorGoal();
    };

    // 1 — expiry (design D6: reachable when a suspension outlasts the timeout).
    if (clock.tick >= offer.expiresAtTick) {
      resolved("expired", "timeout");
      abandonInitiatorGoal(); // a goal whose offer expired must not later resume into direct execution
      continue;
    }
    // 2 — cancellation: the offer-creating goal was abandoned or replaced (design D6).
    const initiatorHoldsGoal = colonist.currentGoal?.key === goalKey || colonist.suspendedGoal?.key === goalKey;
    if (!initiatorHoldsGoal) {
      resolved("cancelled", "initiatorUnavailable");
      continue;
    }
    // 2b — double-booking guard (design D6): a lower-id pending offer for the same responder
    // wins; the later-created one cancels. Unreachable with one initiator, specified anyway.
    if (socialOffers.offers.some((o) => o.status === "pending" && o.responderId === offer.responderId && o.id < offer.id)) {
      resolved("cancelled", "responderUnavailable");
      abandonInitiatorGoal();
      continue;
    }
    // 3 — hold: a suspended offer-creating goal keeps the offer pending (design D3 step 3).
    if (colonist.suspendedGoal?.key === goalKey) continue;
    // 4 — not yet respondable: the one-tick-minimum response delay (design D3).
    if (clock.tick < offer.respondableAtTick) continue;
    // 5 — responder eligibility (design D4: snapshot facts and directional perspectives only).
    if (!state.roster.some((r) => r.id === offer.responderId)) {
      // No friction: an absent responder is not a known colonist to hold a pair with.
      resolved("declined", "responderNotInRoster");
      abandonInitiatorGoal();
      continue;
    }
    const observed = snapshot.nearbyColonists.find((c) => c.id === offer.responderId);
    if (observed === undefined || !isInterruptibleAmbientState(observed.ambientState)) {
      declineWithFriction("responderNotInterruptible");
      continue;
    }
    const isNonHostile = (s: string) => s !== "hostile" && s !== "fractured";
    if (
      !isNonHostile(perspective(relationships, offer.initiatorId, offer.responderId).state) ||
      !isNonHostile(perspective(relationships, offer.responderId, offer.initiatorId).state)
    ) {
      declineWithFriction("relationshipGate");
      continue;
    }
    // 6 — acceptance draw (design D5): one attributed S1 draw, modulated by the RESPONDER's
    // directional relationship state toward the initiator.
    const responderState = perspective(relationships, offer.responderId, offer.initiatorId).state;
    const acceptanceProbability = SOCIAL_OFFER_TUNING.acceptanceProbability[responderState] ?? 0;
    const draw = next(prng);
    prng = draw.state;
    if (draw.value >= acceptanceProbability) {
      declineWithFriction("acceptanceDraw");
      continue;
    }
    resolved("accepted", null);
    const acceptedGoal = colonist.currentGoal!; // step 3 ruled out suspension; step 2 ruled out absence
    const resolution = resolveTask(acceptedGoal, colonist.identity.skills, snapshot);
    events.push({ kind: "taskResolution", resolution });
    if (resolution.kind === "executable") {
      execution = beginExecution(resolution.task, acceptedGoal, clock.tick);
      events.push({ kind: "executionBegun", taskId: execution.taskId, goalKey: execution.goalKey });
    } else {
      events.push({ kind: "blockage", goalKey: resolution.goal.key, reasons: resolution.reasons });
      colonist = withCurrentGoal(colonist, resolution.goal);
    }
  }
  socialOffers = evictResolvedOffers(socialOffers, SOCIAL_OFFER_TUNING.resolvedOfferRetention);

  // --- Phase: memory formation (M9) — involuntary, from cumulative need/stress movement since
  // each baseline (see SimulationState doc). A need at or above satisfaction, or that has
  // recovered past its own baseline, resets the baseline there (the dip is over); otherwise the
  // baseline vs current level is offered to considerDeprivationFormation, which no-ops below
  // significance. Same pattern for stress against a single running baseline (rising or falling).
  let memory = colonist.memory;
  let deprivationBaselines = state.deprivationBaselines;
  for (const id of NEEDS) {
    const level = colonist.needs[id].level;
    if (isSatisfied(id, level) || level > deprivationBaselines[id]) {
      deprivationBaselines = { ...deprivationBaselines, [id]: level };
      continue;
    }
    const formed = considerDeprivationFormation(memory, clock.tick, id, deprivationBaselines[id], level);
    if (formed !== memory) {
      memory = formed;
      deprivationBaselines = { ...deprivationBaselines, [id]: level };
      events.push({ kind: "memoryFormed", memoryType: "deprivation", needId: id });
    }
  }

  let stressBaseline = state.stressBaseline;
  const conditionFormed = considerConditionFormation(memory, clock.tick, stressBaseline, colonist.stress.level);
  if (conditionFormed !== memory) {
    memory = conditionFormed;
    stressBaseline = colonist.stress.level;
    events.push({ kind: "memoryFormed", memoryType: "condition" });
  }

  // --- Phase: relationship consequences (M10) + Relational memory formation (M9). Social
  // execution may emit accepted-interaction facts; atrophy may emit avoidance facts. Both are
  // fact-only (ADR-20 D7), and this phase reads only each consequence's own delta/resulting
  // affinity fields — never the store's materialized records or their past-interaction log
  // (M10 remains the sole owner of that shape and those rules). Baselines track cumulative
  // movement per partner, the same pattern as `stressBaseline`.
  let relationshipAffinityBaselines = state.relationshipAffinityBaselines;
  for (const consequence of relationshipConsequences) {
    const [min, max] = consequence.pair;
    const ownerIsMin = min === colonist.identity.id;
    const ownerIsMax = max === colonist.identity.id;
    if (!ownerIsMin && !ownerIsMax) continue; // this colonist is not party to the pair
    const otherId = ownerIsMin ? max : min;
    const ownAffinityDelta = ownerIsMin ? consequence.minTowardMaxDelta : consequence.maxTowardMinDelta;
    const currentAffinity = ownerIsMin ? consequence.resultingMinTowardMaxAffinity : consequence.resultingMaxTowardMinAffinity;
    // First sighting of this partner: seed the baseline as of just before this tick's own
    // movement, so cumulative drift is measured from there onward, not lost.
    const baseline = relationshipAffinityBaselines[otherId] ?? currentAffinity - ownAffinityDelta;
    const relationalFormed = considerRelationalFormation(memory, clock.tick, otherId, currentAffinity - baseline);
    if (relationalFormed !== memory) {
      memory = relationalFormed;
      relationshipAffinityBaselines = { ...relationshipAffinityBaselines, [otherId]: currentAffinity };
      events.push({ kind: "memoryFormed", memoryType: "relational", otherId });
    } else {
      relationshipAffinityBaselines = { ...relationshipAffinityBaselines, [otherId]: baseline };
    }
  }

  if (memory !== colonist.memory) {
    colonist = withMemory(colonist, memory);
  }

  // --- Phase: shift-boundary detection (uses the advanced clock; no snapshot needed) ---
  const periodAfter = periodAt(state.policy, tickOfDay(clock));
  if (periodBefore !== periodAfter) {
    events.push({ kind: "shiftBoundary", from: periodBefore, to: periodAfter });
  }

  // --- Phase: condition & trigger detection (reads the snapshot built above) ---
  let triggered = events.some((e) => e.kind === "needThresholdCrossing" || e.kind === "shiftBoundary" || e.kind === "bootstrap");

  // Completion: only checkable if there is an in-progress execution.
  if (execution !== null && execution.status === "inProgress") {
    const needSatisfied = (id: NeedId): boolean => isSatisfied(id, colonist.needs[id].level);
    if (isTaskComplete(execution.taskId, needSatisfied, snapshot)) {
      const completed = completeExecution(execution);
      events.push({ kind: "completion", goalKey: completed.goalKey, taskId: completed.taskId });
      execution = completed;
      if (colonist.currentGoal !== null && colonist.currentGoal.status === "active") {
        colonist = withCurrentGoal(colonist, completeGoal(colonist.currentGoal));
      }
      triggered = true;
    } else if (colonist.currentGoal !== null && colonist.currentGoal.status === "active") {
      // Blockage: is the task this goal is currently running no longer available/eligible?
      const resolution = resolveTask(colonist.currentGoal, colonist.identity.skills, snapshot);
      if (resolution.kind === "blocked") {
        events.push({ kind: "blockage", goalKey: resolution.goal.key, reasons: resolution.reasons });
        execution = abortExecution(execution);
        events.push({ kind: "executionAborted", taskId: execution.taskId, goalKey: execution.goalKey });
        colonist = withCurrentGoal(colonist, resolution.goal);
        triggered = true;
      }
    }
  }

  // Candidate generation happens at most once per tick, reused by both trigger checks below
  // and the decision phase itself — avoiding duplicate calls into goals.ts.
  const candidates = generateCandidates(snapshot, colonist.needs, traits);

  // Interruption check is UNCONDITIONAL — it must run even when another trigger (e.g. a
  // second, unrelated need crossing low) already set `triggered` this tick, because it
  // determines whether the current goal needs to be *properly suspended* (goal-system's
  // suspend model) rather than silently overwritten by whatever the decision phase adopts
  // next. Checking it only when nothing else fired would let a same-tick coincidence skip
  // suspension entirely — a real ordering bug caught while writing this module's tests.
  let wasInterruption = false;
  if (colonist.currentGoal !== null && colonist.currentGoal.status === "active") {
    const outranksCurrent = candidates.some((c) => c.tier < colonist.currentGoal!.tier);
    if (outranksCurrent) {
      events.push({
        kind: "higherPriorityCondition",
        interruptedGoalKey: colonist.currentGoal.key,
        interruptedTier: colonist.currentGoal.tier,
      });
      triggered = true;
      wasInterruption = true;
    }
  }

  // Suspension-resolved is gated behind "no interruption just happened" (Stage 1
  // simplification): an interruption occurring the same tick a suspension might otherwise
  // resolve is resolved in favor of the new interruption — the single-slot suspended-pair
  // model (see suspendCurrentGoal) will handle the old suspended pair via explicit
  // abandonment/abort if a new one needs the slot.
  let resumeFromSuspension = false;
  if (!wasInterruption && colonist.suspendedGoal !== null) {
    const outranksSuspended = candidates.some((c) => c.tier < colonist.suspendedGoal!.tier);
    if (!outranksSuspended) {
      events.push({ kind: "suspensionResolved", goalKey: colonist.suspendedGoal.key });
      triggered = true;
      resumeFromSuspension = true;
    }
  }

  if (!triggered) {
    return finish(
      {
        clock, world, policy: state.policy, colonist, execution, suspendedExecution, prng,
        deprivationBaselines, stressBaseline, relationshipAffinityBaselines, hasBootstrapped, eventLog: state.eventLog, decisionLog: state.decisionLog, relationships, roster: state.roster, socialOffers,
      },
      events,
    );
  }

  // Same-tier commitment stickiness (review fix, 2026-07-10): a trigger fired this tick, but
  // if it was neither an interruption (something now outranks the current goal) nor a
  // suspension-resolution, and the current goal is still active — which, given the
  // completion/blockage checks already ran above whenever an execution was in progress, means
  // it is still executable — then whatever fired (e.g. a second, same-tier need crossing low,
  // or a shift boundary that doesn't affect this goal's source) does not by itself warrant
  // re-deciding. decision-loop §2: "A colonist does not re-litigate their commitment every
  // tick; they re-decide when something happens" — the *something* has to actually bear on the
  // commitment. This is a read of EXISTING signals (wasInterruption, resumeFromSuspension,
  // currentGoal.status) — not a new re-decision trigger; the closed six-trigger list is
  // unchanged, this only gates whether an already-detected trigger is acted on for THIS goal.
  if (!resumeFromSuspension && !wasInterruption && colonist.currentGoal !== null && colonist.currentGoal.status === "active") {
    return finish(
      {
        clock, world, policy: state.policy, colonist, execution, suspendedExecution, prng,
        deprivationBaselines, stressBaseline, relationshipAffinityBaselines, hasBootstrapped, eventLog: state.eventLog, decisionLog: state.decisionLog, relationships, roster: state.roster, socialOffers,
      },
      events,
    );
  }

  // --- Phase: decision (only reached when re-decision is actually warranted) ---

  if (resumeFromSuspension && colonist.suspendedGoal !== null && suspendedExecution !== null) {
    const resumed = resumeSuspended(colonist, suspendedExecution, snapshot, events);
    colonist = resumed.colonist;
    execution = resumed.execution;
    suspendedExecution = null; // the pair is resolved either way (resumed, replaced, or blocked)
  } else if (resumeFromSuspension && colonist.suspendedGoal !== null) {
    // Offer-backed suspended goal (Stage 2 Slice 5): no execution was ever parked — the goal
    // resumes to the active slot with no execution, and its still-pending offer picks back up
    // at the next tick's lifecycle pass (design D3 step 3's hold ending). Nothing to resolve
    // or begin here: execution begins only on acceptance.
    const resumedGoal = resumeGoal(colonist.suspendedGoal);
    colonist = withCurrentGoal(withSuspendedGoal(colonist, null), resumedGoal);
    execution = null;
  } else {
    if (wasInterruption && colonist.currentGoal !== null && colonist.currentGoal.status === "active") {
      const suspended = suspendCurrentGoal(colonist, execution, suspendedExecution, events);
      colonist = suspended.colonist;
      execution = suspended.execution;
      suspendedExecution = suspended.suspendedExecution;
    }

    const decision = decideFromCandidates(candidates, colonist, prng, clock.tick, snapshot, relationships);
    events.push({ kind: "decision", outcome: decision });
    // Every higher-tier candidate the filter found non-actionable and fell through — retained
    // in decision.blockedCandidates (decisionLog persists the full outcome already), and ALSO
    // surfaced as its own "blockage" event so the flat trace shows it without unpacking a
    // decision payload, matching the existing post-commit blockage event's visibility.
    for (const blocked of decision.blockedCandidates) {
      events.push({ kind: "blockage", goalKey: blocked.key, reasons: blocked.reasons });
    }
    prng = decision.prngState;

    if (
      decision.kind === "commit" &&
      decision.goal.relatedColonistId !== undefined &&
      (decision.goal.relatedSocialTaskId === "conversation" || decision.goal.relatedSocialTaskId === "sharedDowntime")
    ) {
      // Stage 2 Slice 5 (design D3, Phase 5): committing a Conversation/Shared Downtime goal
      // creates a pending offer instead of beginning execution — the responder answers in a
      // later tick's lifecycle pass (never this tick: the one-tick response-delay floor).
      // Re-committing an identical intent while its offer is still pending reuses that offer.
      const goal = decision.goal;
      const responderId = decision.goal.relatedColonistId;
      const action = decision.goal.relatedSocialTaskId;
      const existing = socialOffers.offers.find((o) => o.status === "pending" && offerGoalKey(o) === goal.key);
      if (existing === undefined) {
        const created = createPendingOffer({
          store: socialOffers,
          initiatorId: colonist.identity.id,
          responderId,
          action,
          createdAtTick: clock.tick,
          responseDelayTicks: SOCIAL_OFFER_TUNING.responseDelayTicks,
          offerTimeoutTicks: SOCIAL_OFFER_TUNING.offerTimeoutTicks,
        });
        socialOffers = created.store;
        events.push({
          kind: "socialOfferCreated",
          offerId: created.offer.id,
          initiatorId: created.offer.initiatorId,
          responderId: created.offer.responderId,
          action: created.offer.action,
          respondableAtTick: created.offer.respondableAtTick,
          expiresAtTick: created.offer.expiresAtTick,
        });
      }
      colonist = withCurrentGoal(colonist, goal);
      execution = null;
    } else if (decision.kind === "commit") {
      const adopted = adoptAndResolve(colonist, decision.goal, snapshot, clock.tick, events);
      colonist = adopted.colonist;
      execution = adopted.execution;
    } else {
      colonist = withCurrentGoal(colonist, null);
      execution = null;
    }
  }

  return finish(
    {
      clock, world, policy: state.policy, colonist, execution, suspendedExecution, prng,
      deprivationBaselines, stressBaseline, relationshipAffinityBaselines, hasBootstrapped, eventLog: state.eventLog, decisionLog: state.decisionLog, relationships, roster: state.roster, socialOffers,
    },
    events,
  );
}
