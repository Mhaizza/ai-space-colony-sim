// M4 — Snapshot Service. Builds the fixed, per-decision world snapshot for
// one colonist. The *only* read path from world to colonist decision —
// perception invariants (spatial bounding, no internals, no crisis-stage
// labels) are enforced here, once, instead of by every consumer.
// [engineering-specification.md §2 M4; decision-loop.md §1b; locked #4, #21, #22]

import { hasCapacity, hasResource } from "./world.js";
import { resolveShiftPeriod } from "./policy.js";
import type {
  ModuleCondition,
  ObservableState,
  Policy,
  SimTime,
  WorldSnapshot,
} from "./types.js";
import type { WorldState } from "./world.js";

/**
 * The observable-state registry: the single source both M4 and the UI read,
 * keeping agent and player knowledge symmetric by construction. Owned by
 * M12; passed in here as a read-only view. [locked #21]
 */
export type ObservableRegistry = ReadonlyMap<string, ObservableState>;

export function buildSnapshot(
  world: WorldState,
  policy: Policy,
  colonistId: string,
  time: SimTime,
  registry: ObservableRegistry,
): WorldSnapshot {
  const moduleConditions: ModuleCondition[] = [...world.modules.values()].map((m) => ({
    id: m.id,
    kind: m.kind,
    health: m.health,
    functional: m.functional,
    hasCapacity: hasCapacity(world, m.id),
    hasResource: hasResource(world, m.id, 1),
  }));

  // Spatially bounded: at Stage 1 (1 colonist), there is no one else to
  // perceive — this is where perceptual bounds (DQ-D2) would filter a
  // multi-colonist registry down to "nearby" once Stage 2 introduces peers.
  const nearbyColonists = [...registry.entries()]
    .filter(([id]) => id !== colonistId)
    .map(([id, state]) => ({ id, state }));

  return {
    time,
    shiftPeriod: resolveShiftPeriod(time),
    assignedWorkstationId: policy.assignedWorkstationId,
    moduleConditions,
    survivalConditions: [...world.survivalConditions],
    nearbyColonists,
  };
}
