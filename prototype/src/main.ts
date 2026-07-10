// Build Step 10 — headless CLI / entry surface for the Stage 1 prototype. No UI framework, no
// rendering, no networking. Everything here is PURE: functions take arguments (including a
// serialized save as a plain string) and return structured results — no file-system or console
// I/O lives in this module or anywhere below it. A real process entry point would be one line
// outside the simulation core, e.g. `console.log(runCli(process.argv.slice(2)))`; reading or
// writing a save file is likewise that caller's job, never this module's.

import { createInitialState, run } from "./simulation/run.js";
import { deserialize, serialize } from "./core/serialization.js";
import { inspect, summarizeReplay, type InspectionSummary } from "./inspection/inspector.js";
import { verifyReplay, type ReplayResult } from "./replay/replay.js";

/** Fixed Stage 1 demonstration colonist — a constant, so identical arguments give identical runs. */
const DEMO_COLONIST = { id: "colonist-1", name: "Demo", skills: [] as readonly string[], traits: [] as const };

function assertSeed(seed: number): void {
  if (typeof seed !== "number" || !Number.isInteger(seed)) {
    throw new Error(`seed must be a finite integer, got ${String(seed)}`);
  }
}

function assertTicks(ticks: number): void {
  if (typeof ticks !== "number" || !Number.isInteger(ticks) || ticks < 0) {
    throw new Error(`ticks must be a non-negative integer, got ${String(ticks)}`);
  }
}

/** The structured result every run-producing entry point returns. */
export interface RunOutput {
  readonly summary: InspectionSummary;
  /** The complete final state as a versioned save string (core/serialization.ts). */
  readonly save: string;
  /** Replay verification of this run: replayed from its own starting state and compared. */
  readonly replay: ReplayResult;
}

/** Runs the minimal Stage 1 demonstration: fixed colonist, caller's seed and tick count. Pure. */
export function demoRun(seed: number, ticks: number): RunOutput {
  assertSeed(seed);
  assertTicks(ticks);
  const initial = createInitialState(seed, DEMO_COLONIST.id, DEMO_COLONIST.name, DEMO_COLONIST.skills, DEMO_COLONIST.traits);
  const final = run(initial, ticks).finalState;
  return { summary: inspect(final), save: serialize(final), replay: verifyReplay(initial, final) };
}

/** Loads a serialized state and continues it for `ticks` more. Malformed saves are rejected by deserialize. */
export function continueRun(save: string, ticks: number): RunOutput {
  assertTicks(ticks);
  const loaded = deserialize(save);
  const final = run(loaded, ticks).finalState;
  return { summary: inspect(final), save: serialize(final), replay: verifyReplay(loaded, final) };
}

/**
 * Verifies a save's retained records by full replay: rebuilds the run's initial state from
 * `seed` plus the SAVED colonist identity, replays to the save's tick, and compares traces.
 * A divergence (e.g. wrong seed, tampered records) is returned as a result, never thrown —
 * it is a finding, not an input error.
 */
export function verifySaveReplay(save: string, seed: number): ReplayResult {
  assertSeed(seed);
  const state = deserialize(save);
  const { id, name, skills, baseTraits } = state.colonist.identity;
  const initial = createInitialState(seed, id, name, skills, baseTraits);
  return verifyReplay(initial, state);
}

// --- Minimal argv-style command surface ---

function parseFlags(args: readonly string[]): ReadonlyMap<string, string> {
  const flags = new Map<string, string>();
  for (let i = 0; i < args.length; i += 2) {
    const name = args[i]!;
    const value = args[i + 1];
    if (!name.startsWith("--") || value === undefined) {
      throw new Error(`Malformed arguments: expected "--flag value" pairs, got "${name}"`);
    }
    flags.set(name.slice(2), value);
  }
  return flags;
}

function requireFlag(flags: ReadonlyMap<string, string>, name: string): string {
  const value = flags.get(name);
  if (value === undefined) throw new Error(`Missing required flag: --${name}`);
  return value;
}

function numberFlag(flags: ReadonlyMap<string, string>, name: string): number {
  return Number(requireFlag(flags, name));
}

/**
 * Headless command dispatch. Commands:
 *   run      --seed N --ticks N          — demonstration run from a seed
 *   continue --ticks N --save <json>     — load a save and continue
 *   verify   --seed N --save <json>      — replay-verify a save's retained records
 * Returns concise structured output as a JSON string (summary bounded to 5 recent records);
 * printing it is the process wrapper's job. Throws on unknown commands and invalid inputs.
 */
export function runCli(argv: readonly string[]): string {
  const [command, ...rest] = argv;
  const flags = parseFlags(rest);

  switch (command) {
    case "run": {
      const output = demoRun(numberFlag(flags, "seed"), numberFlag(flags, "ticks"));
      return formatOutput("run", output);
    }
    case "continue": {
      const output = continueRun(requireFlag(flags, "save"), numberFlag(flags, "ticks"));
      return formatOutput("continue", output);
    }
    case "verify": {
      const save = requireFlag(flags, "save");
      const replay = verifySaveReplay(save, numberFlag(flags, "seed"));
      return JSON.stringify({ command: "verify", replay: summarizeReplay(replay), result: replay }, null, 2);
    }
    default:
      throw new Error(`Unknown command: ${String(command)} (expected "run", "continue", or "verify")`);
  }
}

function formatOutput(command: string, output: RunOutput): string {
  // Concise inspection view: same summary, recent records bounded to 5. The full save string
  // is included so a `run` output can feed a later `continue`/`verify` with no other storage.
  const { summary, save, replay } = output;
  return JSON.stringify(
    {
      command,
      summary: { ...summary, recentEvents: summary.recentEvents.slice(-5), recentDecisions: summary.recentDecisions.slice(-5) },
      replay: summarizeReplay(replay),
      save,
    },
    null,
    2,
  );
}
