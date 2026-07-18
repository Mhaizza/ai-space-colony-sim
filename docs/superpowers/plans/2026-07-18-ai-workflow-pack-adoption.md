# AI Workflow Pack Adoption Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land the permanent AI workflow pack and a deterministic, dependency-free validator that proves Claude, Codex, Cursor, GitHub templates, and human contributors share one workflow contract.

**Architecture:** Repository Markdown files are the policy source of truth. Thin root and GitHub entrypoints route workers to `docs/ai-workflow/operating-model.md`; a standalone Node.js module validates required files, policy tokens, template fields, and local Markdown links without changing repository state.

**Tech Stack:** Markdown, GitHub issue/PR templates, Node.js ESM, built-in `node:test`, built-in `fs`, `path`, and `url` modules.

## Global Constraints

- Parent card is Issue #136; do not create or work on another card.
- Work only on branch `codex/issue-136-workflow-pack`.
- Do not touch `prototype/src/`, gameplay behavior, Issue #135, save/replay state, or ADRs.
- Do not add npm packages or a root package manager manifest.
- `docs/ai-workflow/operating-model.md` is canonical when an entrypoint conflicts with it.
- The validator is read-only and emits findings sorted by file then rule id.
- Do not include `.codex/`, `.codebase-memory/`, session maps, or unrelated drafts.
- Stop after opening a review-ready PR and posting `Kanban Update: Review`; do not merge.

---

## File Map

- `AGENTS.md`: root entrypoint for Codex and general agents.
- `CLAUDE.md`: Claude-specific entrypoint.
- `CONTRIBUTING.md`: human and AI contributor entrypoint.
- `docs/README.md`: documentation index link to the workflow pack.
- `docs/ai-workflow/*.md`: canonical operating model, prompts, and lifecycle templates.
- `.github/ISSUE_TEMPLATE/*.md`: feature, design, and ADR card routing.
- `.github/ISSUE_TEMPLATE/config.yml`: issue chooser configuration with an absolute workflow-pack URL.
- `.github/PULL_REQUEST_TEMPLATE.md`: standard PR evidence and gate fields.
- `tools/ai-workflow/validate-workflow-pack.mjs`: reusable validator API and CLI.
- `tools/ai-workflow/validate-workflow-pack.test.mjs`: isolated positive, negative, ordering, and CLI tests.

### Task 1: Adopt the Canonical Workflow Documents and Entrypoints

**Files:**
- Create: `AGENTS.md`
- Create: `CLAUDE.md`
- Create: `CONTRIBUTING.md`
- Modify: `docs/README.md`
- Create: `docs/ai-workflow/README.md`
- Create: `docs/ai-workflow/operating-model.md`
- Create: `docs/ai-workflow/prompt-pack.md`
- Create: `docs/ai-workflow/task-template.md`
- Create: `docs/ai-workflow/start-task-template.md`
- Create: `docs/ai-workflow/pr-summary-template.md`
- Create: `docs/ai-workflow/review-template.md`
- Create: `docs/ai-workflow/done-update-template.md`
- Create: `.github/ISSUE_TEMPLATE/feature-card.md`
- Create: `.github/ISSUE_TEMPLATE/design-card.md`
- Create: `.github/ISSUE_TEMPLATE/adr-card.md`
- Create: `.github/ISSUE_TEMPLATE/config.yml`
- Create: `.github/PULL_REQUEST_TEMPLATE.md`

**Interfaces:**
- Consumes: Issue #136 and `docs/superpowers/specs/2026-07-18-ai-workflow-pack-adoption-design.md`.
- Produces: the file and token contract consumed by `validateWorkflowPack(rootDir)` in Task 3.

- [ ] **Step 1: Read the approved local draft without modifying its source checkout**

Read the same relative paths under `C:\Users\Mhaiz\Projects\ai-space-colony-sim`. Treat those files as draft input only. Do not stage or modify that checkout.

- [ ] **Step 2: Add the approved draft files to this worktree**

Use `apply_patch` to add the exact draft contents. Preserve these routing requirements:

```text
AGENTS.md -> docs/ai-workflow/README.md, operating-model.md, prompt-pack.md, CONTRIBUTING.md
CLAUDE.md -> docs/ai-workflow/README.md, operating-model.md, prompt-pack.md, CONTRIBUTING.md
CONTRIBUTING.md -> docs/ai-workflow/README.md, operating-model.md, prompt-pack.md
docs/README.md -> docs/ai-workflow/README.md, operating-model.md, prompt-pack.md
```

