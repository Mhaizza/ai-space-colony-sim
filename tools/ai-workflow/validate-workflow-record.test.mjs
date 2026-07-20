import assert from "node:assert/strict";
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  collectRoleSlugs,
  formatRoleSlugsManifest,
  generateRoleSlugsManifest,
  ROLE_SLUGS_RELATIVE_PATH,
} from "./generate-role-slugs.mjs";
import {
  extractMarkers,
  findDuplicateObjectKey,
  RECORD_MARKER,
  resetRoleSlugCache,
  validateWorkflowRecord,
  wrapComment,
} from "./validate-workflow-record.mjs";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const EXAMPLE_SHA = "0123456789abcdef0123456789abcdef01234567";
const SHORT_SHA = "0123456789abcdef01234567";
const UPPER_SHA = "0123456789ABCDEF0123456789ABCDEF01234567";

function commentWithPayload(payloadText) {
  return [
    "Human-readable prose above the marker.",
    `<!-- ${RECORD_MARKER}`,
    payloadText,
    "-->",
    "Human-readable prose below the marker.",
  ].join("\n");
}

function commentWithRecord(record) {
  return wrapComment(record);
}

const BASE_START = Object.freeze({
  type: "start_task",
  card: 146,
  worker: "cursor",
  role: "gameplay-engineer",
  artifact: null,
  head: null,
  result: null,
  supersedes: null,
});

test("positive: start_task", () => {
  const result = validateWorkflowRecord(commentWithRecord(BASE_START), { rootDir: REPO_ROOT });
  assert.deepEqual(result.findings, []);
  assert.equal(result.record.type, "start_task");
});

test("positive: handoff", () => {
  const result = validateWorkflowRecord(commentWithRecord({
    type: "handoff",
    card: 146,
    worker: "claude",
    role: "technical-director",
    artifact: null,
    head: null,
    result: null,
    supersedes: 5027448252,
  }), { rootDir: REPO_ROOT });
  assert.deepEqual(result.findings, []);
});

test("positive: review_result with pr: artifact", () => {
  const result = validateWorkflowRecord(commentWithRecord({
    type: "review_result",
    card: 146,
    worker: "chatgpt-reviewer",
    role: "qa-reviewer",
    artifact: "pr:self#147",
    head: EXAMPLE_SHA,
    result: "approved",
    supersedes: null,
  }), { rootDir: REPO_ROOT });
  assert.deepEqual(result.findings, []);
});

test("positive: review_result with path: artifact", () => {
  const result = validateWorkflowRecord(commentWithRecord({
    type: "review_result",
    card: 146,
    worker: "chatgpt-reviewer",
    role: "qa-reviewer",
    artifact: "path:self#ai-studio/adr/0023-mission-control-projection-and-control-boundary.md",
    head: EXAMPLE_SHA,
    result: "revisions_required",
    supersedes: null,
  }), { rootDir: REPO_ROOT });
  assert.deepEqual(result.findings, []);
});

test("positive: human_approval with pr: artifact", () => {
  const result = validateWorkflowRecord(commentWithRecord({
    type: "human_approval",
    card: 146,
    worker: "human",
    role: "human-owner",
    artifact: "pr:self#147",
    head: EXAMPLE_SHA,
    result: null,
    supersedes: null,
  }), { rootDir: REPO_ROOT });
  assert.deepEqual(result.findings, []);
});

test("positive: human_approval with path: artifact", () => {
  const result = validateWorkflowRecord(commentWithRecord({
    type: "human_approval",
    card: 146,
    worker: "human",
    role: "human-owner",
    artifact: "path:self#docs/ai-workflow/README.md",
    head: EXAMPLE_SHA,
    result: null,
    supersedes: null,
  }), { rootDir: REPO_ROOT });
  assert.deepEqual(result.findings, []);
});

test("positive: kanban_update", () => {
  const result = validateWorkflowRecord(commentWithRecord({
    type: "kanban_update",
    card: 146,
    worker: "cursor",
    role: "gameplay-engineer",
    artifact: null,
    head: null,
    result: null,
    supersedes: null,
  }), { rootDir: REPO_ROOT });
  assert.deepEqual(result.findings, []);
});

test("positive: completion with pr: and head", () => {
  const result = validateWorkflowRecord(commentWithRecord({
    type: "completion",
    card: 146,
    worker: "cursor",
    role: "gameplay-engineer",
    artifact: "pr:self#147",
    head: EXAMPLE_SHA,
    result: null,
    supersedes: null,
  }), { rootDir: REPO_ROOT });
  assert.deepEqual(result.findings, []);
});

