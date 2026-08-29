import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { parsePolicyDocument, extractEmbeddedPolicy, PolicyError } from "./parse.js";
import { lookup } from "./registry.js";
import type { Policy, PolicyOrigin } from "./types.js";

/** Files that may hold a standalone policy document, in discovery order. */
const POLICY_FILES = [
  ".github/ai-contrib.yml",
  ".github/ai-contrib.yaml",
  "ai-contrib.yml",
  "ai-contrib.yaml",
];

/** Files that may embed a fenced ```ai-contrib block, in discovery order. */
const EMBED_FILES = ["AGENTS.md", "CONTRIBUTING.md", ".github/CONTRIBUTING.md"];

export interface Resolution {
  policy: Policy;
  origin: PolicyOrigin;
  /** The repo slug this was resolved for, when one could be determined. */
  slug?: string;
}

const UNSPECIFIED: Policy = { version: 1, stance: "unspecified" };

export interface ResolveOptions {
  /** Do not perform any network requests. */
  offline?: boolean;
  timeoutMs?: number;
}

/** "owner/repo", a GitHub URL, or a local path — normalised to a slug where possible. */
export function parseTarget(target: string): { slug?: string; path?: string } {
  if (/^https?:\/\//i.test(target)) {
    const m = /^https?:\/\/(?:www\.)?github\.com\/([^/]+)\/([^/#?]+)/i.exec(target);
    if (m) return { slug: `${m[1]}/${m[2]!.replace(/\.git$/, "")}` };
    return {};
  }
  if (existsSync(target)) return { path: target, slug: slugFromGitRemote(target) };
  if (/^[\w.-]+\/[\w.-]+$/.test(target)) return { slug: target };
  return {};
}

export function slugFromGitRemote(dir: string): string | undefined {
  try {
    const url = execFileSync("git", ["-C", dir, "remote", "get-url", "origin"], {
      encoding: "utf8", stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    const m = /[:/]([^/:]+)\/([^/]+?)(?:\.git)?$/.exec(url);
    return m ? `${m[1]}/${m[2]}` : undefined;
  } catch {
    return undefined;
  }
}

function fromLocal(dir: string): Resolution | null {
  for (const rel of POLICY_FILES) {
    const p = join(dir, rel);
    if (existsSync(p)) {
      return { policy: parsePolicyDocument(readFileSync(p, "utf8")), origin: { kind: "repo-file", location: rel } };
    }
  }
  for (const rel of EMBED_FILES) {
    const p = join(dir, rel);
    if (!existsSync(p)) continue;
    const policy = extractEmbeddedPolicy(readFileSync(p, "utf8"));
    if (policy) return { policy, origin: { kind: "embedded-block", location: rel } };
  }
  return null;
}

async function fetchText(url: string, timeoutMs: number): Promise<string | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs), redirect: "follow" });
    return res.ok ? await res.text() : null;
  } catch {
    return null;
  }
}

async function fromRemote(slug: string, timeoutMs: number): Promise<Resolution | null> {
  const raw = (rel: string) => `https://raw.githubusercontent.com/${slug}/HEAD/${rel}`;

  const docs = await Promise.all(POLICY_FILES.map((rel) => fetchText(raw(rel), timeoutMs)));
  for (const [i, text] of docs.entries()) {
    if (text === null) continue;
    return { policy: parsePolicyDocument(text), origin: { kind: "repo-file", location: POLICY_FILES[i]! } };
  }

  const embeds = await Promise.all(EMBED_FILES.map((rel) => fetchText(raw(rel), timeoutMs)));
  for (const [i, text] of embeds.entries()) {
    if (text === null) continue;
    const policy = extractEmbeddedPolicy(text);
    if (policy) return { policy, origin: { kind: "embedded-block", location: EMBED_FILES[i]! } };
  }
  return null;
}

/**
 * Resolve the policy for a target, following the discovery order in spec/SPEC.md:
 * repo file > embedded block > registry > unspecified.
 * A policy published by the project always outranks the registry.
 */
export async function resolvePolicy(target: string, opts: ResolveOptions = {}): Promise<Resolution> {
  const timeoutMs = opts.timeoutMs ?? 5000;
  const { slug, path } = parseTarget(target);

  if (path) {
    const local = fromLocal(path);
    if (local) return { ...local, slug };
  } else if (slug && !opts.offline) {
    const remote = await fromRemote(slug, timeoutMs);
    if (remote) return { ...remote, slug };
  }

  if (slug) {
    const entry = lookup(slug);
    if (entry) return { policy: entry.policy, origin: { kind: "registry", location: entry.key }, slug };
  }
  return { policy: UNSPECIFIED, origin: { kind: "none" }, slug };
}

export { PolicyError };