In `.github/ISSUE_TEMPLATE/config.yml`, use this absolute contact link because GitHub issue chooser contact links do not resolve repository-relative URLs:

```yaml
blank_issues_enabled: true
contact_links:
  - name: AI Workflow Pack
    url: https://github.com/Mhaizza/ai-space-colony-sim/blob/main/docs/ai-workflow/README.md
    about: Start here for the standard planner / implementer / reviewer / closeout workflow.
```

- [ ] **Step 3: Verify the intended file scope**

Run:

```powershell
git status --short
git diff --check
```

Expected: only the files listed in Task 1 plus the already committed design and plan appear; `git diff --check` exits 0.

- [ ] **Step 4: Commit the workflow documents**

```powershell
git add -- AGENTS.md CLAUDE.md CONTRIBUTING.md docs/README.md docs/ai-workflow .github/ISSUE_TEMPLATE .github/PULL_REQUEST_TEMPLATE.md
git commit -m "docs(workflow): adopt permanent AI agent workflow pack"
```

Expected: one documentation/config commit with no gameplay files.

### Task 2: Write the Validator Tests First

**Files:**
- Create: `tools/ai-workflow/validate-workflow-pack.test.mjs`

**Interfaces:**
- Consumes: `REQUIRED_FILES` and `validateWorkflowPack(rootDir)` from Task 3.
- Produces: executable contract tests for file, token, template, link, finding-order, and CLI behavior.

- [ ] **Step 1: Create the test file with a minimal valid fixture**

Create `tools/ai-workflow/validate-workflow-pack.test.mjs` with these imports and fixture contract:

```js
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { REQUIRED_FILES, validateWorkflowPack } from "./validate-workflow-pack.mjs";

const SCRIPT_PATH = fileURLToPath(new URL("./validate-workflow-pack.mjs", import.meta.url));

const VALID_CONTENT = {
  "AGENTS.md": "# Agents\n\nRead `docs/ai-workflow/README.md`.\n\n## Role Routing\nPlanner Implementer Reviewer Workflow Operator\n",
  "CLAUDE.md": "# Claude\n\nRead `docs/ai-workflow/README.md`.\n\n## Role Selection\nImplementer\n",
  "CONTRIBUTING.md": "# Contributing\n\nSee [workflow](./docs/ai-workflow/README.md).\n\n## AI Workers\n",
  "docs/README.md": "# Docs\n\nSee [workflow](./ai-workflow/README.md).\n",
  "docs/ai-workflow/README.md": "# AI Workflow Pack\n\n[Model](./operating-model.md) [Prompts](./prompt-pack.md) [Task](./task-template.md) [Start](./start-task-template.md) [PR](./pr-summary-template.md) [Review](./review-template.md) [Done](./done-update-template.md)\n",
  "docs/ai-workflow/operating-model.md": "# AI Agent Operating Model\n\n## Core Laws\n### Law 1 - No Card, No Work\n### Law 2 - One Card, One Owner\n### Law 3 - Authority First\n### Law 4 - No Silent Scope Expansion\n### Law 5 - Review Before Merge\n### Law 6 - Findings First\n### Law 7 - Exact Next Step\n## Roles\n### Planner\n### Implementer\n### Reviewer\n### Workflow Operator\n### Human Owner\n",
  "docs/ai-workflow/prompt-pack.md": "# Prompt Pack\n\n## 1. Planner\n## 2. Implementer\n## 3. Reviewer\n## 4. Workflow Operator\n",
  "docs/ai-workflow/task-template.md": "# Task Template\nTitle:\nGoal:\nIn Scope:\nOut of Scope:\nDependencies:\nAuthority:\nRisks:\nAcceptance Criteria:\nRequired Validation:\nWorkflow Gates:\nExact Next Step:\n",
  "docs/ai-workflow/start-task-template.md": "# Start Task Template\nTask:\nGoal:\nAcceptance Criteria:\nFiles Expected To Change:\nDependencies:\nAuthority:\nRisks:\nEstimated Deliverables:\nExact Stop Condition:\n",
  "docs/ai-workflow/pr-summary-template.md": "# PR Summary Template\nSummary\nScope\nAuthority\nChanges\nNot Changed\nValidation\nRisks / Notes\nWorkflow\n",
  "docs/ai-workflow/review-template.md": "# Review Template\nFindings:\nOpen Questions / Assumptions:\nVerdict:\nReason:\nRequired Fixes:\nWorkflow State:\nExact Next Step:\n",
  "docs/ai-workflow/done-update-template.md": "# Done Update Template\nCard:\nStatus: Done\nCompleted:\nChanged Files:\nValidation:\nPipeline Trail:\nScope Delivered:\nScope Not Delivered:\nFollow-up Tasks:\nExact Next Step:\n",
  ".github/ISSUE_TEMPLATE/feature-card.md": "---\nname: Feature Card\n---\n## Goal\n## In Scope\n## Out of Scope\n## Dependencies\n## Authority\n## Risks\n## Acceptance Criteria\n## Required Validation\n## Workflow Gates\n## Exact Next Step\n",
  ".github/ISSUE_TEMPLATE/design-card.md": "---\nname: Design Card\n---\n## Goal\n## In Scope\n## Out of Scope\n## Dependencies\n## Authority\n## Risks\n## Acceptance Criteria\n## Required Validation\n## Workflow Gates\n## Exact Next Step\n",
  ".github/ISSUE_TEMPLATE/adr-card.md": "---\nname: ADR Card\n---\n## Goal\n## In Scope\n## Out of Scope\n## Dependencies\n## Risks\n## Acceptance Criteria\n## Required Validation\n## Workflow Gates\n## Exact Next Step\n",
  ".github/ISSUE_TEMPLATE/config.yml": "blank_issues_enabled: true\ncontact_links:\n  - name: AI Workflow Pack\n    url: https://github.com/Mhaizza/ai-space-colony-sim/blob/main/docs/ai-workflow/README.md\n    about: Workflow entrypoint.\n",
  ".github/PULL_REQUEST_TEMPLATE.md": "## Summary\n## Scope\n## Authority\n## Changes\n## Not Changed\n## Validation\n## Risks / Notes\n## Workflow\n",
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
```

