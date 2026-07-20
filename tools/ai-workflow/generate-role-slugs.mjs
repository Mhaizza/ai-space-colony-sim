import { readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const RESERVED_ROLE_SLUG = "human-owner";
export const ROLE_SLUGS_RELATIVE_PATH = "ai-studio/roles/role-slugs.json";

/**
 * Derive the closed RoleSlug set from governed role files plus the reserved
 * human-owner entry. Sorted for deterministic output.
 */
export function collectRoleSlugs(rolesRoot) {
  const slugs = new Set([RESERVED_ROLE_SLUG]);

  function walk(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        walk(path.join(dir, entry.name));
        continue;
      }
      if (!entry.isFile() || !entry.name.endsWith(".md")) continue;
      if (entry.name === "README.md") continue;
      slugs.add(path.basename(entry.name, ".md"));
    }
  }

  walk(rolesRoot);
  return [...slugs].sort((left, right) => left.localeCompare(right));
}

export function formatRoleSlugsManifest(slugs) {
  return `${JSON.stringify(slugs, null, 2)}\n`;
}

export function generateRoleSlugsManifest(rootDir) {
  const root = path.resolve(rootDir);
  const rolesRoot = path.join(root, "ai-studio", "roles");
  const slugs = collectRoleSlugs(rolesRoot);
  const absolutePath = path.join(root, ROLE_SLUGS_RELATIVE_PATH);
  const contents = formatRoleSlugsManifest(slugs);
  writeFileSync(absolutePath, contents, "utf8");
  return { absolutePath, relativePath: ROLE_SLUGS_RELATIVE_PATH, slugs, contents };
}

function runCli() {
  const root = process.argv[2] ?? path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
  const result = generateRoleSlugsManifest(root);
  console.log(`Wrote ${result.relativePath} (${result.slugs.length} slugs)`);
  return 0;
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : "";
if (import.meta.url === invokedPath) {
  process.exitCode = runCli();
}
