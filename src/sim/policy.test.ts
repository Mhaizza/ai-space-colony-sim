import { describe, expect, it } from "vitest";
import { SIM_SECONDS_PER_DAY } from "./calibration.js";
import { crossedShiftBoundary, resolveShiftPeriod } from "./policy.js";

describe("M3 policy system — shift skeleton", () => {
  it("resolves work at the start of the day", () => {
    expect(resolveShiftPeriod(0)).toBe("work");
  });

  it("resolves free, then rest, later in the day", () => {
    expect(resolveShiftPeriod(SIM_SECONDS_PER_DAY * 0.5)).toBe("free");
    expect(resolveShiftPeriod(SIM_SECONDS_PER_DAY * 0.8)).toBe("rest");
  });

  it("wraps cleanly across day boundaries", () => {
    expect(resolveShiftPeriod(SIM_SECONDS_PER_DAY * 1.0)).toBe("work");
    expect(resolveShiftPeriod(SIM_SECONDS_PER_DAY * 3 + 10)).toBe("work");
  });

  it("detects a shift boundary crossing between two times", () => {
    const justBeforeFree = SIM_SECONDS_PER_DAY * 0.45 - 1;
    const justAfterFree = SIM_SECONDS_PER_DAY * 0.45 + 1;
    expect(crossedShiftBoundary(justBeforeFree, justAfterFree)).toBe(true);
    expect(crossedShiftBoundary(0, 10)).toBe(false);
  });
});
