import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { ROLE_SLUGS_RELATIVE_PATH } from "./generate-role-slugs.mjs";

/**
 * Closed ai-workflow-record:v1 contract (ADR-23 D4).
 * Defined once here and reused by extraction + structural validation.
 */

export const RECORD_MARKER = "ai-workflow-record:v1";

export const RECORD_FIELDS = Object.freeze([
  "type",
  "card",
  "worker",
  "role",
  "artifact",
  "head",
  "result",
  "supersedes",
]);

export const RECORD_TYPES = Object.freeze([
  "start_task",
  "handoff",
  "review_result",
  "human_approval",
  "kanban_update",
  "completion",
]);

export const WORKER_IDS = Object.freeze([
  "codex",
  "claude",
  "cursor",
  "openclaw",
  "human",
  "chatgpt-reviewer",
]);

/** Worker-class identities that may hold a card assignment. */
export const ASSIGNMENT_WORKER_IDS = Object.freeze([
  "codex",
  "claude",
  "cursor",
  "openclaw",
]);

export const REVIEW_RESULTS = Object.freeze([
  "approved",
  "revisions_required",
]);

export const REPO_QUALIFIERS = Object.freeze([
  "self",
  "mission-control",
]);

export const FULL_COMMIT_SHA = /^[0-9a-f]{40}$/;

export const ROLE_QA_REVIEWER = "qa-reviewer";
export const ROLE_HUMAN_OWNER = "human-owner";

const MARKER_PATTERN = /<!--\s*ai-workflow-record:v1\b([\s\S]*?)-->/g;

const DEFAULT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function finding(ruleId, message) {
  return { ruleId, message };
}

function loadRoleSlugs(rootDir = DEFAULT_ROOT) {
  const absolutePath = path.join(path.resolve(rootDir), ROLE_SLUGS_RELATIVE_PATH);
  const parsed = JSON.parse(readFileSync(absolutePath, "utf8"));
  if (!Array.isArray(parsed) || parsed.some((slug) => typeof slug !== "string")) {
    throw new Error(`${ROLE_SLUGS_RELATIVE_PATH} must be a JSON array of strings`);
  }
  return Object.freeze([...parsed]);
}

let cachedRoleSlugs = null;
let cachedRoleSlugsRoot = null;

export function getRoleSlugs(rootDir = DEFAULT_ROOT) {
  const root = path.resolve(rootDir);
  if (cachedRoleSlugs === null || cachedRoleSlugsRoot !== root) {
    cachedRoleSlugs = loadRoleSlugs(root);
    cachedRoleSlugsRoot = root;
  }
  return cachedRoleSlugs;
}

/** Test helper: clear cached manifest between fixtures. */
export function resetRoleSlugCache() {
  cachedRoleSlugs = null;
  cachedRoleSlugsRoot = null;
}

/**
 * Extract raw marker payloads from a GitHub comment body.
 * Returns every match; callers enforce exactly-one.
 */
export function extractMarkers(commentBody) {
  if (typeof commentBody !== "string") {
    return [];
  }
  const markers = [];
  const pattern = new RegExp(MARKER_PATTERN.source, "g");
  let match;
  while ((match = pattern.exec(commentBody)) !== null) {
    markers.push({
      index: match.index,
      rawInner: match[1],
      payloadText: match[1].trim(),
    });
  }
  return markers;
}

function skipWhitespace(source, index) {
  while (index < source.length && /\s/.test(source[index])) index += 1;
  return index;
}

function scanJsonString(source, index) {
  if (source[index] !== "\"") {
    return { error: `Expected string at index ${index}`, index };
  }
  index += 1;
  let value = "";
  while (index < source.length) {
    const ch = source[index];
    if (ch === "\"") {
      return { value, index: index + 1 };
    }
    if (ch === "\\") {
      if (index + 1 >= source.length) {
        return { error: "Unterminated escape in JSON string", index };
      }
      value += source[index + 1];
      index += 2;
      continue;
    }
    value += ch;
    index += 1;
  }
  return { error: "Unterminated JSON string", index };
}

/**
 * Detect duplicate object member names before JSON.parse.
 * Returns the first duplicate key found, or null.
 */
