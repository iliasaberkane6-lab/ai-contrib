import { EXIT_CODES } from "./types.js";
import type { Policy, PolicyOrigin, Stance, Verdict } from "./types.js";

export interface EvaluateOptions {
  /** The contribution is being made by an agent acting without a human in the loop. */
  autonomous?: boolean;
  /** Which area of the project is being touched, e.g. "docs". Selects a `scope` override. */
  scope?: string;
}

/** Apply a `scope` override, if one covers the area being touched. */
function effectiveStance(policy: Policy, scope?: string): Stance {
  if (scope && policy.scope && policy.scope[scope]) return policy.scope[scope];
  return policy.stance;
}

export function evaluate(
  policy: Policy,
  origin: PolicyOrigin,
  opts: EvaluateOptions = {},
): Verdict {
  const stance = effectiveStance(policy, opts.scope);
  const scoped = opts.scope && policy.scope?.[opts.scope] ? ` for scope '${opts.scope}'` : "";
  const name = policy.project ?? "This project";
  const requirements: string[] = [];
  const advisories: string[] = [];

  const build = (verdict: Verdict["verdict"], summary: string): Verdict => ({
    verdict,
    exitCode: EXIT_CODES[verdict],
    summary,
    requirements,
    advisories,
    policy,
    origin,
  });

  if (stance === "forbidden") {
    return build("forbidden", `${name} does not accept AI-assisted contributions${scoped}.`);
  }
  if (stance === "unspecified") {
    return build("unknown", `No AI contribution policy found for ${name}. Absence of a policy is not permission — ask a maintainer.`);
  }
  if (stance === "restricted") {
    return build("restricted", `${name} accepts AI-assisted contributions only under narrow conditions${scoped}. A human must confirm this case.`);
  }

  // stance === "allowed"
  if (opts.autonomous && policy.autonomous_agents === "forbidden") {
    return build("restricted", `${name} allows AI-assisted contributions but forbids autonomous agents. A human must drive and submit this contribution.`);
  }
  if (opts.autonomous && policy.autonomous_agents === "review_required") {
    requirements.push("Autonomous agent output requires explicit human review before submission.");
  }

  if (policy.disclosure === "required") {
    requirements.push("Disclose AI tool use in the pull request or commit message.");
  } else if (policy.disclosure === "required_if_substantial") {
    requirements.push("Disclose AI tool use if the AI contribution was substantial — read the policy for where this project draws that line.");
  } else if (policy.disclosure === "recommended") {
    advisories.push("Disclosing AI tool use is recommended.");
  }

  if (policy.human_in_the_loop === "required") {
    requirements.push("A human must review, understand, and be able to explain every submitted line.");
  } else if (policy.human_in_the_loop === "recommended") {
    advisories.push("Human review of all generated content is recommended.");
  }

  if (policy.trailer) {
    requirements.push(`Add the commit trailer '${policy.trailer}:'.`);
  }
  for (const t of policy.forbidden_trailers ?? []) {
    requirements.push(`Do NOT add the '${t}:' trailer on agent-authored commits.`);
  }
  if (policy.copyright_statement === true) {
    requirements.push("The policy requires a copyright/provenance assertion from the contributor — read it before submitting.");
  }

  if (requirements.length > 0) {
    return build("conditions", `${name} accepts AI-assisted contributions${scoped} under ${requirements.length} condition${requirements.length === 1 ? "" : "s"}.`);
  }
  return build("ok", `${name} accepts AI-assisted contributions${scoped} with no stated conditions.`);
}