test("positive: completion with issue: and head null", () => {
  const result = validateWorkflowRecord(commentWithRecord({
    type: "completion",
    card: 146,
    worker: "human",
    role: "human-owner",
    artifact: "issue:self#146",
    head: null,
    result: null,
    supersedes: null,
  }), { rootDir: REPO_ROOT });
  assert.deepEqual(result.findings, []);
});

test("positive: completion with path: and head null", () => {
  const result = validateWorkflowRecord(commentWithRecord({
    type: "completion",
    card: 146,
    worker: "cursor",
    role: "gameplay-engineer",
    artifact: "path:self#docs/ai-workflow/README.md",
    head: null,
    result: null,
    supersedes: null,
  }), { rootDir: REPO_ROOT });
  assert.deepEqual(result.findings, []);
});

test("negative: malformed JSON", () => {
  const result = validateWorkflowRecord(commentWithPayload("{not-json"), { rootDir: REPO_ROOT });
  assert.ok(result.findings.some((f) => f.ruleId === "record.json" && /malformed JSON/i.test(f.message)));
});

test("negative: duplicate JSON member name with identical values", () => {
  const payload =
    '{"type":"start_task","type":"start_task","card":146,"worker":"cursor","role":"gameplay-engineer","artifact":null,"head":null,"result":null,"supersedes":null}';
  assert.equal(findDuplicateObjectKey(payload), "type");
  // Naive JSON.parse would silently accept identical duplicates:
  assert.deepEqual(JSON.parse(payload).type, "start_task");
  const result = validateWorkflowRecord(commentWithPayload(payload), { rootDir: REPO_ROOT });
  assert.ok(result.findings.some((f) =>
    f.ruleId === "record.json" && f.message.includes("duplicate JSON object member name: type")
  ));
});

test("negative: unknown top-level field", () => {
  const result = validateWorkflowRecord(commentWithRecord({
    ...BASE_START,
    extra: "nope",
  }), { rootDir: REPO_ROOT });
  assert.ok(result.findings.some((f) => f.message.includes("Unknown top-level field: extra")));
});

test("negative: required field missing", () => {
  const { supersedes: _ignored, ...without } = BASE_START;
  const result = validateWorkflowRecord(commentWithRecord(without), { rootDir: REPO_ROOT });
  assert.ok(result.findings.some((f) => f.message.includes("Missing required field: supersedes")));
});

test("negative: wrong nullability for the type", () => {
  const result = validateWorkflowRecord(commentWithRecord({
    ...BASE_START,
    artifact: "pr:self#1",
  }), { rootDir: REPO_ROOT });
  assert.ok(result.findings.some((f) =>
    f.ruleId === "record.nullability" && f.message.includes("artifact")
  ));
});

test("negative: unknown type enum member", () => {
  const result = validateWorkflowRecord(commentWithRecord({
    ...BASE_START,
    type: "assignment",
  }), { rootDir: REPO_ROOT });
  assert.ok(result.findings.some((f) => f.ruleId === "record.type"));
});

test("negative: unknown worker enum member", () => {
  const result = validateWorkflowRecord(commentWithRecord({
    ...BASE_START,
    worker: "copilot",
  }), { rootDir: REPO_ROOT });
  assert.ok(result.findings.some((f) => f.ruleId === "record.worker"));
});

test("negative: unknown result enum including approved_with_conditions", () => {
  const result = validateWorkflowRecord(commentWithRecord({
    type: "review_result",
    card: 146,
    worker: "chatgpt-reviewer",
    role: "qa-reviewer",
    artifact: "pr:self#147",
    head: EXAMPLE_SHA,
    result: "approved_with_conditions",
    supersedes: null,
  }), { rootDir: REPO_ROOT });
  assert.ok(result.findings.some((f) =>
    f.ruleId === "record.result" && f.message.includes("approved_with_conditions")
  ));
});

test("negative: role not in RoleSlug manifest", () => {
  const result = validateWorkflowRecord(commentWithRecord({
    ...BASE_START,
    role: "not-a-real-role",
  }), { rootDir: REPO_ROOT });
  assert.ok(result.findings.some((f) =>
    f.ruleId === "record.role" && f.message.includes("not-a-real-role")
  ));
});

test("negative: qa-reviewer role on non-review_result", () => {
  const result = validateWorkflowRecord(commentWithRecord({
    ...BASE_START,
    role: "qa-reviewer",
  }), { rootDir: REPO_ROOT });
  assert.ok(result.findings.some((f) =>
    f.ruleId === "record.role" && /qa-reviewer/i.test(f.message)
  ));
});

test("negative: human-owner role on start_task", () => {
  const result = validateWorkflowRecord(commentWithRecord({
    ...BASE_START,
    role: "human-owner",
  }), { rootDir: REPO_ROOT });
  assert.ok(result.findings.some((f) =>
    f.ruleId === "record.role" && /human-owner/i.test(f.message)
  ));
});