- [ ] **Step 2: Add positive and negative contract tests**

Append these tests:

```js
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
```

- [ ] **Step 3: Run tests to verify they fail before implementation**

Run:

```powershell
node --test tools/ai-workflow/validate-workflow-pack.test.mjs
```

Expected: FAIL because `validate-workflow-pack.mjs` does not exist.

- [ ] **Step 4: Commit the failing tests**

```powershell
git add -- tools/ai-workflow/validate-workflow-pack.test.mjs
git commit -m "test(workflow): define workflow pack validation contract"
```

### Task 3: Implement the Dependency-Free Validator

**Files:**
- Create: `tools/ai-workflow/validate-workflow-pack.mjs`

**Interfaces:**
- Produces: `REQUIRED_FILES: readonly string[]` and `validateWorkflowPack(rootDir): { filesChecked: number, checksRun: number, findings: Finding[] }`.
- CLI: `node tools/ai-workflow/validate-workflow-pack.mjs [repositoryRoot]` exits 0 on success and 1 on findings.

- [ ] **Step 1: Implement file, token, template, and link validation**

Create `tools/ai-workflow/validate-workflow-pack.mjs` with this structure and behavior:

```js
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const REQUIRED_FILES = Object.freeze([
  "AGENTS.md",
  "CLAUDE.md",
  "CONTRIBUTING.md",
  "docs/README.md",
  "docs/ai-workflow/README.md",
  "docs/ai-workflow/operating-model.md",
  "docs/ai-workflow/prompt-pack.md",
  "docs/ai-workflow/task-template.md",
  "docs/ai-workflow/start-task-template.md",
  "docs/ai-workflow/pr-summary-template.md",
  "docs/ai-workflow/review-template.md",
  "docs/ai-workflow/done-update-template.md",
  ".github/ISSUE_TEMPLATE/feature-card.md",
  ".github/ISSUE_TEMPLATE/design-card.md",
  ".github/ISSUE_TEMPLATE/adr-card.md",
  ".github/ISSUE_TEMPLATE/config.yml",
  ".github/PULL_REQUEST_TEMPLATE.md",
]);

const TOKEN_RULES = Object.freeze([
  ["docs/ai-workflow/operating-model.md", "policy.law", [
    "Law 1 - No Card, No Work", "Law 2 - One Card, One Owner", "Law 3 - Authority First",
    "Law 4 - No Silent Scope Expansion", "Law 5 - Review Before Merge",
    "Law 6 - Findings First", "Law 7 - Exact Next Step",
  ]],
  ["docs/ai-workflow/operating-model.md", "policy.role", [
    "### Planner", "### Implementer", "### Reviewer", "### Workflow Operator", "### Human Owner",
  ]],
  ["docs/ai-workflow/prompt-pack.md", "prompt.role", [
    "## 1. Planner", "## 2. Implementer", "## 3. Reviewer", "## 4. Workflow Operator",
  ]],
  ["AGENTS.md", "entrypoint.reference", ["docs/ai-workflow/", "Role Routing"]],
  ["CLAUDE.md", "entrypoint.reference", ["docs/ai-workflow/", "Role Selection"]],
  ["CONTRIBUTING.md", "entrypoint.reference", ["docs/ai-workflow/", "AI Workers"]],
]);

const TEMPLATE_RULES = Object.freeze([
  ["docs/ai-workflow/task-template.md", ["Title:", "Goal:", "In Scope:", "Out of Scope:", "Dependencies:", "Authority:", "Risks:", "Acceptance Criteria:", "Required Validation:", "Workflow Gates:", "Exact Next Step:"]],
  ["docs/ai-workflow/start-task-template.md", ["Task:", "Goal:", "Acceptance Criteria:", "Files Expected To Change:", "Dependencies:", "Authority:", "Risks:", "Estimated Deliverables:", "Exact Stop Condition:"]],
  ["docs/ai-workflow/pr-summary-template.md", ["Summary", "Scope", "Authority", "Changes", "Not Changed", "Validation", "Risks / Notes", "Workflow"]],
  ["docs/ai-workflow/review-template.md", ["Findings:", "Open Questions / Assumptions:", "Verdict:", "Reason:", "Required Fixes:", "Workflow State:", "Exact Next Step:"]],
  ["docs/ai-workflow/done-update-template.md", ["Card:", "Status: Done", "Completed:", "Changed Files:", "Validation:", "Pipeline Trail:", "Scope Delivered:", "Scope Not Delivered:", "Follow-up Tasks:", "Exact Next Step:"]],
]);

function finding(file, ruleId, message) {
  return { file, ruleId, message };
}

function localMarkdownTargets(content) {
  return [...content.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)]
    .map((match) => match[1].trim().split("#", 1)[0])
    .filter((target) => target && !/^(?:https?:|mailto:)/i.test(target));
}

export function validateWorkflowPack(rootDir) {
  const root = path.resolve(rootDir);
  const findings = [];
  const contents = new Map();
  let checksRun = 0;

  for (const relativePath of REQUIRED_FILES) {
    checksRun += 1;
    const absolutePath = path.join(root, relativePath);
    if (!existsSync(absolutePath) || !statSync(absolutePath).isFile()) {
      findings.push(finding(relativePath, "file.required", "Required workflow file is missing"));
      continue;
    }
    contents.set(relativePath, readFileSync(absolutePath, "utf8"));
  }

  for (const [relativePath, ruleId, tokens] of TOKEN_RULES) {
    const content = contents.get(relativePath);
    if (content === undefined) continue;
    for (const token of tokens) {
      checksRun += 1;
      if (!content.includes(token)) {
        findings.push(finding(relativePath, ruleId, `Missing required contract: ${token}`));
      }
    }
  }

  for (const [relativePath, fields] of TEMPLATE_RULES) {
    const content = contents.get(relativePath);
    if (content === undefined) continue;
    for (const field of fields) {
      checksRun += 1;
      if (!content.includes(field)) {
        findings.push(finding(relativePath, "template.field", `Missing required template field: ${field}`));
      }
    }
  }

  for (const [relativePath, content] of contents) {
    if (!relativePath.endsWith(".md")) continue;
    for (const target of localMarkdownTargets(content)) {
      checksRun += 1;
      const resolved = path.resolve(root, path.dirname(relativePath), target);
      if (!existsSync(resolved)) {
        findings.push(finding(relativePath, "markdown.local-link", `Local link target does not exist: ${target}`));
      }
    }
  }

  findings.sort((left, right) =>
    left.file.localeCompare(right.file) ||
    left.ruleId.localeCompare(right.ruleId) ||
    left.message.localeCompare(right.message)
  );

  return { filesChecked: contents.size, checksRun, findings };
}

function runCli() {
  const root = process.argv[2] ?? process.cwd();
  const result = validateWorkflowPack(root);
  if (result.findings.length === 0) {
    console.log(`AI workflow pack valid: ${result.filesChecked} files, ${result.checksRun} checks`);
    return 0;
  }
  for (const item of result.findings) {
    console.error(`${item.file} [${item.ruleId}] ${item.message}`);
  }
  console.error(`AI workflow pack invalid: ${result.findings.length} finding(s)`);
  return 1;
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : "";
if (import.meta.url === invokedPath) {
  process.exitCode = runCli();
}
```

