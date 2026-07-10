import { describe, expect, it } from "vitest";
import { createStage1Session, runFor, step } from "./loop.js";
import { setSurvivalCondition } from "./world.js";
import { NEED_CALIBRATION } from "./calibration.js";

describe("Stage 1 end-to-end loop", () => {
  it("bootstraps a decision on the very first step (no active goal yet)", () => {
    const session = createStage1Session(1);
    step(session, 10);
    expect(session.events.decisions.length).toBeGreaterThanOrEqual(1);
    expect(session.currentTask).toBeDefined();
  });

  it("runs for a simulated day without throwing, and needs stay within bounds", () => {
    const session = createStage1Session(1);
    runFor(session, NEED_CALIBRATION.max * 0, 10); // no-op guard
    runFor(session, 24 * 60 * 20, 30); // ~24 in-game "hours" at the Stage 1 day-length calibration, in 30s steps
    for (const level of Object.values(session.colonist.needs)) {
      expect(level).toBeGreaterThanOrEqual(0);
      expect(level).toBeLessThanOrEqual(NEED_CALIBRATION.max);
    }
  });

  it("a survival condition immediately overrides ongoing work with a response task", () => {
    const session = createStage1Session(2);
    step(session, 10); // establish an initial (work) commitment
    setSurvivalCondition(session.world, "oxygen-failure", true);
    step(session, 1);
    expect(session.currentTask?.taskClass).toBe("response");
    expect(session.colonist.goalStack.some((g) => g.source === "survival-condition" && g.status === "active")).toBe(true);
  });

  it("hunger satisfaction task completes once the need crosses its satisfaction point, then re-decides", () => {
    const session = createStage1Session(3);
    session.colonist.needs.hunger = NEED_CALIBRATION.criticalThreshold - 1; // force an immediate eat commitment
    step(session, 1);
    expect(session.currentTask?.taskId).toBe("eat");

    // Run until the hunger need is restored past the satisfaction point.
    for (let i = 0; i < 2000 && session.colonist.needs.hunger < NEED_CALIBRATION.satisfactionPoint; i++) {
      step(session, 1);
    }
    expect(session.colonist.needs.hunger).toBeGreaterThanOrEqual(NEED_CALIBRATION.satisfactionPoint);
    expect(session.events.events.some((e) => e.kind === "goal-completed")).toBe(true);
  });

  it("logs decisions with a full, non-empty weight decomposition", () => {
    const session = createStage1Session(4);
    step(session, 10);
    const decision = session.events.decisions[0]!;
    expect(decision.decomposition.total).toBeGreaterThan(0);
    expect(typeof decision.motivation).toBe("string");
    expect(decision.motivation.length).toBeGreaterThan(0);
  });
});