test("negative: human worker as start_task assignment target", () => {
  const result = validateWorkflowRecord(commentWithRecord({
    ...BASE_START,
    worker: "human",
    role: "human-owner",
  }), { rootDir: REPO_ROOT });
  assert.ok(result.findings.some((f) =>
    f.ruleId === "record.worker" || /Worker-class/i.test(f.message)
  ));
});

test("negative: chatgpt-reviewer as handoff assignment target", () => {
  const result = validateWorkflowRecord(commentWithRecord({
    type: "handoff",
    card: 146,
    worker: "chatgpt-reviewer",
    role: "qa-reviewer",
    artifact: null,
    head: null,
    result: null,
    supersedes: 1,
  }), { rootDir: REPO_ROOT });
  assert.ok(result.findings.some((f) => /Worker-class|chatgpt-reviewer/i.test(f.message)));
});

test("negative: abbreviated head", () => {
  const result = validateWorkflowRecord(commentWithRecord({
    type: "review_result",
    card: 146,
    worker: "chatgpt-reviewer",
    role: "qa-reviewer",
    artifact: "pr:self#147",
    head: SHORT_SHA,
    result: "approved",
    supersedes: null,
  }), { rootDir: REPO_ROOT });
  assert.ok(result.findings.some((f) => /40-character|head/i.test(f.message)));
});

test("negative: uppercase hex head", () => {
  const result = validateWorkflowRecord(commentWithRecord({
    type: "human_approval",
    card: 146,
    worker: "human",
    role: "human-owner",
    artifact: "pr:self#147",
    head: UPPER_SHA,
    result: null,
    supersedes: null,
  }), { rootDir: REPO_ROOT });
  assert.ok(result.findings.some((f) => /40-character lowercase|head/i.test(f.message)));
});

test("negative: unqualified ArtifactRef", () => {
  const result = validateWorkflowRecord(commentWithRecord({
    type: "review_result",
    card: 146,
    worker: "chatgpt-reviewer",
    role: "qa-reviewer",
    artifact: "pr:12",
    head: EXAMPLE_SHA,
    result: "approved",
    supersedes: null,
  }), { rootDir: REPO_ROOT });
  assert.ok(result.findings.some((f) => f.ruleId === "record.artifact"));
});

test("negative: unknown RepoQualifier", () => {
  const result = validateWorkflowRecord(commentWithRecord({
    type: "review_result",
    card: 146,
    worker: "chatgpt-reviewer",
    role: "qa-reviewer",
    artifact: "pr:other#12",
    head: EXAMPLE_SHA,
    result: "approved",
    supersedes: null,
  }), { rootDir: REPO_ROOT });
  assert.ok(result.findings.some((f) => /RepoQualifier/i.test(f.message)));
});

test("negative: path traversal forms", () => {
  const cases = [
    "path:self#../secrets",
    "path:self#/etc/passwd",
    "path:self#docs\\ai-workflow\\README.md",
    "path:self#docs/%2e%2e/secrets",
  ];
  for (const artifact of cases) {
    const result = validateWorkflowRecord(commentWithRecord({
      type: "human_approval",
      card: 146,
      worker: "human",
      role: "human-owner",
      artifact,
      head: EXAMPLE_SHA,
      result: null,
      supersedes: null,
    }), { rootDir: REPO_ROOT });
    assert.ok(
      result.findings.some((f) => f.ruleId === "record.artifact"),
      `expected artifact rejection for ${artifact}`,
    );
  }
});

test("negative: issue: artifact on review_result and human_approval", () => {
  for (const type of ["review_result", "human_approval"]) {
    const record = type === "review_result"
      ? {
        type,
        card: 146,
        worker: "chatgpt-reviewer",
        role: "qa-reviewer",
        artifact: "issue:self#146",
        head: EXAMPLE_SHA,
        result: "approved",
        supersedes: null,
      }
      : {
        type,
        card: 146,
        worker: "human",
        role: "human-owner",
        artifact: "issue:self#146",
        head: EXAMPLE_SHA,
        result: null,
        supersedes: null,
      };
    const result = validateWorkflowRecord(commentWithRecord(record), { rootDir: REPO_ROOT });
    assert.ok(result.findings.some((f) => /never issue:/i.test(f.message)), type);
  }
});

test("negative: two markers in one comment body", () => {
  const one = commentWithRecord(BASE_START);
  const two = `${one}\n${commentWithRecord({ ...BASE_START, card: 147 })}`;
  const result = validateWorkflowRecord(two, { rootDir: REPO_ROOT });
  assert.ok(result.findings.some((f) =>
    f.ruleId === "record.marker" && /exactly one/i.test(f.message)
  ));
});