- [ ] **Step 2: Run the validator unit tests**

Run:

```powershell
node --test tools/ai-workflow/validate-workflow-pack.test.mjs
```

Expected: 7 tests pass.

- [ ] **Step 3: Run the validator against the repository**

Run:

```powershell
node tools/ai-workflow/validate-workflow-pack.mjs .
```

Expected: exit 0 and `AI workflow pack valid: 17 files, ... checks`.

- [ ] **Step 4: Commit the validator**

```powershell
git add -- tools/ai-workflow/validate-workflow-pack.mjs
git commit -m "feat(workflow): add deterministic workflow pack validator"
```

### Task 4: Document Validation, Run Full Checks, and Open the PR

**Files:**
- Modify: `docs/ai-workflow/README.md`

**Interfaces:**
- Consumes: validator CLI from Task 3.
- Produces: one copy-paste validation command and complete PR evidence for Issue #136.

- [ ] **Step 1: Add the local validation command**

Add this section to `docs/ai-workflow/README.md`:

```markdown
## Validate The Pack

From the repository root, run:

```powershell
node tools/ai-workflow/validate-workflow-pack.mjs .
node --test tools/ai-workflow/validate-workflow-pack.test.mjs
```

The validator is read-only. It checks required workflow files, policy and role contracts, lifecycle template fields, entrypoint routing, and local Markdown links.
```

