// M2 World State — engineering spec §2 M2. Stage 1 minimal station: three modules, one
// resource stock. Owns conditions, never crisis-stage labels (locked #22 — labels are S2's,
// not built yet). Pure immutable updates only: every function returns a new WorldState: no
// exported function ever mutates a WorldState in place.

import { FOOD_STOCK_CAPACITY, MODULE_IDS, type ModuleId } from "../config/constants.js";

/** One module's functional/failed state — the binary fact Stage 1 models (ADR-13's base layer, minimal). */
export interface ModuleState {
  readonly id: ModuleId;
  readonly functional: boolean;
}

/** The station: all three modules plus the food resource stock. */
export interface WorldState {
  readonly modules: Readonly<Record<ModuleId, ModuleState>>;
  readonly foodStock: number;
}

/** Creates the station at simulation start: every module functional, food stock full. */
export function createWorld(): WorldState {
  const modules = {} as Record<ModuleId, ModuleState>;
  for (const id of MODULE_IDS) {
    modules[id] = { id, functional: true };
  }
  return { modules, foodStock: FOOD_STOCK_CAPACITY };
}

function assertModuleId(id: ModuleId): void {
  if (!(MODULE_IDS as readonly string[]).includes(id)) {
    throw new Error(`Unknown module id: ${String(id)}`);
  }
}

/** Sets a module's functional state. Pure — returns a new WorldState; the input is untouched. */
export function setModuleFunctional(world: WorldState, id: ModuleId, functional: boolean): WorldState {
  assertModuleId(id);
  return {
    ...world,
    modules: { ...world.modules, [id]: { id, functional } },
  };
}

/** True when the named module is functional. */
export function isModuleFunctional(world: WorldState, id: ModuleId): boolean {
  assertModuleId(id);
  return world.modules[id].functional;
}

/** Consumes food from stock, clamped at 0. Pure. Rejects negative or non-finite amounts. */
export function consumeFood(world: WorldState, amount: number): WorldState {
  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error(`consumeFood amount must be a non-negative finite number, got ${amount}`);
  }
  return { ...world, foodStock: Math.max(0, world.foodStock - amount) };
}

/** Restocks food, clamped at capacity. Pure. Rejects negative or non-finite amounts. */
export function restockFood(world: WorldState, amount: number): WorldState {
  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error(`restockFood amount must be a non-negative finite number, got ${amount}`);
  }
  return { ...world, foodStock: Math.min(FOOD_STOCK_CAPACITY, world.foodStock + amount) };
}