test("negative: zero markers reports no marker found", () => {
  const result = validateWorkflowRecord("Just legacy prose with no machine record.", { rootDir: REPO_ROOT });
  assert.ok(result.findings.some((f) =>
    f.ruleId === "record.marker" && /no ai-workflow-record:v1 marker found/i.test(f.message)
  ));
  assert.equal(extractMarkers("Just legacy prose with no machine record.").length, 0);
});

test("manifest: checked-in role-slugs.json matches current role files plus human-owner", () => {
  const expected = collectRoleSlugs(path.join(REPO_ROOT, "ai-studio", "roles"));
  const checkedIn = JSON.parse(readFileSync(path.join(REPO_ROOT, ROLE_SLUGS_RELATIVE_PATH), "utf8"));
  assert.deepEqual(checkedIn, expected);
  assert.ok(checkedIn.includes("human-owner"));
  assert.equal(checkedIn.length, 9);
  assert.equal(formatRoleSlugsManifest(expected).endsWith("\n"), true);
});

test("manifest: drift is detected when a role file is added without regenerating", () => {
  const tempRoot = mkdtempSync(path.join(tmpdir(), "role-slugs-drift-"));
  try {
    const rolesRoot = path.join(tempRoot, "ai-studio", "roles", "engineering");
    mkdirSync(rolesRoot, { recursive: true });
    writeFileSync(path.join(rolesRoot, "gameplay-engineer.md"), "# Gameplay\n", "utf8");
    writeFileSync(path.join(tempRoot, "ai-studio", "roles", "README.md"), "# Roles\n", "utf8");
    generateRoleSlugsManifest(tempRoot);

    writeFileSync(path.join(rolesRoot, "new-specialist.md"), "# New\n", "utf8");
    const expected = collectRoleSlugs(path.join(tempRoot, "ai-studio", "roles"));
    const checkedIn = JSON.parse(readFileSync(path.join(tempRoot, ROLE_SLUGS_RELATIVE_PATH), "utf8"));
    assert.notDeepEqual(checkedIn, expected);
    assert.ok(expected.includes("new-specialist"));
    assert.ok(!checkedIn.includes("new-specialist"));
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});

test("manifest: generate-role-slugs output is sorted and newline-terminated", () => {
  const tempRoot = mkdtempSync(path.join(tmpdir(), "role-slugs-gen-"));
  try {
    const rolesRoot = path.join(tempRoot, "ai-studio", "roles", "qa");
    mkdirSync(rolesRoot, { recursive: true });
    writeFileSync(path.join(rolesRoot, "qa-reviewer.md"), "# QA\n", "utf8");
    writeFileSync(path.join(tempRoot, "ai-studio", "roles", "README.md"), "# Roles\n", "utf8");
    const result = generateRoleSlugsManifest(tempRoot);
    assert.ok(existsSync(result.absolutePath));
    assert.equal(result.contents, formatRoleSlugsManifest(result.slugs));
    assert.ok(result.contents.endsWith("\n"));
    assert.deepEqual(result.slugs, [...result.slugs].sort((a, b) => a.localeCompare(b)));
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});

function dogfoodMarkersFromFile(relativePath) {
  const absolutePath = path.join(REPO_ROOT, relativePath);
  const content = readFileSync(absolutePath, "utf8");
  const markers = extractMarkers(content);
  assert.ok(markers.length >= 1, `${relativePath} must embed at least one marker`);
  for (const marker of markers) {
    const body = commentWithPayload(marker.payloadText);
    const result = validateWorkflowRecord(body, { rootDir: REPO_ROOT });
    assert.deepEqual(
      result.findings,
      [],
      `${relativePath} marker failed:\n${JSON.stringify(result.findings, null, 2)}\n${marker.payloadText}`,
    );
  }
  return markers.length;
}

test("dogfood: docs/ai-workflow template marker examples validate", () => {
  resetRoleSlugCache();
  assert.equal(dogfoodMarkersFromFile("docs/ai-workflow/start-task-template.md"), 1);
  assert.equal(dogfoodMarkersFromFile("docs/ai-workflow/handoff-template.md"), 1);
  assert.equal(dogfoodMarkersFromFile("docs/ai-workflow/review-template.md"), 1);
  assert.equal(dogfoodMarkersFromFile("docs/ai-workflow/human-approval-template.md"), 1);
  assert.equal(dogfoodMarkersFromFile("docs/ai-workflow/done-update-template.md"), 2);
});

test("dogfood: kanban-update-protocol governed examples validate", () => {
  resetRoleSlugCache();
  assert.equal(dogfoodMarkersFromFile("ai-studio/workflows/kanban-update-protocol.md"), 2);
});
