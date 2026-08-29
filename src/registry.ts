import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parsePolicyDocument } from "./parse.js";
import type { Policy } from "./types.js";

export interface RegistryEntry {
  /** Registry key: the file basename, e.g. "fedora". */
  key: string;
  policy: Policy;
}

function registryDir(): string {
  // dist/registry.js -> package root -> registry/policies
  const here = dirname(fileURLToPath(import.meta.url));
  for (const candidate of [join(here, "..", "registry", "policies"), join(here, "..", "..", "registry", "policies")]) {
    if (existsSync(candidate)) return candidate;
  }
  throw new Error("bundled registry not found");
}

let cache: RegistryEntry[] | null = null;

export function loadRegistry(): RegistryEntry[] {
  if (cache) return cache;
  const dir = registryDir();
  const entries: RegistryEntry[] = [];
  for (const file of readdirSync(dir)) {
    if (!file.endsWith(".yml") && !file.endsWith(".yaml")) continue;
    const key = file.replace(/\.ya?ml$/, "");
    try {
      entries.push({ key, policy: parsePolicyDocument(readFileSync(join(dir, file), "utf8")) });
    } catch (err) {
      throw new Error(`registry entry ${file} is invalid: ${(err as Error).message}`);
    }
  }
  cache = entries.sort((a, b) => a.key.localeCompare(b.key));
  return cache;
}

/**
 * Strip a leading forge host so that "github.com/foo/bar" and "foo/bar" compare equal.
 * Cross-forge collisions are possible and accepted in v1; entries carry `policy_url`
 * so a wrong match stays visible to the user.
 */
function stripHost(s: string): string {
  return s.replace(/^[a-z0-9.-]+\.[a-z]{2,}\//i, "");
}

/** Match a repo slug ("owner/name") against a glob pattern from `repos`. */
export function matchesSlug(pattern: string, slug: string): boolean {
  const escaped = stripHost(pattern)
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, "[^/]*");
  return new RegExp(`^${escaped}$`, "i").test(stripHost(slug));
}

/** Find the registry entry covering a repository slug. Most specific pattern wins. */
export function lookup(slug: string): RegistryEntry | null {
  const hits: { entry: RegistryEntry; specificity: number }[] = [];
  for (const entry of loadRegistry()) {
    for (const pattern of entry.policy.repos ?? []) {
      if (matchesSlug(pattern, slug)) {
        hits.push({ entry, specificity: pattern.includes("*") ? 0 : 1 });
      }
    }
  }
  if (hits.length === 0) return null;
  hits.sort((a, b) => b.specificity - a.specificity);
  return hits[0]!.entry;
}
