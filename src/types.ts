export type Stance = "forbidden" | "restricted" | "allowed" | "unspecified";
export type Requirement = "required" | "recommended" | "not_required" | "unknown";
export type AgentStance = "forbidden" | "review_required" | "allowed" | "unspecified";
export type Confidence = "verified" | "imported" | "unverified";

export interface Policy {
  version: 1;
  project?: string;
  policy_url?: string;
  homepage?: string;
  repos?: string[];
  stance: Stance;
  autonomous_agents?: AgentStance;
  disclosure?: Requirement;
  human_in_the_loop?: Requirement;
  copyright_statement?: boolean | null;
  trailer?: string | null;
  forbidden_trailers?: string[];
  scope?: Record<string, Stance>;
  notes?: string;
  sources?: string[];
  confidence?: Confidence;
  updated?: string;
}

export type VerdictName = "ok" | "conditions" | "restricted" | "forbidden" | "unknown";

export const EXIT_CODES: Record<VerdictName, number> = {
  ok: 0,
  conditions: 2,
  restricted: 3,
  forbidden: 4,
  unknown: 5,
};

export interface Verdict {
  verdict: VerdictName;
  exitCode: number;
  /** Human-readable one-liner. */
  summary: string;
  /** Hard obligations. Their presence is what turns `ok` into `conditions`. */
  requirements: string[];
  /** Recommended-but-not-mandatory guidance. Never changes the verdict. */
  advisories: string[];
  policy: Policy;
  /** Where the policy came from. */
  origin: PolicyOrigin;
}

export interface PolicyOrigin {
  kind: "repo-file" | "embedded-block" | "registry" | "none";
  /** File path or registry key. */
  location?: string;
}
