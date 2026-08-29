#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { resolvePolicy } from "./resolve.js";
import { evaluate } from "./verdict.js";
import { formatVerdict } from "./format.js";
import { loadRegistry } from "./registry.js";
import { parsePolicyDocument, PolicyError } from "./parse.js";
import { readCommits, verifyCommits } from "./verify.js";

const HELP = `ai-contrib - know a project's AI contribution policy before the agent opens the PR

USAGE
  ai-contrib check [target]        Resolve and evaluate a policy (target: path, owner/repo, URL)
  ai-contrib verify <range>        Check commits in a git range against the resolved policy
  ai-contrib validate <file>       Validate a policy document against the v1 schema
  ai-contrib list [--stance S]     List bundled registry entries
  ai-contrib help | version

CHECK OPTIONS
  --autonomous        The contribution is made by an agent with no human in the loop
  --scope <area>      Area being touched (e.g. docs), selects a 'scope' override
  --offline           Never hit the network; use the bundled registry only
  --json              Machine-readable output
  --allow-unknown     Exit 0 instead of 5 when no policy is found

VERIFY OPTIONS
  --repo <target>     Resolve the policy from somewhere other than the working directory
  --offline           Never hit the network
  --json              Machine-readable output

EXIT CODES
  0 allowed   2 conditions attached   3 restricted, ask a human
  4 forbidden 5 no policy found       6 verify found violations   1 tool error

  A missing policy is exit 5, not exit 0. Absence of a policy is not permission.`;

function flag(args: string[], name: string): boolean {
  const i = args.indexOf(name);
  if (i === -1) return false;
  args.splice(i, 1);
  return true;
}

function option(args: string[], name: string): string | undefined {
  const i = args.indexOf(name);
  if (i === -1) return undefined;
  const value = args[i + 1];
  args.splice(i, 2);
  return value;
}

async function main(argv: string[]): Promise<number> {
  const args = argv.slice(2);
  const command = args[0] && !args[0].startsWith("-") ? args.shift()! : "check";

  if (command === "help" || flag(args, "--help") || flag(args, "-h")) {
    console.log(HELP);
    return 0;
  }
  if (command === "version" || flag(args, "--version")) {
    const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
    console.log(pkg.version);
    return 0;
  }

  if (command === "validate") {
    const file = args[0];
    if (!file) { console.error("validate: a file argument is required"); return 1; }
    try {
      const policy = parsePolicyDocument(readFileSync(file, "utf8"));
      console.log(`ok: ${file} is a valid ai-contrib v1 policy (stance: ${policy.stance})`);
      return 0;
    } catch (err) {
      console.error(`invalid: ${file}: ${(err as Error).message}`);
      return 1;
    }
  }

  if (command === "verify") {
    const json = flag(args, "--json");
    const offline = flag(args, "--offline");
    const repo = option(args, "--repo") ?? ".";
    const range = args[0];
    if (!range) { console.error("verify: a git range is required, e.g. origin/main..HEAD"); return 1; }

    const { policy, origin } = await resolvePolicy(repo, { offline });
    if (policy.stance === "unspecified") {
      const msg = "no policy found for this repository; nothing to verify against";
      if (json) console.log(JSON.stringify({ range, violations: [], policy, note: msg }, null, 2));
      else console.error(msg);
      return 0;
    }
    const commits = readCommits(range, repo === "." ? "." : ".");
    const violations = verifyCommits(policy, commits);

    if (json) {
      console.log(JSON.stringify({ range, commits: commits.length, violations, policy, origin }, null, 2));
    } else if (violations.length === 0) {
      console.log(`ok: ${commits.length} commit(s) comply with ${policy.project ?? "the"} policy`);
    } else {
      console.log(`${violations.length} violation(s) of the ${policy.project ?? ""} AI contribution policy:\n`);
      for (const v of violations) {
        console.log(`  ${v.sha}  ${v.subject}`);
        console.log(`            ${v.rule}: ${v.message}\n`);
      }
      if (policy.policy_url) console.log(`policy: ${policy.policy_url}`);
    }
    return violations.length ? 6 : 0;
  }

  if (command === "list") {
    const stance = option(args, "--stance");
    const json = flag(args, "--json");
    const entries = loadRegistry().filter((e) => !stance || e.policy.stance === stance);
    if (json) {
      console.log(JSON.stringify(entries.map((e) => ({ key: e.key, ...e.policy })), null, 2));
      return 0;
    }
    for (const e of entries) {
      const conf = e.policy.confidence === "verified" ? "verified" : "imported";
      console.log(`${e.policy.stance.padEnd(11)} ${conf.padEnd(9)} ${e.key}`);
    }
    console.error(`\n${entries.length} entr${entries.length === 1 ? "y" : "ies"}`);
    return 0;
  }

  if (command !== "check") {
    console.error(`unknown command: ${command}\n\n${HELP}`);
    return 1;
  }

  const autonomous = flag(args, "--autonomous");
  const offline = flag(args, "--offline");
  const json = flag(args, "--json");
  const allowUnknown = flag(args, "--allow-unknown");
  const scope = option(args, "--scope");
  const target = args[0] ?? ".";

  const { policy, origin, slug } = await resolvePolicy(target, { offline });
  const verdict = evaluate(policy, origin, { autonomous, scope, target: slug ?? target });

  if (json) {
    console.log(JSON.stringify({ target, slug, ...verdict }, null, 2));
  } else {
    console.log(formatVerdict(verdict, slug ?? target));
  }
  if (verdict.verdict === "unknown" && allowUnknown) return 0;
  return verdict.exitCode;
}

// Set exitCode rather than calling process.exit(): exit() discards stdout writes that
// have not flushed yet, which truncates `--json` at the 64 KB pipe buffer. The registry
// listing is larger than that, and truncated JSON is worse than no JSON.
main(process.argv)
  .then((code) => { process.exitCode = code; })
  .catch((err) => {
    console.error(err instanceof PolicyError ? `policy error: ${err.message}` : `error: ${(err as Error).message}`);
    process.exitCode = 1;
  });
