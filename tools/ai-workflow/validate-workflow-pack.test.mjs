import assert from "node:assert/strict";
import { existsSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { REQUIRED_FILES, validateWorkflowPack } from "./validate-workflow-pack.mjs";

const SCRIPT_PATH = fileURLToPath(new URL("./validate-workflow-pack.mjs", import.meta.url));

const VALID_CONTENT = {
  "ai-studio/AI_STUDIO_BOOT.md": "# AI Studio Boot Sequence\n\nRead this file first.\n",
  "ai-studio/SYSTEM_MAP.md": "# System Map\n\nRegisters `docs/ai-workflow/` as a Tier 2 subordinate extension.\n",
  "AGENTS.md": "# Agents\n\nRead `ai-studio/AI_STUDIO_BOOT.md` first.\n\nRead `docs/ai-workflow/README.md`.\n\n## Role Routing\nPlanner Implementer Reviewer Workflow Operator\n",
  "CLAUDE.md": "# Claude\n\nRead `ai-studio/AI_STUDIO_BOOT.md` first.\n\nRead `docs/ai-workflow/README.md`.\n\n## Role Selection\nImplementer\n",
  "CONTRIBUTING.md": "# Contributing\n\nRead `ai-studio/AI_STUDIO_BOOT.md` first.\n\nSee [workflow](./docs/ai-workflow/README.md).\n\n## AI Workers\n",
  "docs/README.md": "# Docs\n\nSee [workflow](./ai-workflow/README.md).\n",
  "docs/ai-workflow/README.md": "# AI Workflow Pack\n\n[Model](./operating-model.md) [Prompts](./prompt-pack.md) [Task](./task-template.md) [Start](./start-task-template.md) [PR](./pr-summary-template.md) [Review](./review-template.md) [Done](./done-update-template.md)\n",
  "docs/ai-workflow/operating-model.md": "# AI Agent Operating Model\n\n## Authority Hierarchy\n1. Agents read `ai-studio/AI_STUDIO_BOOT.md` first.\n2. This workflow pack supplements those sources.\n3. During Boot Step 8, use this pack.\n\n## Core Laws\n### Law 1 - No Card, No Work\n### Law 2 - One Card, One Owner\n### Law 3 - Authority First\n### Law 4 - No Silent Scope Expansion\n### Law 5 - Review Before Merge\n### Law 6 - Findings First\n### Law 7 - Exact Next Step\n## Roles\n### Planner\n### Implementer\n### Reviewer\n### Workflow Operator\n### Human Owner\n",
  "docs/ai-workflow/prompt-pack.md": "# Prompt Pack\n\n## 1. Planner\n## 2. Implementer\n## 3. Reviewer\n## 4. Workflow Operator\n",
  "docs/ai-workflow/task-template.md": "# Task Template\nTitle:\nGoal:\nIn Scope:\nOut of Scope:\nDependencies:\nAuthority:\nRisks:\nAcceptance Criteria:\nRequired Validation:\nWorkflow Gates:\nExact Next Step:\n",
  "docs/ai-workflow/start-task-template.md": "# Start Task Template\nTask:\nGoal:\nAcceptance Criteria:\nFiles Expected To Change:\nDependencies:\nAuthority:\nRisks:\nEstimated Deliverables:\nExact Stop Condition:\n",
  "docs/ai-workflow/pr-summary-template.md": "# PR Summary Template\nSummary\nScope\nAuthority\nChanges\nNot Changed\nValidation\n- `npm --prefix prototype test`:\n- `npm exec --prefix prototype -- tsc --noEmit -p prototype/tsconfig.json`:\nRisks / Notes\nWorkflow\n",
  "docs/ai-workflow/review-template.md": "# Review Template\nFindings:\nOpen Questions / Assumptions:\nVerdict:\nReason:\nRequired Fixes:\nWorkflow State:\nExact Next Step:\n",
  "docs/ai-workflow/done-update-template.md": "# Done Update Template\nCard:\nStatus: Done\nCompleted:\nChanged Files:\nValidation:\nPipeline Trail:\nScope Delivered:\nScope Not Delivered:\nFollow-up Tasks:\nExact Next Step:\n",
  ".github/ISSUE_TEMPLATE/feature-card.md": "---\nname: Feature Card\n---\n## Goal\n## In Scope\n## Out of Scope\n## Dependencies\n## Authority\n## Risks\n## Acceptance Criteria\n## Required Validation\n## Workflow Gates\n## Exact Next Step\n",
  ".github/ISSUE_TEMPLATE/design-card.md": "---\nname: Design Card\n---\n## Goal\n## In Scope\n## Out of Scope\n## Dependencies\n## Authority\n## Risks\n## Acceptance Criteria\n## Required Validation\n## Workflow Gates\n## Exact Next Step\n",
  ".github/ISSUE_TEMPLATE/adr-card.md": "---\nname: ADR Card\n---\n## Goal\n## In Scope\n## Out of Scope\n## Dependencies\n## Authority\n## Risks\n## Acceptance Criteria\n## Required Validation\n## Workflow Gates\n## Exact Next Step\n",
  ".github/ISSUE_TEMPLATE/config.yml": "blank_issues_enabled: true\ncontact_links:\n  - name: AI Workflow Pack\n    url: https://github.com/Mhaizza/ai-space-colony-sim/blob/main/docs/ai-workflow/README.md\n    about: Workflow entrypoint.\n",
  ".github/PULL_REQUEST_TEMPLATE.md": "## Summary\n## Scope\n## Authority\n## Changes\n## Not Changed\n## Validation\n- `npm --prefix prototype test`:\n- `npm exec --prefix prototype -- tsc --noEmit -p prototype/tsconfig.json`:\n## Risks / Notes\n## Workflow\n",
};

function createFixture({ omit = [], overrides = {} } = {}) {
  const root = mkdtempSync(path.join(tmpdir(), "ai-workflow-pack-"));
  for (const relativePath of REQUIRED_FILES) {
    if (omit.includes(relativePath)) continue;
    const destination = path.join(root, relativePath);
    mkdirSync(path.dirname(destination), { recursive: true });
    writeFileSync(destination, overrides[relativePath] ?? VALID_CONTENT[relativePath], "utf8");
  }
  return root;
}

function withFixture(options, assertion) {
  const root = createFixture(options);
  try {
    assertion(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test("accepts a complete workflow pack", () => {
  withFixture({}, (root) => {
    assert.deepEqual(validateWorkflowPack(root).findings, []);
  });
});

test("reports a missing required file", () => {
  withFixture({ omit: [".github/ISSUE_TEMPLATE/adr-card.md"] }, (root) => {
    assert.deepEqual(validateWorkflowPack(root).findings, [{
      file: ".github/ISSUE_TEMPLATE/adr-card.md",
      ruleId: "file.required",
      message: "Required workflow file is missing",
    }]);
  });
});

test("requires AI Studio boot authority file", () => {
  withFixture({ omit: ["ai-studio/AI_STUDIO_BOOT.md"] }, (root) => {
    assert.ok(validateWorkflowPack(root).findings.some((finding) =>
      finding.file === "ai-studio/AI_STUDIO_BOOT.md" &&
      finding.ruleId === "file.required"
    ));
  });
});

test("requires agent entrypoints to reference AI Studio boot", () => {
  withFixture({
    overrides: {
      "AGENTS.md": "# Agents\n\nRead `docs/ai-workflow/README.md`.\n\n## Role Routing\n",
    },
  }, (root) => {
    assert.ok(validateWorkflowPack(root).findings.some((finding) =>
      finding.file === "AGENTS.md" &&
      finding.ruleId === "entrypoint.boot" &&
      finding.message.includes("ai-studio/AI_STUDIO_BOOT.md")
    ));
  });
});

test("requires SYSTEM_MAP to register docs/ai-workflow/", () => {
  withFixture({
    overrides: {
      "ai-studio/SYSTEM_MAP.md": "# System Map\n\nNo workflow pack registration.\n",
    },
  }, (root) => {
    assert.ok(validateWorkflowPack(root).findings.some((finding) =>
      finding.file === "ai-studio/SYSTEM_MAP.md" &&
      finding.ruleId === "system-map.workflow-pack" &&
      finding.message.includes("docs/ai-workflow/")
    ));
  });
});

test("requires operating model authority hierarchy", () => {
  withFixture({
    overrides: {
      "docs/ai-workflow/operating-model.md":
        "# AI Agent Operating Model\n\n## Core Laws\n### Law 1 - No Card, No Work\n### Law 2 - One Card, One Owner\n### Law 3 - Authority First\n### Law 4 - No Silent Scope Expansion\n### Law 5 - Review Before Merge\n### Law 6 - Findings First\n### Law 7 - Exact Next Step\n## Roles\n### Planner\n### Implementer\n### Reviewer\n### Workflow Operator\n### Human Owner\n",
    },
  }, (root) => {
    assert.ok(validateWorkflowPack(root).findings.some((finding) =>
      finding.file === "docs/ai-workflow/operating-model.md" &&
      finding.ruleId === "policy.authority-hierarchy" &&
      finding.message.includes("## Authority Hierarchy")
    ));
  });
});

test("requires Authority in all issue templates", () => {
  withFixture({
    overrides: {
      ".github/ISSUE_TEMPLATE/adr-card.md":
        "---\nname: ADR Card\n---\n## Goal\n## In Scope\n## Out of Scope\n## Dependencies\n## Risks\n## Acceptance Criteria\n## Required Validation\n## Workflow Gates\n## Exact Next Step\n",
    },
  }, (root) => {
    assert.ok(validateWorkflowPack(root).findings.some((finding) =>
      finding.file === ".github/ISSUE_TEMPLATE/adr-card.md" &&
      finding.ruleId === "issue-template.authority" &&
      finding.message.includes("## Authority")
    ));
  });
});

test("requires prototype-aware validation commands in PR templates", () => {
  withFixture({
    overrides: {
      ".github/PULL_REQUEST_TEMPLATE.md":
        "## Summary\n## Scope\n## Authority\n## Changes\n## Not Changed\n## Validation\n- `npm test`:\n- `npx tsc --noEmit`:\n## Risks / Notes\n## Workflow\n",
    },
  }, (root) => {
    const findings = validateWorkflowPack(root).findings;
    assert.ok(findings.some((finding) =>
      finding.file === ".github/PULL_REQUEST_TEMPLATE.md" &&
      finding.ruleId === "pr-template.validation-command" &&
      finding.message.includes("npm --prefix prototype test")
    ));
    assert.ok(findings.some((finding) =>
      finding.file === ".github/PULL_REQUEST_TEMPLATE.md" &&
      finding.ruleId === "pr-template.validation-command" &&
      finding.message.includes("npm exec --prefix prototype -- tsc --noEmit -p prototype/tsconfig.json")
    ));
  });
});

test("reports a missing role prompt", () => {
  withFixture({ overrides: { "docs/ai-workflow/prompt-pack.md": "# Prompt Pack\n\n## 1. Planner\n## 2. Implementer\n## 3. Reviewer\n" } }, (root) => {
    assert.ok(validateWorkflowPack(root).findings.some((finding) =>
      finding.file === "docs/ai-workflow/prompt-pack.md" &&
      finding.ruleId === "prompt.role" &&
      finding.message.includes("Workflow Operator")
    ));
  });
});

test("reports a missing lifecycle template field", () => {
  withFixture({ overrides: { "docs/ai-workflow/start-task-template.md": "# Start Task Template\nTask:\nGoal:\n" } }, (root) => {
    assert.ok(validateWorkflowPack(root).findings.some((finding) =>
      finding.file === "docs/ai-workflow/start-task-template.md" &&
      finding.ruleId === "template.field" &&
      finding.message.includes("Exact Stop Condition:")
    ));
  });
});

test("reports a broken local Markdown link", () => {
  withFixture({ overrides: { "docs/README.md": "# Docs\n\n[Missing](./missing.md)\n" } }, (root) => {
    assert.ok(validateWorkflowPack(root).findings.some((finding) =>
      finding.file === "docs/README.md" &&
      finding.ruleId === "markdown.local-link" &&
      finding.message.includes("missing.md")
    ));
  });
});

test("rejects a local Markdown link that escapes the pack root", () => {
  withFixture({ overrides: { "docs/README.md": "# Docs\n\n[Outside](../..)\n" } }, (root) => {
    const escapedTarget = path.resolve(root, "docs", "../..");
    assert.ok(existsSync(escapedTarget), "escaped parent path must exist so this is not a missing-file case");
    assert.ok(validateWorkflowPack(root).findings.some((finding) =>
      finding.file === "docs/README.md" &&
      finding.ruleId === "markdown.local-link" &&
      finding.message.includes("../..")
    ));
  });
});

test("rejects a relative contact link URL in issue template config", () => {
  withFixture({
    overrides: {
      ".github/ISSUE_TEMPLATE/config.yml":
        "blank_issues_enabled: true\ncontact_links:\n  - name: AI Workflow Pack\n    url: ../docs/ai-workflow/README.md\n    about: Workflow entrypoint.\n",
    },
  }, (root) => {
    assert.ok(validateWorkflowPack(root).findings.some((finding) =>
      finding.file === ".github/ISSUE_TEMPLATE/config.yml" &&
      finding.ruleId === "config.contact-link" &&
      finding.message.includes("../docs/ai-workflow/README.md")
    ));
  });
});

test("sorts findings by file then rule id", () => {
  withFixture({
    omit: ["CLAUDE.md"],
    overrides: { "AGENTS.md": "# Agents\n" },
  }, (root) => {
    const findings = validateWorkflowPack(root).findings;
    const keys = findings.map(({ file, ruleId }) => `${file}:${ruleId}`);
    assert.deepEqual(keys, [...keys].sort((left, right) => left.localeCompare(right)));
  });
});

test("CLI returns non-zero and actionable output for an invalid pack", () => {
  withFixture({ omit: ["AGENTS.md"] }, (root) => {
    const result = spawnSync(process.execPath, [SCRIPT_PATH, root], { encoding: "utf8" });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /AGENTS\.md \[file\.required\]/);
  });
});
