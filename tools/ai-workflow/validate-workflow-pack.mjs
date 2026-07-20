import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const REQUIRED_FILES = Object.freeze([
  "ai-studio/AI_STUDIO_BOOT.md",
  "ai-studio/SYSTEM_MAP.md",
  "AGENTS.md",
  "CLAUDE.md",
  "CONTRIBUTING.md",
  "docs/README.md",
  "docs/ai-workflow/README.md",
  "docs/ai-workflow/operating-model.md",
  "docs/ai-workflow/prompt-pack.md",
  "docs/ai-workflow/task-template.md",
  "docs/ai-workflow/start-task-template.md",
  "docs/ai-workflow/handoff-template.md",
  "docs/ai-workflow/pr-summary-template.md",
  "docs/ai-workflow/review-template.md",
  "docs/ai-workflow/human-approval-template.md",
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
  ["docs/ai-workflow/operating-model.md", "policy.authority-hierarchy", [
    "## Authority Hierarchy",
    "ai-studio/AI_STUDIO_BOOT.md",
    "supplements",
    "Boot Step 8",
  ]],
  ["docs/ai-workflow/prompt-pack.md", "prompt.role", [
    "## 1. Planner", "## 2. Implementer", "## 3. Reviewer", "## 4. Workflow Operator",
  ]],
  ["AGENTS.md", "entrypoint.boot", ["ai-studio/AI_STUDIO_BOOT.md"]],
  ["CLAUDE.md", "entrypoint.boot", ["ai-studio/AI_STUDIO_BOOT.md"]],
  ["CONTRIBUTING.md", "entrypoint.boot", ["ai-studio/AI_STUDIO_BOOT.md"]],
  ["AGENTS.md", "entrypoint.reference", [
    "docs/ai-workflow/README.md",
    "docs/ai-workflow/operating-model.md",
    "docs/ai-workflow/prompt-pack.md",
    "CONTRIBUTING.md",
    "Role Routing",
  ]],
  ["CLAUDE.md", "entrypoint.reference", [
    "docs/ai-workflow/README.md",
    "docs/ai-workflow/operating-model.md",
    "docs/ai-workflow/prompt-pack.md",
    "CONTRIBUTING.md",
    "Role Selection",
  ]],
  ["CONTRIBUTING.md", "entrypoint.reference", [
    "docs/ai-workflow/README.md",
    "docs/ai-workflow/operating-model.md",
    "docs/ai-workflow/prompt-pack.md",
    "AI Workers",
  ]],
  ["docs/README.md", "docs-index.routing", [
    "ai-studio/AI_STUDIO_BOOT.md",
    "ai-workflow/README.md",
    "ai-workflow/operating-model.md",
    "ai-workflow/prompt-pack.md",
  ]],
  ["ai-studio/SYSTEM_MAP.md", "system-map.workflow-pack", ["docs/ai-workflow/"]],
]);

const TEMPLATE_RULES = Object.freeze([
  ["docs/ai-workflow/task-template.md", [
    "Title:", "Goal:", "In Scope:", "Out of Scope:", "Dependencies:", "Authority:", "Risks:",
    "Acceptance Criteria:", "Required Validation:", "Workflow Gates:", "Exact Next Step:",
  ]],
  ["docs/ai-workflow/start-task-template.md", [
    "Task:", "Goal:", "Acceptance Criteria:", "Files Expected To Change:", "Dependencies:",
    "Authority:", "Risks:", "Estimated Deliverables:", "Exact Stop Condition:",
  ]],
  ["docs/ai-workflow/handoff-template.md", [
    "Card:", "From Worker:", "From Role:", "To Worker:", "To Role:", "Reason:",
    "Authority:", "Exact Next Step:",
  ]],
  ["docs/ai-workflow/pr-summary-template.md", [
    "## Summary", "## Scope", "## Authority", "## Changes", "## Not Changed",
    "## Validation", "## Risks / Notes", "## Workflow",
  ]],
  ["docs/ai-workflow/review-template.md", [
    "Findings:", "Open Questions / Assumptions:", "Verdict:", "Reason:",
    "Required Fixes:", "Workflow State:", "Exact Next Step:",
  ]],
  ["docs/ai-workflow/human-approval-template.md", [
    "Card:", "Artifact:", "Head:", "Decision:", "Authority:", "Exact Next Step:",
  ]],
  ["docs/ai-workflow/done-update-template.md", [
    "Card:", "Status: Review | Blocked | Done", "Completed:", "Changed Files:", "Validation:",
    "Pipeline Trail:", "Scope Delivered:", "Scope Not Delivered:", "Follow-up Tasks:",
    "Exact Next Step:",
  ]],
]);

