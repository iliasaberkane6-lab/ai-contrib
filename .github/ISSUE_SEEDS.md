# Issue seeds

Ready-to-file issues, so the first contributor has somewhere obvious to land.
File these with `gh issue create` after publishing; label as noted.

---
**[good first issue] Verify a registry entry against its primary source**

166 of 177 registry entries are `confidence: imported` — machine-translated from a
third-party list, so they carry a stance but usually no trailer, no agent rule and no
nuance. Pick any file in `registry/policies/` with `confidence: imported`, open its
`policy_url`, read the actual policy, correct the fields, and set `confidence: verified`.

One entry per PR is perfect. Quote the sentence that supports each field you change.
Verifying an entry has already corrected the data twice: ASF's `Generated-by:` turned out
to be recommended rather than required, and Rust turned out to be `restricted` rather than
`allowed`. See `registry/README.md`.

labels: good first issue, registry
---
**[good first issue] Add GCC and Godot to the registry**

Both are widely reported to have restricted or banned AI contributions in mid-2026, but
neither is in the registry because no primary source was located during the initial seed.
Guessing was rejected as the wrong answer. If you can find the authoritative document —
a steering committee decision, a CONTRIBUTING section, a foundation policy page — that is
a genuinely valuable PR.

labels: good first issue, registry
---
**[good first issue] Add repo slugs to 24 unmatchable entries**

24 entries have no `repos:` field and cannot be found by `ai-contrib check <slug>`. Most
live on non-GitHub forges (sourceware, sr.ht, invent.kde.org, git.drupalcode.org). Adding
a correct host-qualified slug makes an entry reachable. Please verify the repository
actually exists before adding it; the initial seed rejected one candidate that did not.

labels: good first issue, registry
---
**[help wanted] Codex adapter for the contributor-side pre-flight check**

`examples/claude-code-hook.json` wires `ai-contrib check` into Claude Code as a
`PreToolUse` hook, so an agent checks a project's policy before it pushes. The same needs
to exist for Codex, Cursor and a plain git `pre-push` hook. The CLI already exposes
everything needed: `--json` output and distinct exit codes.

labels: help wanted, adapters
---
**[help wanted] Policy extraction from prose CONTRIBUTING files**

Right now a project is in the registry only if someone reads its policy by hand. A helper
that proposes a draft `ai-contrib.yml` from a CONTRIBUTING.md — for a human to check
before it is committed as `confidence: unverified` — would speed that up considerably.

Hard requirement: it must never write `confidence: verified`, and it must never infer a
trailer requirement from free text. attrs writes "No LLM bots in `Co-authored-by:`s"; a
naive extractor turns that into a requirement to add one.

labels: help wanted
---
**[discussion] Should `disclosure` carry a threshold instead of an enum?**

`required_if_substantial` was added because Electron, KubeVirt and curl all require
disclosure only above a materiality threshold, and each draws the line differently:
"accepted largely as-written", "materially contributed", "for security reports". One enum
value flattens three distinct rules. Is a structured threshold worth the complexity, or is
a required/not-required flag plus `notes` the right trade for a v1?

labels: discussion, spec
---
**[maintainers] Is your project represented correctly?**

If your project is in `registry/policies/` and the entry is wrong, that is a bug — open an
issue and it will be fixed quickly. Better still, publish `.github/ai-contrib.yml` in your
own repository; a policy found in a repo always outranks this registry, and the entry here
stops speaking for you.

labels: maintainers
