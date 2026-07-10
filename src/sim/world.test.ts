import { describe, expect, it } from "vitest";
import {
  consumeResource,
  createStage1World,
  enterOccupancy,
  hasCapacity,
  hasResource,
  leaveOccupancy,
  setModuleHealth,
  setSurvivalCondition,
} from "./world.js";

describe("M2 world state", () => {
  it("creates the Stage 1 station with the minimal module set", () => {
    const world = createStage1World();
    expect([...world.modules.keys()].sort()).toEqual(["food-station-1", "rest-area-1", "workstation-1"]);
  });

  it("a Failing module is not functional; other health states are", () => {
    const world = createStage1World();
    setModuleHealth(world, "rest-area-1", "critical");
    expect(world.modules.get("rest-area-1")!.functional).toBe(true);
    setModuleHealth(world, "rest-area-1", "failing");
    expect(world.modules.get("rest-area-1")!.functional).toBe(false);
  });

  it("occupancy respects capacity", () => {
    const world = createStage1World();
    expect(enterOccupancy(world, "workstation-1")).toBe(true);
    expect(enterOccupancy(world, "workstation-1")).toBe(false); // capacity 1
    leaveOccupancy(world, "workstation-1");
    expect(enterOccupancy(world, "workstation-1")).toBe(true);
  });

  it("a non-functional module has no capacity regardless of occupancy", () => {
    const world = createStage1World();
    setModuleHealth(world, "workstation-1", "failing");
    expect(hasCapacity(world, "workstation-1")).toBe(false);
  });

  it("consumeResource depletes stock and fails when insufficient", () => {
    const world = createStage1World();
    expect(consumeResource(world, "food-station-1", 30)).toBe(true);
    expect(world.modules.get("food-station-1")!.resourceStock).toBe(70);
    expect(consumeResource(world, "food-station-1", 1000)).toBe(false);
  });

  it("hasResource is true for modules without a resource concept", () => {
    const world = createStage1World();
    expect(hasResource(world, "rest-area-1", 1)).toBe(true);
  });

  it("survival conditions are station-wide flags", () => {
    const world = createStage1World();
    expect(world.survivalConditions.size).toBe(0);
    setSurvivalCondition(world, "oxygen-failure", true);
    expect(world.survivalConditions.has("oxygen-failure")).toBe(true);
    setSurvivalCondition(world, "oxygen-failure", false);
    expect(world.survivalConditions.has("oxygen-failure")).toBe(false);
  });
});