- [ ] **Step 2: Run workflow validation**

```powershell
node --test tools/ai-workflow/validate-workflow-pack.test.mjs
node tools/ai-workflow/validate-workflow-pack.mjs .
```

Expected: 7 validator tests pass and live validation exits 0.

- [ ] **Step 3: Run the existing prototype regression suite**

From `prototype/` run:

```powershell
npx vitest run --reporter=dot --pool=threads --poolOptions.threads.minThreads=1 --poolOptions.threads.maxThreads=1
npx tsc --noEmit
```

Expected baseline: 24 test files / 634 tests pass; typecheck exits 0.

- [ ] **Step 4: Audit scope and formatting**

From the repository root run:

```powershell
git diff --check origin/main...HEAD
git diff --name-only origin/main...HEAD
git status --short
```

Expected:

- no path under `prototype/src/`;
- no `.codex/`, `.codebase-memory/`, or `docs/maps/` path;
- only Issue #136 design, plan, workflow pack, GitHub templates, validator, and validator tests;
- clean working tree after the final commit.

- [ ] **Step 5: Commit usage documentation and tests**

```powershell
git add -- docs/ai-workflow/README.md tools/ai-workflow/validate-workflow-pack.test.mjs docs/superpowers/plans/2026-07-18-ai-workflow-pack-adoption.md
git commit -m "docs(workflow): document and verify workflow pack validation"
```

- [ ] **Step 6: Push and open a review-ready PR**

```powershell
git push origin codex/issue-136-workflow-pack
gh pr create --base main --head codex/issue-136-workflow-pack --title "tooling(workflow): adopt and validate permanent AI workflow pack" --body-file .github/PULL_REQUEST_TEMPLATE.md
```

Before submitting the PR body, fill every template section with Issue #136, the approved design path, changed files, exact validation results, explicit exclusions, and `Status: Review`. Include `Closes #136` only if the repository workflow permits auto-close after Human-approved merge; otherwise use `Part of #136`.

- [ ] **Step 7: Post the Review-state Kanban Update and stop**

Post on Issue #136:

```markdown
Kanban Update

Card: #136
Status: Review

Completed:
- Workflow pack and entrypoints adopted
- Deterministic validator and tests added
- Claude Implementer handoff completed

Validation:
- workflow validator tests: record the exact pass count printed by `node --test`
- live workflow validation: record the exact file/check count printed by the validator
- prototype suite: record the exact file/test pass counts printed by Vitest
- typecheck: record the successful `npx tsc --noEmit` exit code
- changed-file audit: scoped to #136

Blocked:
- Merge and closeout await Codex Final Review and Human approval

Exact Next Step:
- Codex Reviewer performs findings-first review of the PR
```

Stop. Do not merge, close #136, begin Issue #135, or start another task.