export function findDuplicateObjectKey(source) {
  function scanValue(start) {
    let index = skipWhitespace(source, start);
    if (index >= source.length) {
      return { error: "Unexpected end of JSON", index };
    }
    const ch = source[index];
    if (ch === "{") {
      return scanObject(index + 1);
    }
    if (ch === "[") {
      return scanArray(index + 1);
    }
    if (ch === "\"") {
      const scanned = scanJsonString(source, index);
      if (scrapedError(scanned)) return scanned;
      return { index: scanned.index };
    }
    if (source.startsWith("true", index)) return { index: index + 4 };
    if (source.startsWith("false", index)) return { index: index + 5 };
    if (source.startsWith("null", index)) return { index: index + 4 };
    if (/[-0-9]/.test(ch)) {
      const match = source.slice(index).match(/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/);
      if (!match) return { error: `Invalid number at index ${index}`, index };
      return { index: index + match[0].length };
    }
    return { error: `Unexpected token at index ${index}`, index };
  }

  function scrapedError(result) {
    return Boolean(result.error || result.duplicate);
  }

  function scanObject(start) {
    const seen = new Set();
    let index = skipWhitespace(source, start);
    if (index < source.length && source[index] === "}") {
      return { index: index + 1 };
    }
    while (index < source.length) {
      index = skipWhitespace(source, index);
      const keyScan = scanJsonString(source, index);
      if (keyScan.error) return keyScan;
      const key = keyScan.value;
      if (seen.has(key)) {
        return { duplicate: key, index: keyScan.index };
      }
      seen.add(key);
      index = skipWhitespace(source, keyScan.index);
      if (source[index] !== ":") {
        return { error: `Expected ':' after key at index ${index}`, index };
      }
      const valueScan = scanValue(index + 1);
      if (scrapedError(valueScan)) return valueScan;
      index = skipWhitespace(source, valueScan.index);
      if (source[index] === "}") {
        return { index: index + 1 };
      }
      if (source[index] !== ",") {
        return { error: `Expected ',' or '}' at index ${index}`, index };
      }
      index += 1;
    }
    return { error: "Unterminated JSON object", index };
  }

  function scanArray(start) {
    let index = skipWhitespace(source, start);
    if (index < source.length && source[index] === "]") {
      return { index: index + 1 };
    }
    while (index < source.length) {
      const valueScan = scanValue(index);
      if (scrapedError(valueScan)) return valueScan;
      index = skipWhitespace(source, valueScan.index);
      if (source[index] === "]") {
        return { index: index + 1 };
      }
      if (source[index] !== ",") {
        return { error: `Expected ',' or ']' at index ${index}`, index };
      }
      index += 1;
    }
    return { error: "Unterminated JSON array", index };
  }

  const result = scanValue(0);
  if (result.duplicate) return result.duplicate;
  return null;
}

/**
 * Parse and structurally validate an ArtifactRef.
 * @returns {{ ok: true, kind: string, qualifier: string, value: string } | { ok: false, message: string }}
 */
