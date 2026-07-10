// M3 Policy System tests — period resolution, permission checks, validation.

import { describe, expect, it } from "vitest";
import { TICKS_PER_DAY } from "../config/constants.js";
import { SHIFT_TUNING } from "../config/tuning.js";
import { createDefaultPolicy, isPermitted, periodAt, validatePolicy } from "./policy.js";

describe("default policy", () => {
  it("matches tuning values and sums to one in-game day", () => {
    const policy = createDefaultPolicy();
    expect(policy).toEqual({
      workTicks: SHIFT_TUNING.workTicks,
      restTicks: SHIFT_TUNING.restTicks,
      freeTicks: SHIFT_TUNING.freeTicks,
    });
    expect(policy.workTicks + policy.restTicks + policy.freeTicks).toBe(TICKS_PER_DAY);
  });
});

describe("policy validation", () => {
  it("rejects periods that do not sum to TICKS_PER_DAY", () => {
    expect(() => validatePolicy({ workTicks: 100, restTicks: 100, freeTicks: 100 })).toThrow();
  });

  it("rejects negative periods", () => {
    expect(() => validatePolicy({ workTicks: -1, restTicks: TICKS_PER_DAY + 1, freeTicks: 0 })).toThrow();
  });

  it("accepts periods that sum exactly to one day", () => {
    expect(() =>
      validatePolicy({ workTicks: 600, restTicks: 600, freeTicks: TICKS_PER_DAY - 1200 }),
    ).not.toThrow();
  });
});

describe("period resolution — fixed order work → rest → free", () => {
  const policy = createDefaultPolicy();

  it("resolves the first tick of the day to work", () => {
    expect(periodAt(policy, 0)).toBe("work");
  });

  it("resolves the boundary tick correctly (work ends, rest begins)", () => {
    expect(periodAt(policy, policy.workTicks - 1)).toBe("work");
    expect(periodAt(policy, policy.workTicks)).toBe("rest");
  });

  it("resolves the rest/free boundary correctly", () => {
    const restEnd = policy.workTicks + policy.restTicks;
    expect(periodAt(policy, restEnd - 1)).toBe("rest");
    expect(periodAt(policy, restEnd)).toBe("free");
  });

  it("resolves the last tick of the day to free", () => {
    expect(periodAt(policy, TICKS_PER_DAY - 1)).toBe("free");
  });

  it("rejects tickOfDay outside [0, TICKS_PER_DAY)", () => {
    expect(() => periodAt(policy, -1)).toThrow();
    expect(() => periodAt(policy, TICKS_PER_DAY)).toThrow();
    expect(() => periodAt(policy, 1.5)).toThrow();
  });

  it("is deterministic", () => {
    expect(periodAt(policy, 500)).toBe(periodAt(policy, 500));
  });
});

describe("permission checks — colony-scope only, trivially permissive (Stage 1)", () => {
  it("is permitted at the single colony scope", () => {
    expect(isPermitted(createDefaultPolicy())).toBe(true);
  });
});
