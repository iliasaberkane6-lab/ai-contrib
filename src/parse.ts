import { parse as parseYaml } from "yaml";
import type { Policy, Stance, Requirement, AgentStance, Confidence } from "./types.js";

export class PolicyError extends Error {}

const STANCES = ["forbidden", "restricted", "allowed", "unspecified"];
const REQUIREMENTS = ["required", "recommended", "not_required", "unknown"];
const AGENT_STANCES = ["forbidden", "review_required", "allowed", "unspecified"];
const CONFIDENCES = ["verified", "imported", "unverified"];

const KNOWN_KEYS = new Set([
  "version", "project", "policy_url", "homepage", "repos", "stance",
  "autonomous_agents", "disclosure", "human_in_the_loop", "copyright_statement",
  "trailer", "forbidden_trailers", "scope", "notes", "sources", "confidence", "updated",
]);

function enumField<T extends string>(
  v: unknown, allowed: readonly string[], field: string,
): T | undefined {
  if (v === undefined || v === null) return undefined;
  if (typeof v !== "string" || !allowed.includes(v)) {
    throw new PolicyError(`${field}: expected one of ${allowed.join(" | ")}, got ${JSON.stringify(v)}`);
  }
  return v as T;
}

function stringArray(v: unknown, field: string): string[] | undefined {
  if (v === undefined || v === null) return undefined;
  if (!Array.isArray(v) || v.some((x) => typeof x !== "string")) {
    throw new PolicyError(`${field}: expected an array of strings`);
  }
  return v as string[];
}

/** Validate an already-parsed object against the v1 schema. Throws PolicyError. */
export function validatePolicy(raw: unknown): Policy {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw new PolicyError("policy must be a YAML mapping");
  }
  const o = raw as Record<string, unknown>;

  for (const key of Object.keys(o)) {
    if (!KNOWN_KEYS.has(key)) throw new PolicyError(`unknown field: ${key}`);
  }
  if (o["version"] !== 1) {
    throw new PolicyError(`version: only version 1 is supported, got ${JSON.stringify(o["version"])}`);
  }
  const stance = enumField<Stance>(o["stance"], STANCES, "stance");
  if (!stance) throw new PolicyError("stance: required");

  if (stance !== "unspecified" && typeof o["policy_url"] !== "string") {
    throw new PolicyError("policy_url: required unless stance is 'unspecified'");
  }
  if (o["updated"] !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(String(o["updated"]))) {
    throw new PolicyError("updated: expected an ISO date (YYYY-MM-DD)");
  }

  let scope: Record<string, Stance> | undefined;
  if (o["scope"] !== undefined && o["scope"] !== null) {
    if (typeof o["scope"] !== "object" || Array.isArray(o["scope"])) {
      throw new PolicyError("scope: expected a mapping of area -> stance");
    }
    scope = {};
    for (const [area, val] of Object.entries(o["scope"] as Record<string, unknown>)) {
      scope[area] = enumField<Stance>(val, STANCES, `scope.${area}`)!;
    }
  }

  return {
    version: 1,
    project: o["project"] as string | undefined,
    policy_url: o["policy_url"] as string | undefined,
    homepage: o["homepage"] as string | undefined,
    repos: stringArray(o["repos"], "repos"),
    stance,
    autonomous_agents: enumField<AgentStance>(o["autonomous_agents"], AGENT_STANCES, "autonomous_agents"),
    disclosure: enumField<Requirement>(o["disclosure"], REQUIREMENTS, "disclosure"),
    human_in_the_loop: enumField<Requirement>(o["human_in_the_loop"], REQUIREMENTS, "human_in_the_loop"),
    copyright_statement: (o["copyright_statement"] ?? undefined) as boolean | null | undefined,
    trailer: (o["trailer"] ?? undefined) as string | null | undefined,
    forbidden_trailers: stringArray(o["forbidden_trailers"], "forbidden_trailers"),
    scope,
    notes: o["notes"] as string | undefined,
    sources: stringArray(o["sources"], "sources"),
    confidence: enumField<Confidence>(o["confidence"], CONFIDENCES, "confidence"),
    updated: o["updated"] as string | undefined,
  };
}

/** Parse a standalone `ai-contrib.yml` document. */
export function parsePolicyDocument(text: string): Policy {
  let raw: unknown;
  try {
    raw = parseYaml(text);
  } catch (err) {
    throw new PolicyError(`invalid YAML: ${(err as Error).message}`);
  }
  return validatePolicy(raw);
}

/**
 * Extract a policy from a fenced ```ai-contrib block inside a Markdown file
 * (AGENTS.md, CONTRIBUTING.md). Returns null when no such block exists.
 */
export function extractEmbeddedPolicy(markdown: string): Policy | null {
  const fence = /^[ \t]*(`{3,}|~{3,})[ \t]*ai-contrib[ \t]*$/gim;
  const match = fence.exec(markdown);
  if (!match) return null;
  const delim = match[1]!;
  const rest = markdown.slice(match.index + match[0].length);
  const closing = new RegExp(`^[ \\t]*${delim[0]}{${delim.length},}[ \\t]*$`, "m");
  const end = closing.exec(rest);
  const body = end ? rest.slice(0, end.index) : rest;
  return parsePolicyDocument(body);
}
