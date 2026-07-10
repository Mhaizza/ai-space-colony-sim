// M6 Need System tests — ADR-17 D2–D6 invariants (validation plan: colonist + needs step).

import { describe, expect, it } from "vitest";
import { BIOLOGICAL_NEEDS, NEEDS, PSYCHOLOGICAL_NEEDS, type NeedId } from "../config/constants.js";
import { NEED_TUNING, REST_AMPLIFIER_SUSTAIN_TICKS } from "../config/tuning.js";
import {
  amplifyUrgencies,
  computeUrgencies,
  createNeeds,
  decayNeeds,
  isCritical,
  isLow,
  isSatisfied,
  rawUrgencies,
  restoreNeed,
  urgency,
  type NeedsState,
} from "./needs.js";

describe("D2 — need state model: single scalar, monotone decay, condition-gated restoration", () => {
  it("starts fully satisfied for all five needs", () => {
    const state = createNeeds();
    for (const id of NEEDS) {
      expect(state[id].level).toBe(1);
      expect(state[id].ticksBelowLow).toBe(0);
    }
  });

  it("decay only ever decreases level (monotone deficit direction)", () => {
    let state = createNeeds();
    let prev = { ...state };
    for (let i = 0; i < 20; i++) {
      state = decayNeeds(state, 100);
      for (const id of NEEDS) {
        expect(state[id].level).toBeLessThanOrEqual(prev[id].level);
      }
      prev = state;
    }
  });

  it("decay clamps at 0 — never negative", () => {
    const state = decayNeeds(createNeeds(), 10_000_000);
    for (const id of NEEDS) {
      expect(state[id].level).toBe(0);
    }
  });

  it("restoration clamps at 1 — never above full", () => {
    let state = decayNeeds(createNeeds(), 1000);
    state = restoreNeed(state, "hunger", 10_000_000);
    expect(state.hunger.level).toBe(1);
  });

  it("decay is pure — does not mutate the input state", () => {
    const state = createNeeds();
    const snapshot = JSON.parse(JSON.stringify(state));
    decayNeeds(state, 500);
    expect(state).toEqual(snapshot);
  });

  it("restoreNeed only changes the targeted need's level", () => {
    const decayed = decayNeeds(createNeeds(), 500);
    const restored = restoreNeed(decayed, "hunger", 50);
    for (const id of NEEDS) {
      if (id !== "hunger") expect(restored[id].level).toBe(decayed[id].level);
    }
  });

  it("rejects non-integer or negative tick counts", () => {
    expect(() => decayNeeds(createNeeds(), 1.5)).toThrow();
    expect(() => decayNeeds(createNeeds(), -1)).toThrow();
    expect(() => restoreNeed(createNeeds(), "rest", -1)).toThrow();
  });
});

describe("D3 — threshold architecture: critical < low < satisfaction point, per need", () => {
  it("satisfaction point is strictly above the low threshold for every need (structural hysteresis)", () => {
    for (const id of NEEDS) {
      expect(NEED_TUNING[id].satisfactionPoint).toBeGreaterThan(NEED_TUNING[id].lowThreshold);
    }
  });

  it("critical threshold, where it exists, is strictly below the low threshold", () => {
    for (const id of NEEDS) {
      const critical = NEED_TUNING[id].criticalThreshold;
      if (critical !== null) {
        expect(critical).toBeLessThan(NEED_TUNING[id].lowThreshold);
      }
    }
  });

  it("hysteresis: a need can be no-longer-low while still not satisfied (satisfy/re-trigger band)", () => {
    const id: NeedId = "hunger";
    const t = NEED_TUNING[id];
    const justAboveLow = t.lowThreshold + 0.01;
    expect(isLow(id, justAboveLow)).toBe(false);
    expect(isSatisfied(id, justAboveLow)).toBe(false);
  });

  it("isSatisfied is true only at or above the satisfaction point", () => {
    const id: NeedId = "rest";
    const t = NEED_TUNING[id];
    expect(isSatisfied(id, t.satisfactionPoint - 0.001)).toBe(false);
    expect(isSatisfied(id, t.satisfactionPoint)).toBe(true);
  });
});

describe("D4 — escalation architecture: biological critical path, psychological structurally cannot reach critical", () => {
  it("every biological need has a critical threshold defined", () => {
    for (const id of BIOLOGICAL_NEEDS) {
      expect(NEED_TUNING[id].criticalThreshold).not.toBeNull();
    }
  });

  it("psychological needs have no critical threshold at all — not just a high one", () => {
    for (const id of PSYCHOLOGICAL_NEEDS) {
      expect(NEED_TUNING[id].criticalThreshold).toBeNull();
    }
  });

  it("no value of a psychological need level ever reports critical — structural, not tunable", () => {
    for (const id of PSYCHOLOGICAL_NEEDS) {
      for (const level of [1, 0.5, 0.1, 0.01, 0]) {
        expect(isCritical(id, level)).toBe(false);
      }
    }
  });

  it("a biological need at level 0 does report critical", () => {
    for (const id of BIOLOGICAL_NEEDS) {
      expect(isCritical(id, 0)).toBe(true);
    }
  });
});

