import type { Verdict } from "./types.js";

const ESC = String.fromCharCode(27);
const useColor = process.stdout.isTTY && !process.env["NO_COLOR"];
const c = (code: string, s: string) => (useColor ? `${ESC}[${code}m${s}${ESC}[0m` : s);
const bold = (s: string) => c("1", s);
const dim = (s: string) => c("2", s);

const BADGE: Record<Verdict["verdict"], [string, string]> = {
  ok:         ["42;30", " ALLOWED "],
  conditions: ["43;30", " CONDITIONS "],
  restricted: ["45;30", " RESTRICTED "],
  forbidden:  ["41;37", " FORBIDDEN "],
  unknown:    ["47;30", " NO POLICY "],
};

function wrap(text: string, width: number): string {
  const lines: string[] = [];
  let line = "";
  for (const w of text.split(/\s+/)) {
    if (line.length + w.length + 1 > width) { lines.push(line); line = w; }
    else line = line ? `${line} ${w}` : w;
  }
  if (line) lines.push(line);
  return lines.join("\n");
}

export function formatVerdict(v: Verdict, target: string): string {
  const [color, label] = BADGE[v.verdict];
  const out: string[] = [`${c(color, label)} ${bold(target)}`, v.summary];

  if (v.requirements.length) {
    out.push("", bold("You must:"));
    for (const r of v.requirements) out.push(`  - ${r}`);
  }
  if (v.advisories.length) {
    out.push("", dim("Recommended:"));
    for (const a of v.advisories) out.push(dim(`  - ${a}`));
  }
  if (v.policy.notes) out.push("", dim(wrap(v.policy.notes.trim(), 76)));

  const origin =
    v.origin.kind === "repo-file"        ? `declared by the project (${v.origin.location})`
    : v.origin.kind === "embedded-block" ? `declared by the project (block in ${v.origin.location})`
    : v.origin.kind === "registry"       ? `ai-contrib registry (${v.origin.location})`
    :                                      "no policy found";
  out.push("", dim(`source:     ${origin}`));
  if (v.policy.policy_url) out.push(dim(`policy:     ${v.policy.policy_url}`));
  if (v.policy.confidence) {
    const warn = v.policy.confidence === "imported"
      ? " (third-party list; the policy URL is authoritative)"
      : "";
    out.push(dim(`confidence: ${v.policy.confidence}${warn}`));
  }
  return out.join("\n");
}
