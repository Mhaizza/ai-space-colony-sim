// Build Step 10 — main/CLI tests: deterministic seeded runs, identical-arguments identical
// output, save/load continuation, replay verification success and failure paths, input
// validation and rejection.

import { describe, expect, it } from "vitest";
import { continueRun, demoRun, runCli, verifySaveReplay } from "./main.js";

describe("deterministic run from seed", () => {
  it("the same seed and tick count produce an identical result, including the save string", () => {
    expect(demoRun(7, 200)).toEqual(demoRun(7, 200));
  });

  it("different seeds produce different results", () => {
    expect(demoRun(1, 200)).not.toEqual(demoRun(2, 200));
  });

  it("the summary reflects the requested tick count", () => {
    expect(demoRun(7, 250).summary.tick).toBe(250);
  });

  it("every demonstration run's own replay verification is a match", () => {
    expect(demoRun(7, 300).replay.kind).toBe("match");
  });
});

describe("same arguments produce identical output (CLI)", () => {
  it("runCli returns byte-identical output for identical argv", () => {
    const args = ["run", "--seed", "7", "--ticks", "200"];
    expect(runCli(args)).toBe(runCli(args));
  });

  it("run output is parseable structured JSON carrying summary, replay line, and save", () => {
    const parsed = JSON.parse(runCli(["run", "--seed", "1", "--ticks", "100"]));
    expect(parsed.command).toBe("run");
    expect(parsed.summary.tick).toBe(100);
    expect(parsed.replay).toContain("match");
    expect(typeof parsed.save).toBe("string");
    expect(parsed.summary.recentEvents.length).toBeLessThanOrEqual(5);
  });
});

describe("load serialized state and continue identically", () => {
  it("continuing a save reaches the same state as an uninterrupted run of the same total length", () => {
    const uninterrupted = demoRun(7, 300);
    const midpoint = demoRun(7, 200);
    const continued = continueRun(midpoint.save, 100);
    expect(continued.save).toBe(uninterrupted.save);
    expect(continued.summary).toEqual(uninterrupted.summary);
  });

  it("the CLI continue command produces the same final summary as the API path", () => {
    const midpoint = demoRun(7, 200);
    const parsed = JSON.parse(runCli(["continue", "--ticks", "100", "--save", midpoint.save]));
    expect(parsed.command).toBe("continue");
    expect(parsed.summary.tick).toBe(300);
    expect(parsed.save).toBe(demoRun(7, 300).save);
  });
});

describe("replay verification paths", () => {
  it("succeeds for an untampered save with the correct seed", () => {
    const output = demoRun(7, 150);
    expect(verifySaveReplay(output.save, 7).kind).toBe("match");
  });

  it("reports divergence for a tampered (structurally valid) record payload", () => {
    const output = demoRun(7, 150);
    const saved = JSON.parse(output.save);
    const idx = saved.eventLog.findIndex((r: any) => r.event.kind === "executionProgressed");
    expect(idx).toBeGreaterThanOrEqual(0);
    saved.eventLog[idx].event.elapsedTicks += 1;
    const result = verifySaveReplay(JSON.stringify(saved), 7);
    expect(result.kind).toBe("divergence");
    if (result.kind === "divergence") {
      expect(result.log).toBe("event");
      expect(result.index).toBe(idx);
      expect(result.recordKind).toBe("executionProgressed");
    }
  });

  it("reports divergence when verifying against the wrong seed — returned, never thrown", () => {
    const output = demoRun(7, 150);
    expect(verifySaveReplay(output.save, 8).kind).toBe("divergence");
  });

  it("the CLI verify command carries both the summary line and the structured result", () => {
    const output = demoRun(7, 100);
    const parsed = JSON.parse(runCli(["verify", "--seed", "7", "--save", output.save]));
    expect(parsed.command).toBe("verify");
    expect(parsed.replay).toContain("match");
    expect(parsed.result.kind).toBe("match");
  });
});

describe("input rejection", () => {
  it("rejects an invalid tick count (negative, non-integer, non-numeric)", () => {
    expect(() => demoRun(1, -5)).toThrow();
    expect(() => demoRun(1, 1.5)).toThrow();
    expect(() => runCli(["run", "--seed", "1", "--ticks", "abc"])).toThrow();
  });

  it("rejects an invalid seed (NaN, non-integer, non-numeric)", () => {
    expect(() => demoRun(Number.NaN, 10)).toThrow();
    expect(() => demoRun(1.5, 10)).toThrow();
    expect(() => runCli(["run", "--seed", "abc", "--ticks", "10"])).toThrow();
  });

  it("rejects malformed serialized input on continue and verify", () => {
    expect(() => continueRun("{not valid json", 10)).toThrow();
    expect(() => verifySaveReplay("42", 1)).toThrow();
    expect(() => runCli(["continue", "--ticks", "10", "--save", "{oops"])).toThrow();
  });

  it("rejects unknown commands and malformed flag pairs", () => {
    expect(() => runCli(["explode"])).toThrow(/Unknown command/);
    expect(() => runCli(["run", "--seed"])).toThrow();
    expect(() => runCli(["run", "seed", "1"])).toThrow();
    expect(() => runCli(["run", "--ticks", "10"])).toThrow(/--seed/);
  });
});
