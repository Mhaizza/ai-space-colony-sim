import { describe, expect, it } from "vitest";
import { createStage1Policy } from "./policy.js";
import { buildSnapshot } from "./snapshot.js";
import { createStage1World, setModuleHealth, setSurvivalCondition } from "./world.js";

describe("M4 snapshot service", () => {
  it("builds a snapshot with time, shift period, and module conditions", () => {
    const world = createStage1World();
    const policy = createStage1Policy("workstation-1");
    const snap = buildSnapshot(world, policy, "c1", 0, new Map());
    expect(snap.shiftPeriod).toBe("work");
    expect(snap.assignedWorkstationId).toBe("workstation-1");
    expect(snap.moduleConditions).toHaveLength(3);
  });

  it("reflects module health and functional facts, never crisis-stage labels", () => {
    const world = createStage1World();
    setModuleHealth(world, "workstation-1", "failing");
    const policy = createStage1Policy("workstation-1");
    const snap = buildSnapshot(world, policy, "c1", 0, new Map());
    const ws = snap.moduleConditions.find((m) => m.id === "workstation-1")!;
    expect(ws.health).toBe("failing");
    expect(ws.functional).toBe(false);
    expect(snap).not.toHaveProperty("crisisStage");
  });

  it("surfaces active survival conditions", () => {
    const world = createStage1World();
    setSurvivalCondition(world, "oxygen-failure", true);
    const policy = createStage1Policy("workstation-1");
    const snap = buildSnapshot(world, policy, "c1", 0, new Map());
    expect(snap.survivalConditions).toContain("oxygen-failure");
  });

  it("excludes the colonist itself from nearbyColonists", () => {
    const world = createStage1World();
    const policy = createStage1Policy("workstation-1");
    const registry = new Map([["c1", "working" as const]]);
    const snap = buildSnapshot(world, policy, "c1", 0, registry);
    expect(snap.nearbyColonists).toHaveLength(0);
  });

  it("includes other colonists' Tier-1 state only", () => {
    const world = createStage1World();
    const policy = createStage1Policy("workstation-1");
    const registry = new Map([
      ["c1", "working" as const],
      ["c2", "resting" as const],
    ]);
    const snap = buildSnapshot(world, policy, "c1", 0, registry);
    expect(snap.nearbyColonists).toEqual([{ id: "c2", state: "resting" }]);
  });
});
