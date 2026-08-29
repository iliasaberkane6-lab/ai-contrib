import { test } from "node:test";
import assert from "node:assert/strict";
import {
  validatePolicy, extractEmbeddedPolicy, parsePolicyDocument, PolicyError,
  matchesSlug, loadRegistry, evaluate,
} from "../dist/index.js";

const ORIGIN = { kind: "registry", location: "test" };
const base = { version: 1, stance: "allowed", policy_url: "https://example.com/p" };

test("validate: accepts a minimal document", () => {
  assert.equal(validatePolicy({ version: 1, stance: "unspecified" }).stance, "unspecified");
});

test("validate: rejects unknown fields", () => {
  assert.throws(() => validatePolicy({ ...base, sance: "allowed" }), PolicyError);
});

test("validate: rejects a non-1 version", () => {
  assert.throws(() => validatePolicy({ version: 2, stance: "allowed" }), PolicyError);
});

test("validate: rejects an invalid stance", () => {
  assert.throws(() => validatePolicy({ version: 1, stance: "maybe" }), PolicyError);
});

test("validate: requires policy_url unless stance is unspecified", () => {
  assert.throws(() => validatePolicy({ version: 1, stance: "forbidden" }), PolicyError);
});

test("validate: rejects the literal string 'undefined' in an enum", () => {
  // Regression: the registry importer once emitted `disclosure: undefined`.
  assert.throws(() => validatePolicy({ ...base, disclosure: "undefined" }), PolicyError);
});

test("embedded: extracts a fenced ai-contrib block from Markdown", () => {
  const md = [
    "# AGENTS.md", "", "Some prose.", "",
    "```ai-contrib", "version: 1", "stance: forbidden",
    "policy_url: https://example.com/p", "```", "", "More prose.",
  ].join("\n");
  const p = extractEmbeddedPolicy(md);
  assert.equal(p?.stance, "forbidden");
});

test("embedded: returns null when no block is present", () => {
  assert.equal(extractEmbeddedPolicy("# AGENTS.md\n\nNothing here.\n"), null);
});

test("slug: exact, glob and forge-host forms all match", () => {
  assert.ok(matchesSlug("torvalds/linux", "torvalds/linux"));
  assert.ok(matchesSlug("electron/*", "electron/forge"));
  assert.ok(matchesSlug("github.com/torvalds/linux", "torvalds/linux"));
  assert.ok(matchesSlug("gitlab.gnome.org/GNOME/libadwaita", "GNOME/libadwaita"));
  assert.ok(!matchesSlug("electron/*", "electron/forge/extra"));
  assert.ok(!matchesSlug("torvalds/linux", "torvalds/linux-next"));
});

test("verdict: forbidden exits 4", () => {
  const v = evaluate(validatePolicy({ ...base, stance: "forbidden" }), ORIGIN);
  assert.equal(v.verdict, "forbidden");
  assert.equal(v.exitCode, 4);
});

test("verdict: a missing policy is 'unknown' (exit 5), never 'ok'", () => {
  const v = evaluate({ version: 1, stance: "unspecified" }, { kind: "none" });
  assert.equal(v.verdict, "unknown");
  assert.equal(v.exitCode, 5);
});

test("verdict: allowed with no obligations exits 0", () => {
  const v = evaluate(validatePolicy(base), ORIGIN);
  assert.equal(v.verdict, "ok");
  assert.equal(v.exitCode, 0);
});

test("verdict: a required trailer attaches a condition", () => {
  const v = evaluate(validatePolicy({ ...base, trailer: "Assisted-by" }), ORIGIN);
  assert.equal(v.verdict, "conditions");
  assert.equal(v.exitCode, 2);
  assert.ok(v.requirements.some((r) => r.includes("Assisted-by")));
});

test("verdict: a forbidden trailer attaches a condition, not permission", () => {
  const v = evaluate(validatePolicy({ ...base, forbidden_trailers: ["Co-authored-by"] }), ORIGIN);
  assert.equal(v.verdict, "conditions");
  assert.ok(v.requirements.some((r) => r.startsWith("Do NOT add")));
});

test("verdict: recommendations are advisories and never change the verdict", () => {
  const v = evaluate(validatePolicy({ ...base, disclosure: "recommended" }), ORIGIN);
  assert.equal(v.verdict, "ok");
  assert.equal(v.advisories.length, 1);
});

test("verdict: an autonomous agent is restricted where agents are banned", () => {
  const policy = validatePolicy({ ...base, autonomous_agents: "forbidden" });
  assert.equal(evaluate(policy, ORIGIN, { autonomous: true }).exitCode, 3);
  // The same project still allows a human-driven contribution.
  assert.equal(evaluate(policy, ORIGIN, { autonomous: false }).exitCode, 0);
});

test("verdict: a scope override beats the top-level stance", () => {
  const policy = validatePolicy({ ...base, stance: "forbidden", scope: { docs: "allowed" } });
  assert.equal(evaluate(policy, ORIGIN, { scope: "docs" }).verdict, "ok");
  assert.equal(evaluate(policy, ORIGIN, { scope: "code" }).verdict, "forbidden");
});

test("registry: every bundled entry is valid and carries provenance", () => {
  const entries = loadRegistry();
  assert.ok(entries.length > 100, `expected a seeded registry, got ${entries.length}`);
  for (const { key, policy } of entries) {
    assert.ok(policy.confidence, `${key}: missing confidence`);
    assert.ok(policy.sources?.length, `${key}: missing sources`);
    if (policy.stance !== "unspecified") {
      assert.ok(policy.policy_url, `${key}: missing policy_url`);
    }
  }
});

test("registry: verified entries outrank the importer", () => {
  const kernel = loadRegistry().find((e) => e.key === "linux-kernel");
  assert.equal(kernel?.policy.confidence, "verified");
  assert.equal(kernel?.policy.trailer, "Assisted-by");
  assert.deepEqual(kernel?.policy.forbidden_trailers, ["Signed-off-by"]);
});

test("parse: rejects malformed YAML with a PolicyError", () => {
  assert.throws(() => parsePolicyDocument("version: 1\n  bad indent: ["), PolicyError);
});

test("verdict: an unnamed project is described by its target, not 'This project'", () => {
  const v = evaluate({ version: 1, stance: "unspecified" }, { kind: "none" }, { target: "acme/widget" });
  assert.ok(v.summary.startsWith("No AI contribution policy found for acme/widget."), v.summary);
  assert.ok(!v.summary.includes("This project"));
});
