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
import type { ClockState } from "../core/clock.js";
import { advance, tickOfDay } from "../core/clock.js";
import type { PrngState } from "../core/prng.js";
import type { ColonistState } from "../colonist/colonist.js";
import { withCurrentGoal, withMemory, withNeeds, withStress, withSuspendedGoal } from "../colonist/colonist.js";
import { decayNeeds, isCritical, isLow, isSatisfied } from "../colonist/needs.js";
import { considerConditionFormation, considerDeprivationFormation } from "../colonist/memory.js";
import { evaluateStress, type StressContribution } from "../colonist/stress.js";
import type { TraitId } from "../colonist/traits.js";
import type { ShiftPeriod, ShiftPolicy } from "../world/policy.js";
import { periodAt } from "../world/policy.js";
import type { WorldState } from "../world/world.js";
import { buildSnapshot, type WorldSnapshot } from "../world/snapshot.js";
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
  | { readonly kind: "memoryFormed"; readonly memoryType: "deprivation" | "condition"; readonly needId?: NeedId }
  | { readonly kind: "stressEvaluated"; readonly contributions: readonly StressContribution[] };

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
    throw new Error(
      "Invalid SimulationState: suspendedGoal and suspendedExecution must both be null or both be " +
        `present — got suspendedGoal=${suspendedGoal === null ? "null" : `"${suspendedGoal.key}"`}, ` +
        `suspendedExecution=${suspendedExecution === null ? "null" : `"${suspendedExecution.taskId}"`}.`,
    );
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

/** Fresh memory-formation baselines for a newly arrived colonist: needs at 1 (matches createNeeds), stress at 0 (matches createStress). */
export function createFreshMemoryBaselines(): Pick<SimulationState, "deprivationBaselines" | "stressBaseline"> {
  const deprivationBaselines = {} as Record<NeedId, number>;
  for (const id of NEEDS) deprivationBaselines[id] = 1;
  return { deprivationBaselines, stressBaseline: 0 };
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

  // --- Phase: execution progress and its owned consequences ---
  if (execution !== null && execution.status === "inProgress") {
    const progressed = progressExecution(execution, deltaTicks);
    events.push({ kind: "executionProgressed", taskId: progressed.taskId, elapsedTicks: progressed.elapsedTicks });

    const consequences = applyProgressConsequences(progressed.taskId, colonist.needs, world, deltaTicks, traits);
    if (consequences.needs !== undefined) colonist = withNeeds(colonist, consequences.needs);
    if (consequences.world !== undefined) world = consequences.world;

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
  if (memory !== colonist.memory) {
    colonist = withMemory(colonist, memory);
  }

  // --- Phase: shift-boundary detection (uses the advanced clock; no snapshot needed) ---
  const periodAfter = periodAt(state.policy, tickOfDay(clock));
  if (periodBefore !== periodAfter) {
    events.push({ kind: "shiftBoundary", from: periodBefore, to: periodAfter });
  }

  // --- Phase: condition & trigger detection (the one snapshot this tick reads through) ---
  const snapshot = buildSnapshot(clock, state.policy, world);

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
        clock, world, policy: state.policy, colonist, execution, suspendedExecution, prng: state.prng,
        deprivationBaselines, stressBaseline, hasBootstrapped, eventLog: state.eventLog, decisionLog: state.decisionLog,
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
        clock, world, policy: state.policy, colonist, execution, suspendedExecution, prng: state.prng,
        deprivationBaselines, stressBaseline, hasBootstrapped, eventLog: state.eventLog, decisionLog: state.decisionLog,
      },
      events,
    );
  }

  // --- Phase: decision (only reached when re-decision is actually warranted) ---
  let prng = state.prng;

  if (resumeFromSuspension && colonist.suspendedGoal !== null && suspendedExecution !== null) {
    const resumed = resumeSuspended(colonist, suspendedExecution, snapshot, events);
    colonist = resumed.colonist;
    execution = resumed.execution;
    suspendedExecution = null; // the pair is resolved either way (resumed, replaced, or blocked)
  } else {
    if (wasInterruption && colonist.currentGoal !== null && colonist.currentGoal.status === "active") {
      const suspended = suspendCurrentGoal(colonist, execution, suspendedExecution, events);
      colonist = suspended.colonist;
      execution = suspended.execution;
      suspendedExecution = suspended.suspendedExecution;
    }

    const decision = decideFromCandidates(candidates, colonist, prng, clock.tick, snapshot);
    events.push({ kind: "decision", outcome: decision });
    // Every higher-tier candidate the filter found non-actionable and fell through — retained
    // in decision.blockedCandidates (decisionLog persists the full outcome already), and ALSO
    // surfaced as its own "blockage" event so the flat trace shows it without unpacking a
    // decision payload, matching the existing post-commit blockage event's visibility.
    for (const blocked of decision.blockedCandidates) {
      events.push({ kind: "blockage", goalKey: blocked.key, reasons: blocked.reasons });
    }
    prng = decision.prngState;

    if (decision.kind === "commit") {
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
      deprivationBaselines, stressBaseline, hasBootstrapped, eventLog: state.eventLog, decisionLog: state.decisionLog,
    },
    events,
  );
}
