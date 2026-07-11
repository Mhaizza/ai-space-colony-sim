// M2 World State tests — initialization, immutable updates, failed-module behavior, validation.

import { describe, expect, it } from "vitest";
import { FOOD_STOCK_CAPACITY, MODULE_IDS } from "../config/constants.js";
import {
  consumeFood,
  createWorld,
  isModuleFunctional,
  restockFood,
  setModuleFunctional,
} from "./world.js";

describe("world initialization", () => {
  it("creates exactly the three Stage 1 modules, all functional", () => {
    const world = createWorld();
    expect(Object.keys(world.modules).sort()).toEqual([...MODULE_IDS].sort());
    for (const id of MODULE_IDS) {
      expect(world.modules[id].functional).toBe(true);
      expect(world.modules[id].id).toBe(id);
    }
  });

  it("starts with food stock at full capacity", () => {
    expect(createWorld().foodStock).toBe(FOOD_STOCK_CAPACITY);
  });
});

describe("immutable module updates", () => {
  it("setModuleFunctional returns a new WorldState and does not mutate the input", () => {
    const world = createWorld();
    const updated = setModuleFunctional(world, "foodStation", false);
    expect(updated).not.toBe(world);
    expect(world.modules.foodStation.functional).toBe(true); // input untouched
    expect(updated.modules.foodStation.functional).toBe(false);
  });

  it("updating one module leaves the others untouched", () => {
    const world = createWorld();
    const updated = setModuleFunctional(world, "restBunk", false);
    expect(updated.modules.foodStation).toEqual(world.modules.foodStation);
    expect(updated.modules.workstation).toEqual(world.modules.workstation);
  });

  it("rejects an unknown module id", () => {
    // @ts-expect-error deliberately invalid id to test the runtime guard
    expect(() => setModuleFunctional(createWorld(), "airlock", false)).toThrow();
  });
});

describe("failed-module behavior", () => {
  it("isModuleFunctional reflects the current state", () => {
    const world = setModuleFunctional(createWorld(), "workstation", false);
    expect(isModuleFunctional(world, "workstation")).toBe(false);
    expect(isModuleFunctional(world, "foodStation")).toBe(true);
  });

  it("a failed module can be restored functional", () => {
    let world = setModuleFunctional(createWorld(), "foodStation", false);
    world = setModuleFunctional(world, "foodStation", true);
    expect(isModuleFunctional(world, "foodStation")).toBe(true);
  });
});

describe("food stock — immutable, clamped", () => {
  it("consumeFood reduces stock and does not mutate the input", () => {
    const world = createWorld();
    const updated = consumeFood(world, 30);
    expect(updated).not.toBe(world);
    expect(world.foodStock).toBe(FOOD_STOCK_CAPACITY);
    expect(updated.foodStock).toBe(FOOD_STOCK_CAPACITY - 30);
  });

  it("consumeFood clamps at 0", () => {
    expect(consumeFood(createWorld(), FOOD_STOCK_CAPACITY * 10).foodStock).toBe(0);
  });

  it("restockFood clamps at capacity", () => {
    const depleted = consumeFood(createWorld(), FOOD_STOCK_CAPACITY);
    expect(restockFood(depleted, FOOD_STOCK_CAPACITY * 10).foodStock).toBe(FOOD_STOCK_CAPACITY);
  });

  it("rejects negative or non-finite amounts", () => {
    const world = createWorld();
    expect(() => consumeFood(world, -1)).toThrow();
    expect(() => consumeFood(world, NaN)).toThrow();
    expect(() => consumeFood(world, Infinity)).toThrow();
    expect(() => restockFood(world, -1)).toThrow();
  });
});

describe("determinism", () => {
  it("identical operations on identical inputs produce identical results", () => {
    const a = consumeFood(setModuleFunctional(createWorld(), "foodStation", false), 10);
    const b = consumeFood(setModuleFunctional(createWorld(), "foodStation", false), 10);
    expect(a).toEqual(b);
  });
});
