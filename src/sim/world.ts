// M2 — World State. Owns module health, resource stocks, and active
// survival conditions. Evolves strictly by clock-rated processes and
// colonist task outcomes. [engineering-specification.md §2 M2]

import type { HealthState, ModuleKind, ModuleState, SurvivalCondition } from "./types.js";

export interface WorldState {
  modules: Map<string, ModuleState>;
  survivalConditions: Set<SurvivalCondition>;
}

export function createModule(
  id: string,
  kind: ModuleKind,
  opts: { capacity?: number; resourceStock?: number } = {},
): ModuleState {
  const base: ModuleState = {
    id,
    kind,
    health: "nominal",
    functional: true,
    capacity: opts.capacity ?? 1,
    occupancy: 0,
  };
  return opts.resourceStock === undefined ? base : { ...base, resourceStock: opts.resourceStock };
}

/**
 * Stage 1's minimal station: one food station, one rest area, one
 * workstation — the smallest set that exercises all five task classes'
 * satisfaction/assignment members. [engineering-specification.md §10
 * "prototype-appropriate simplifications: a reduced concrete task list"]
 */
export function createStage1World(): WorldState {
  const modules = new Map<string, ModuleState>();
  modules.set("food-station-1", createModule("food-station-1", "food-station", { capacity: 2, resourceStock: 100 }));
  modules.set("rest-area-1", createModule("rest-area-1", "rest-area", { capacity: 4 }));
  modules.set("workstation-1", createModule("workstation-1", "workstation", { capacity: 1 }));
  return { modules, survivalConditions: new Set() };
}

export function setModuleHealth(world: WorldState, moduleId: string, health: HealthState): void {
  const m = world.modules.get(moduleId);
  if (!m) throw new Error(`Unknown module: ${moduleId}`);
  m.health = health;
  m.functional = health !== "failing";
}

export function enterOccupancy(world: WorldState, moduleId: string): boolean {
  const m = world.modules.get(moduleId);
  if (!m || !m.functional || m.occupancy >= m.capacity) return false;
  m.occupancy += 1;
  return true;
}

export function leaveOccupancy(world: WorldState, moduleId: string): void {
  const m = world.modules.get(moduleId);
  if (!m) return;
  m.occupancy = Math.max(0, m.occupancy - 1);
}

/** Consumes resource stock (e.g. a meal's worth of food); returns false if unavailable. */
export function consumeResource(world: WorldState, moduleId: string, amount: number): boolean {
  const m = world.modules.get(moduleId);
  if (!m || m.resourceStock === undefined || m.resourceStock < amount) return false;
  m.resourceStock -= amount;
  return true;
}

export function hasCapacity(world: WorldState, moduleId: string): boolean {
  const m = world.modules.get(moduleId);
  return m !== undefined && m.functional && m.occupancy < m.capacity;
}

export function hasResource(world: WorldState, moduleId: string, amount = 0): boolean {
  const m = world.modules.get(moduleId);
  if (!m) return false;
  if (m.resourceStock === undefined) return true; // modules without a resource concept always "have" it
  return m.resourceStock >= amount;
}

export function setSurvivalCondition(world: WorldState, condition: SurvivalCondition, active: boolean): void {
  if (active) world.survivalConditions.add(condition);
  else world.survivalConditions.delete(condition);
}
