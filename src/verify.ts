import { execFileSync } from "node:child_process";
import type { Policy } from "./types.js";

/**
 * Names that identify an AI tool when they appear as a trailer value. Used ONLY to read
 * trailers a contributor or tool already wrote. This file never guesses whether code was
 * AI-generated -- that is an explicit non-goal of the spec (see spec/SPEC.md).
 */
const AI_TOOL = /(claude|anthropic|copilot|codex|openai|chatgpt|gpt-|cursor|gemini|devin|aider|windsurf|llm|\[bot\])/i;

/** Trailers that, when present, mean the contributor has declared AI assistance. */
const DECLARING_TRAILERS = ["assisted-by", "generated-by", "co-authored-by"];

export interface Commit {
  sha: string;
  subject: string;
  /** Lower-cased trailer name -> values. */
  trailers: Map<string, string[]>;
}

export interface Violation {
  sha: string;
  subject: string;
  rule: string;
  message: string;
}

const SEP = "%x00";

export function readCommits(range: string, cwd = "."): Commit[] {
  const out = execFileSync("git", ["-C", cwd, "log", "--format=%H%x1f%s%x1f%B" + SEP, range], {
    encoding: "utf8", maxBuffer: 32 * 1024 * 1024,
  });
  const commits: Commit[] = [];
  for (const chunk of out.split("\0")) {
    const [sha, subject, body] = chunk.replace(/^\n+/, "").split("\x1f");
    if (!sha || !subject) continue;
    commits.push({ sha, subject, trailers: parseTrailers(body ?? "") });
  }
  return commits;
}

export function parseTrailers(message: string): Map<string, string[]> {
  const trailers = new Map<string, string[]>();
  for (const line of message.split("\n")) {
    const m = /^([A-Za-z][A-Za-z-]*)::?\s*(.+)$/.exec(line.trim());
    if (!m) continue;
    const key = m[1]!.toLowerCase();
    const list = trailers.get(key) ?? [];
    list.push(m[2]!.trim());
    trailers.set(key, list);
  }
  return trailers;
}

/** Did this commit declare AI involvement itself? */
export function declaresAi(commit: Commit): boolean {
  for (const name of DECLARING_TRAILERS) {
    const values = commit.trailers.get(name);
    if (!values) continue;
    if (name === "co-authored-by" ? values.some((v) => AI_TOOL.test(v)) : true) return true;
  }
  return false;
}

/**
 * Check commits against a policy. Only commits that declare AI involvement are judged,
 * except for forbidden-trailer rules, which apply to any trailer naming an AI tool.
 */
export function verifyCommits(policy: Policy, commits: Commit[]): Violation[] {
  const violations: Violation[] = [];
  const add = (c: Commit, rule: string, message: string) =>
    violations.push({ sha: c.sha.slice(0, 8), subject: c.subject, rule, message });

  for (const commit of commits) {
    for (const forbidden of policy.forbidden_trailers ?? []) {
      const values = commit.trailers.get(forbidden.toLowerCase());
      if (values?.some((v) => AI_TOOL.test(v))) {
        add(commit, "forbidden-trailer",
          `names an AI tool in '${forbidden}:', which this project does not accept`);
      }
    }

    if (!declaresAi(commit)) continue;

    if (policy.stance === "forbidden") {
      add(commit, "stance", "declares AI assistance, which this project does not accept");
    } else if (policy.stance === "restricted") {
      add(commit, "stance", "declares AI assistance; this project accepts it only in narrow cases -- a maintainer must confirm");
    }

    if (policy.trailer && !commit.trailers.has(policy.trailer.toLowerCase())) {
      add(commit, "missing-trailer",
        `declares AI assistance but is missing the required '${policy.trailer}:' trailer`);
    }
  }
  return violations;
}