describe("D5 — pressure architecture: monotone urgency, independent per need", () => {
  it("urgency is zero on the satisfied side of the low threshold", () => {
    for (const id of NEEDS) {
      expect(urgency(id, NEED_TUNING[id].lowThreshold)).toBe(0);
      expect(urgency(id, 1)).toBe(0);
    }
  });

  it("urgency grows monotonically as the level drops further past the threshold", () => {
    for (const id of NEEDS) {
      const levels = [0.99, 0.5, 0.2, 0.05, 0].filter((l) => l < NEED_TUNING[id].lowThreshold);
      let prevUrgency = -Infinity;
      for (const level of levels.sort((a, b) => b - a)) {
        const u = urgency(id, level);
        expect(u).toBeGreaterThanOrEqual(prevUrgency);
        prevUrgency = u;
      }
    }
  });

  it("each need's urgency is computed independently — one need's level cannot change another's raw urgency", () => {
    const state = decayNeeds(createNeeds(), 2000);
    const before = rawUrgencies(state);
    const onlyHungerChanged = { ...state, hunger: { level: 0, ticksBelowLow: 99999 } };
    const after = rawUrgencies(onlyHungerChanged);
    for (const id of NEEDS) {
      if (id !== "hunger") expect(after[id]).toBe(before[id]);
    }
  });
});

describe("D6 — Rest amplifier: amplifies existing urgency only, never creates urgency from zero", () => {
  function sustainedRestDeprived(): NeedsState {
    // Decay only rest below low and hold it there long enough to engage the amplifier;
    // other needs stay satisfied so their raw urgency is exactly zero.
    let state = createNeeds();
    state = { ...state, rest: { level: 0, ticksBelowLow: REST_AMPLIFIER_SUSTAIN_TICKS } };
    return state;
  }

  it("a satisfied need's urgency stays exactly zero even under sustained Rest deprivation", () => {
    const state = sustainedRestDeprived();
    const amplified = amplifyUrgencies(state, rawUrgencies(state));
    for (const id of NEEDS) {
      if (id !== "rest") expect(amplified[id]).toBe(0);
    }
  });

  it("amplifies an already-nonzero urgency when Rest deprivation is sustained", () => {
    let state = createNeeds();
    state = {
      ...state,
      rest: { level: 0, ticksBelowLow: REST_AMPLIFIER_SUSTAIN_TICKS },
      hunger: { level: 0.1, ticksBelowLow: 500 },
    };
    const raw = rawUrgencies(state);
    const amplified = amplifyUrgencies(state, raw);
    expect(raw.hunger).toBeGreaterThan(0);
    expect(amplified.hunger).toBeGreaterThan(raw.hunger);
  });

  it("does not engage before the sustain threshold is reached", () => {
    let state = createNeeds();
    state = {
      ...state,
      rest: { level: 0, ticksBelowLow: REST_AMPLIFIER_SUSTAIN_TICKS - 1 },
      hunger: { level: 0.1, ticksBelowLow: 500 },
    };
    const raw = rawUrgencies(state);
    const amplified = amplifyUrgencies(state, raw);
    expect(amplified.hunger).toBe(raw.hunger);
  });

  it("never amplifies Rest's own urgency", () => {
    let state = createNeeds();
    state = { ...state, rest: { level: 0, ticksBelowLow: REST_AMPLIFIER_SUSTAIN_TICKS } };
    const raw = rawUrgencies(state);
    const amplified = amplifyUrgencies(state, raw);
    expect(amplified.rest).toBe(raw.rest);
  });

  it("computeUrgencies composes raw + amplifier consistently", () => {
    const state = decayNeeds(createNeeds(), 3000);
    expect(computeUrgencies(state)).toEqual(amplifyUrgencies(state, rawUrgencies(state)));
  });
});

describe("no direct need-level writes outside this module", () => {
  it("every exported level-changing function returns a new object, never the same reference", () => {
    const state = createNeeds();
    expect(decayNeeds(state, 1)).not.toBe(state);
    expect(restoreNeed(state, "hunger", 1)).not.toBe(state);
  });
});

describe("ADR-17 D7 — trait need-rate/threshold modifier surface actually applied", () => {
  it("a held trait's decay multiplier changes decayNeeds' output for the need it modifies", () => {
    const untraited = decayNeeds(createNeeds(), 500, []);
    const driven = decayNeeds(createNeeds(), 500, ["driven"]);
    // "driven" slows Rest decay (decayMultiplier < 1) and leaves every other need untouched.
    expect(driven.rest.level).toBeGreaterThan(untraited.rest.level);
    expect(driven.hunger.level).toBe(untraited.hunger.level);
  });

  it("a held trait's low-threshold shift changes isLow/urgency for the need it modifies", () => {
    // "driven" shifts Rest's low threshold down (tolerates more deprivation before "low").
    const level = NEED_TUNING.rest.lowThreshold - 0.02; // low for an untraited colonist...
    expect(isLow("rest", level)).toBe(true);
    expect(isLow("rest", level, ["driven"])).toBe(false); // ...not yet for a driven one
    expect(urgency("rest", level, ["driven"])).toBe(0);
  });
});