const WORKFLOW_RECORD_MARKER_FILES = Object.freeze([
  "docs/ai-workflow/start-task-template.md",
  "docs/ai-workflow/handoff-template.md",
  "docs/ai-workflow/review-template.md",
  "docs/ai-workflow/human-approval-template.md",
  "docs/ai-workflow/done-update-template.md",
]);

const ISSUE_TEMPLATE_AUTHORITY_FILES = Object.freeze([
  ".github/ISSUE_TEMPLATE/feature-card.md",
  ".github/ISSUE_TEMPLATE/design-card.md",
  ".github/ISSUE_TEMPLATE/adr-card.md",
]);

const PROTOTYPE_VALIDATION_COMMANDS = Object.freeze([
  "npm --prefix prototype test",
  "npm exec --prefix prototype -- tsc --noEmit -p prototype/tsconfig.json",
]);

const PR_TEMPLATE_FILES = Object.freeze([
  ".github/PULL_REQUEST_TEMPLATE.md",
  "docs/ai-workflow/pr-summary-template.md",
]);

const CONTACT_LINK_URL =
  "https://github.com/Mhaizza/ai-space-colony-sim/blob/main/docs/ai-workflow/README.md";

function finding(file, ruleId, message) {
  return { file, ruleId, message };
}

function localMarkdownTargets(content) {
  const inlineTargets = [...content.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)]
    .map((match) => match[1].trim().split("#", 1)[0]);
  const referenceTargets = [...content.matchAll(/^\s*\[[^\]]+\]:\s*<?([^>\s]+)>?/gm)]
    .map((match) => match[1].trim().split("#", 1)[0]);
  return [...inlineTargets, ...referenceTargets]
    .filter((target) => target && !/^(?:https?:|mailto:)/i.test(target));
}

function hasExactTrimmedLine(content, field) {
  return content.split(/\r?\n/).some((line) => line.trim() === field);
}

function escapesRoot(root, resolved) {
  const relative = path.relative(root, resolved);
  return relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative);
}

function contactLinkUrls(content) {
  return [...content.matchAll(/^\s*url:\s*(.+?)\s*$/gm)].map((match) => match[1].trim());
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
      if (!hasExactTrimmedLine(content, field)) {
        findings.push(finding(relativePath, "template.field", `Missing required template field: ${field}`));
      }
    }
  }

  for (const relativePath of WORKFLOW_RECORD_MARKER_FILES) {
    const content = contents.get(relativePath);
    if (content === undefined) continue;
    checksRun += 1;
    if (!content.includes("ai-workflow-record:v1")) {
      findings.push(finding(
        relativePath,
        "template.workflow-record",
        "Missing required contract: ai-workflow-record:v1",
      ));
    }
  }

  for (const relativePath of ISSUE_TEMPLATE_AUTHORITY_FILES) {
    const content = contents.get(relativePath);
    if (content === undefined) continue;
    checksRun += 1;
    if (!content.includes("## Authority")) {
      findings.push(finding(
        relativePath,
        "issue-template.authority",
        "Missing required contract: ## Authority",
      ));
    }
  }

  for (const relativePath of PR_TEMPLATE_FILES) {
    const content = contents.get(relativePath);
    if (content === undefined) continue;
    for (const command of PROTOTYPE_VALIDATION_COMMANDS) {
      checksRun += 1;
      if (!content.includes(command)) {
        findings.push(finding(
          relativePath,
          "pr-template.validation-command",
          `Missing required contract: ${command}`,
        ));
      }
    }
  }

  const configContent = contents.get(".github/ISSUE_TEMPLATE/config.yml");
  if (configContent !== undefined) {
    const urls = contactLinkUrls(configContent);
    checksRun += 1;
    if (urls.length === 0) {
      findings.push(finding(
        ".github/ISSUE_TEMPLATE/config.yml",
        "config.contact-link",
        "Missing contact link URL",
      ));
    }
    for (const url of urls) {
      checksRun += 1;
      if (url !== CONTACT_LINK_URL) {
        findings.push(finding(
          ".github/ISSUE_TEMPLATE/config.yml",
          "config.contact-link",
          `Contact link URL must be absolute canonical URL; got: ${url}`,
        ));
      }
    }
  }

  for (const [relativePath, content] of contents) {
    if (!relativePath.endsWith(".md")) continue;
    for (const target of localMarkdownTargets(content)) {
      checksRun += 1;
      const resolved = path.resolve(root, path.dirname(relativePath), target);
      if (escapesRoot(root, resolved)) {
        findings.push(finding(
          relativePath,
          "markdown.local-link",
          `Local link target escapes workflow pack root: ${target}`,
        ));
        continue;
      }
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