export function parseArtifactRef(value) {
  if (typeof value !== "string") {
    return { ok: false, message: "artifact must be a string ArtifactRef or null" };
  }

  const match = /^(pr|issue|path):([^#]+)#(.+)$/.exec(value);
  if (!match) {
    return {
      ok: false,
      message: "artifact must use repository-qualified form kind:qualifier#value (unqualified forms are rejected)",
    };
  }

  const [, kind, qualifier, rawValue] = match;
  if (!REPO_QUALIFIERS.includes(qualifier)) {
    return {
      ok: false,
      message: `artifact RepoQualifier must be one of ${REPO_QUALIFIERS.join(" | ")}; got: ${qualifier}`,
    };
  }

  if (kind === "pr" || kind === "issue") {
    if (!/^[1-9]\d*$/.test(rawValue)) {
      return { ok: false, message: `artifact ${kind}: value must be a positive integer` };
    }
    return { ok: true, kind, qualifier, value: rawValue };
  }

  // path:
  if (rawValue.length === 0) {
    return { ok: false, message: "artifact path: value must be a non-empty repository-relative path" };
  }
  if (rawValue.startsWith("/") || rawValue.startsWith("\\") || /^[A-Za-z]:[\\/]/.test(rawValue)) {
    return { ok: false, message: "artifact path: rejects absolute paths" };
  }
  if (rawValue.includes("\\")) {
    return { ok: false, message: "artifact path: rejects backslashes" };
  }
  if (/%2e/i.test(rawValue) || /%2f/i.test(rawValue) || /%5c/i.test(rawValue)) {
    return { ok: false, message: "artifact path: rejects percent-encoded traversal" };
  }
  const segments = rawValue.split("/");
  if (segments.some((segment) => segment.length === 0 || segment === "." || segment === "..")) {
    return { ok: false, message: "artifact path: rejects empty, '.', or '..' segments" };
  }
  return { ok: true, kind, qualifier, value: rawValue };
}

function isPositiveInteger(value) {
  return typeof value === "number" && Number.isInteger(value) && value >= 1;
}

function validateNullability(record, findings) {
  const { type } = record;

  const expectNull = (field) => {
    if (record[field] !== null) {
      findings.push(finding(
        "record.nullability",
        `${type} requires ${field} to be null`,
      ));
    }
  };

  const expectPresent = (field, predicate, message) => {
    if (record[field] === null || record[field] === undefined) {
      findings.push(finding("record.nullability", `${type} requires ${field} to be present (non-null)`));
      return false;
    }
    if (predicate && !predicate(record[field])) {
      findings.push(finding("record.field", message));
      return false;
    }
    return true;
  };

  switch (type) {
    case "start_task":
      expectPresent("worker", (v) => ASSIGNMENT_WORKER_IDS.includes(v),
        "start_task worker must be a Worker-class identity (never human or chatgpt-reviewer)");
      if (record.worker !== null && WORKER_IDS.includes(record.worker) && !ASSIGNMENT_WORKER_IDS.includes(record.worker)) {
        findings.push(finding(
          "record.worker",
          "start_task worker must be a Worker-class identity (never human or chatgpt-reviewer)",
        ));
      }
      expectPresent("role", (v) => typeof v === "string", "start_task role must be a RoleSlug string");
      expectNull("artifact");
      expectNull("head");
      expectNull("result");
      if (record.supersedes !== null && !isPositiveInteger(record.supersedes)) {
        findings.push(finding("record.field", "start_task supersedes must be a positive GitHub comment id or null"));
      }
      break;

    case "handoff":
      expectPresent("worker", (v) => ASSIGNMENT_WORKER_IDS.includes(v),
        "handoff worker must be a Worker-class identity (never human or chatgpt-reviewer)");
      if (record.worker !== null && WORKER_IDS.includes(record.worker) && !ASSIGNMENT_WORKER_IDS.includes(record.worker)) {
        findings.push(finding(
          "record.worker",
          "handoff worker must be a Worker-class identity (never human or chatgpt-reviewer)",
        ));
      }
      expectPresent("role", (v) => typeof v === "string", "handoff role must be a RoleSlug string");
      expectNull("artifact");
      expectNull("head");
      expectNull("result");
      expectPresent("supersedes", isPositiveInteger, "handoff supersedes must be a positive GitHub comment id");
      break;

    case "review_result":
      expectPresent("worker", (v) => v === "chatgpt-reviewer", "review_result worker must be chatgpt-reviewer");
      expectPresent("role", (v) => v === ROLE_QA_REVIEWER, "review_result role must be exactly qa-reviewer");
      expectPresent("artifact", () => true, "review_result requires artifact");
      expectPresent("head", (v) => typeof v === "string" && FULL_COMMIT_SHA.test(v),
        "review_result head must be a full 40-character lowercase commit SHA");
      expectPresent("result", (v) => REVIEW_RESULTS.includes(v),
        `review_result result must be one of ${REVIEW_RESULTS.join(" | ")}`);
      if (record.supersedes !== null && !isPositiveInteger(record.supersedes)) {
        findings.push(finding("record.field", "review_result supersedes must be a positive GitHub comment id or null"));
      }
      break;

    case "human_approval":
      expectPresent("worker", (v) => v === "human", "human_approval worker must be human");
      expectPresent("role", (v) => v === ROLE_HUMAN_OWNER, "human_approval role must be exactly human-owner");
      expectPresent("artifact", () => true, "human_approval requires artifact");
      expectPresent("head", (v) => typeof v === "string" && FULL_COMMIT_SHA.test(v),
        "human_approval head must be a full 40-character lowercase commit SHA");
      expectNull("result");
      if (record.supersedes !== null && !isPositiveInteger(record.supersedes)) {
        findings.push(finding("record.field", "human_approval supersedes must be a positive GitHub comment id or null"));
      }
      break;

    case "kanban_update":
      expectPresent("worker", (v) => ASSIGNMENT_WORKER_IDS.includes(v) || v === "human",
        "kanban_update worker must be a Worker-class identity or human");
      expectPresent("role", (v) => typeof v === "string", "kanban_update role must be a RoleSlug string");
      expectNull("artifact");
      expectNull("head");
      expectNull("result");
      if (record.supersedes !== null && !isPositiveInteger(record.supersedes)) {
        findings.push(finding("record.field", "kanban_update supersedes must be a positive GitHub comment id or null"));
      }
      break;

    case "completion":
      expectPresent("worker", (v) => ASSIGNMENT_WORKER_IDS.includes(v) || v === "human",
        "completion worker must be a Worker-class identity or human");
      expectPresent("role", (v) => typeof v === "string", "completion role must be a RoleSlug string");
      expectPresent("artifact", () => true, "completion requires artifact");
      expectNull("result");
      if (record.supersedes !== null && !isPositiveInteger(record.supersedes)) {
        findings.push(finding("record.field", "completion supersedes must be a positive GitHub comment id or null"));
      }
      break;

    default:
      findings.push(finding("record.type", `Unknown record type: ${type}`));
  }
}

function validateRolePins(record, roleSlugs, findings) {
  const { type, worker, role } = record;
  if (role === null || role === undefined) return;
  if (typeof role !== "string") {
    findings.push(finding("record.role", "role must be a string RoleSlug or null"));
    return;
  }
  if (!roleSlugs.includes(role)) {
    findings.push(finding("record.role", `role is not in the canonical RoleSlug manifest: ${role}`));
    return;
  }

  if (type === "review_result") {
    if (role !== ROLE_QA_REVIEWER) {
      findings.push(finding("record.role", "review_result role must be exactly qa-reviewer"));
    }
    return;
  }

  if (role === ROLE_QA_REVIEWER) {
    findings.push(finding(
      "record.role",
      "qa-reviewer is only legal as role on review_result",
    ));
  }

  if (type === "human_approval") {
    if (role !== ROLE_HUMAN_OWNER) {
      findings.push(finding("record.role", "human_approval role must be exactly human-owner"));
    }
    return;
  }

  if (type === "start_task" || type === "handoff") {
    if (role === ROLE_HUMAN_OWNER) {
      findings.push(finding(
        "record.role",
        `${type} role must not be human-owner`,
      ));
    }
    return;
  }

  if (type === "kanban_update" || type === "completion") {
    if (worker === "human") {
      if (role !== ROLE_HUMAN_OWNER) {
        findings.push(finding(
          "record.role",
          `${type} with worker human requires role human-owner`,
        ));
      }
    } else if (worker !== null && ASSIGNMENT_WORKER_IDS.includes(worker)) {
      if (role === ROLE_HUMAN_OWNER) {
        findings.push(finding(
          "record.role",
          `${type} with a Worker-class worker must not use role human-owner`,
        ));
      }
    }
  }
}

function validateArtifactAndHead(record, findings) {
  const { type, artifact, head } = record;

  if (artifact === null || artifact === undefined) {
    if (type === "completion") {
      // already flagged by nullability
    }
    return;
  }

  const parsed = parseArtifactRef(artifact);
  if (!parsed.ok) {
    findings.push(finding("record.artifact", parsed.message));
    return;
  }

  if (type === "review_result" || type === "human_approval") {
    if (parsed.kind === "issue") {
      findings.push(finding(
        "record.artifact",
        `${type} artifact must be pr: or path: (never issue:)`,
      ));
    }
  }

  if (type === "completion") {
    if (parsed.kind === "pr") {
      if (head === null || head === undefined) {
        findings.push(finding("record.nullability", "completion with pr: artifact requires head"));
      } else if (typeof head !== "string" || !FULL_COMMIT_SHA.test(head)) {
        findings.push(finding(
          "record.head",
          "completion head must be a full 40-character lowercase commit SHA when artifact is pr:",
        ));
      }
    } else if (head !== null) {
      findings.push(finding(
        "record.nullability",
        `completion with ${parsed.kind}: artifact requires head to be null`,
      ));
    }
  }

  if ((type === "review_result" || type === "human_approval") && head !== null && typeof head === "string") {
    if (!FULL_COMMIT_SHA.test(head)) {
      findings.push(finding(
        "record.head",
        `${type} head must be a full 40-character lowercase commit SHA`,
      ));
    }
  }
}

function validateWorkerEnums(record, findings) {
  const { worker } = record;
  if (worker === null) return;
  if (typeof worker !== "string" || !WORKER_IDS.includes(worker)) {
    findings.push(finding(
      "record.worker",
      `worker must be one of ${WORKER_IDS.join(" | ")} or null`,
    ));
  }
}

function validateResultEnum(record, findings) {
  const { result } = record;
  if (result === null) return;
  if (typeof result !== "string" || !REVIEW_RESULTS.includes(result)) {
    findings.push(finding(
      "record.result",
      `result must be one of ${REVIEW_RESULTS.join(" | ")} or null (approved_with_conditions is rejected)`,
    ));
  }
}

function validatePayloadObject(payload, roleSlugs) {
  const findings = [];

  if (payload === null || typeof payload !== "object" || Array.isArray(payload)) {
    return [finding("record.shape", "workflow record payload must be a JSON object")];
  }

  const keys = Object.keys(payload);
  for (const key of keys) {
    if (!RECORD_FIELDS.includes(key)) {
      findings.push(finding("record.field", `Unknown top-level field: ${key}`));
    }
  }
  for (const field of RECORD_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(payload, field)) {
      findings.push(finding("record.field", `Missing required field: ${field}`));
    }
  }

  if (!RECORD_TYPES.includes(payload.type)) {
    findings.push(finding(
      "record.type",
      `type must be one of ${RECORD_TYPES.join(" | ")}`,
    ));
  }

  if (!isPositiveInteger(payload.card)) {
    findings.push(finding("record.card", "card must be a positive integer"));
  }

  validateWorkerEnums(payload, findings);
  validateResultEnum(payload, findings);

  if (RECORD_TYPES.includes(payload.type)) {
    validateNullability(payload, findings);
    validateRolePins(payload, roleSlugs, findings);
    validateArtifactAndHead(payload, findings);
  }

  findings.sort((left, right) =>
    left.ruleId.localeCompare(right.ruleId) ||
    left.message.localeCompare(right.message)
  );
  return findings;
}

/**
 * Validate a raw GitHub comment body containing ai-workflow-record:v1.
 * Enforces exactly one marker and payload-local structural/schema rules only.
 *
 * @param {string} commentBody
 * @param {{ rootDir?: string }} [options]
 */
export function validateWorkflowRecord(commentBody, options = {}) {
  const rootDir = options.rootDir ?? DEFAULT_ROOT;
  const roleSlugs = getRoleSlugs(rootDir);
  const findings = [];
  const markers = extractMarkers(commentBody ?? "");

  if (markers.length === 0) {
    findings.push(finding("record.marker", "no ai-workflow-record:v1 marker found"));
    return { findings, markers: [], record: null };
  }

  if (markers.length > 1) {
    findings.push(finding(
      "record.marker",
      `expected exactly one ai-workflow-record:v1 marker; found ${markers.length}`,
    ));
    return { findings, markers, record: null };
  }

  const payloadText = markers[0].payloadText;
  if (!payloadText) {
    findings.push(finding("record.marker", "ai-workflow-record:v1 marker is empty"));
    return { findings, markers, record: null };
  }

  const duplicateKey = findDuplicateObjectKey(payloadText);
  if (duplicateKey !== null) {
    findings.push(finding(
      "record.json",
      `duplicate JSON object member name: ${duplicateKey}`,
    ));
    return { findings, markers, record: null };
  }

  let payload;
  try {
    payload = JSON.parse(payloadText);
  } catch (error) {
    findings.push(finding(
      "record.json",
      `malformed JSON: ${error instanceof Error ? error.message : String(error)}`,
    ));
    return { findings, markers, record: null };
  }

  const structural = validatePayloadObject(payload, roleSlugs);
  findings.push(...structural);

  findings.sort((left, right) =>
    left.ruleId.localeCompare(right.ruleId) ||
    left.message.localeCompare(right.message)
  );

  return {
    findings,
    markers,
    record: findings.length === 0 ? payload : null,
  };
}

function wrapComment(payloadObject) {
  return [
    "Prose above the marker.",
    `<!-- ${RECORD_MARKER}`,
    JSON.stringify(payloadObject),
    "-->",
    "Prose below the marker.",
  ].join("\n");
}

function runCli() {
  const input = process.argv[2];
  if (!input) {
    console.error("Usage: node tools/ai-workflow/validate-workflow-record.mjs <comment-body-or-@file>");
    return 1;
  }
  const commentBody = input.startsWith("@")
    ? readFileSync(input.slice(1), "utf8")
    : input;
  const result = validateWorkflowRecord(commentBody);
  if (result.findings.length === 0) {
    console.log("ai-workflow-record:v1 valid");
    return 0;
  }
  for (const item of result.findings) {
    console.error(`[${item.ruleId}] ${item.message}`);
  }
  console.error(`ai-workflow-record:v1 invalid: ${result.findings.length} finding(s)`);
  return 1;
}

export { wrapComment };

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : "";
if (import.meta.url === invokedPath) {
  process.exitCode = runCli();
}
