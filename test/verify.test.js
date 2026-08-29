import { test } from "node:test";
import assert from "node:assert/strict";
import { parseTrailers, declaresAi, verifyCommits, validatePolicy } from "../dist/index.js";

const commit = (subject, body = "") => ({
  sha: "0".repeat(40), subject, trailers: parseTrailers(body),
});
const policy = (extra) => validatePolicy({
  version: 1, stance: "allowed", policy_url: "https://example.com/p", ...extra,
});

test("trailers: parses name/value pairs, ignores prose", () => {
  const t = parseTrailers("Some body text.\n\nAssisted-by: LLM claude\nSigned-off-by: A Human <a@b.c>");
  assert.deepEqual(t.get("assisted-by"), ["LLM claude"]);
  assert.deepEqual(t.get("signed-off-by"), ["A Human <a@b.c>"]);
  assert.equal(t.has("some"), false);
});

test("declaresAi: Co-authored-by only counts when it names an AI tool", () => {
  assert.equal(declaresAi(commit("x", "Co-authored-by: Claude <noreply@anthropic.com>")), true);
  assert.equal(declaresAi(commit("x", "Co-authored-by: Jane Dev <jane@example.com>")), false);
  assert.equal(declaresAi(commit("x", "Assisted-by: LLM gpt")), true);
  assert.equal(declaresAi(commit("x", "no trailers here")), false);
});

test("verify: a human-only commit is never flagged", () => {
  const commits = [commit("fix: typo", "Signed-off-by: Jane Dev <jane@example.com>")];
  assert.deepEqual(verifyCommits(policy({ trailer: "Assisted-by", stance: "forbidden" }), commits), []);
});

test("verify: flags an AI tool named in a forbidden trailer", () => {
  const commits = [commit("feat: x", "Co-authored-by: Claude <noreply@anthropic.com>")];
  const v = verifyCommits(policy({ forbidden_trailers: ["Co-authored-by"] }), commits);
  assert.equal(v.length, 1);
  assert.equal(v[0].rule, "forbidden-trailer");
});

test("verify: a human co-author in a forbidden trailer is not a violation", () => {
  const commits = [commit("feat: x", "Co-authored-by: Jane Dev <jane@example.com>")];
  assert.deepEqual(verifyCommits(policy({ forbidden_trailers: ["Co-authored-by"] }), commits), []);
});

test("verify: flags a declared AI commit missing the required trailer", () => {
  const commits = [commit("feat: x", "Co-authored-by: Copilot <copilot@github.com>")];
  const v = verifyCommits(policy({ trailer: "Assisted-by" }), commits);
  assert.ok(v.some((x) => x.rule === "missing-trailer"));
});

test("verify: a correctly declared commit passes", () => {
  const commits = [commit("feat: x", "Assisted-by: LLM claude-opus-5")];
  assert.deepEqual(verifyCommits(policy({ trailer: "Assisted-by" }), commits), []);
});

test("verify: declared AI assistance in a forbidden project is a violation", () => {
  const commits = [commit("feat: x", "Assisted-by: LLM claude")];
  const v = verifyCommits(policy({ stance: "forbidden" }), commits);
  assert.equal(v.length, 1);
  assert.equal(v[0].rule, "stance");
});

test("cli: large --json output survives a pipe (no process.exit truncation)", async () => {
  const { execFile } = await import("node:child_process");
  const { promisify } = await import("node:util");
  const { stdout } = await promisify(execFile)(
    process.execPath, ["dist/cli.js", "list", "--json"],
    { maxBuffer: 32 * 1024 * 1024 },
  );
  assert.ok(stdout.length > 65536, `expected output past the 64 KB pipe buffer, got ${stdout.length}`);
  const parsed = JSON.parse(stdout);           // throws if truncated
  assert.ok(parsed.length > 100);
});
