# ai-contrib specification v1

A machine-readable expression of a project's policy on AI-assisted contributions.

## Why

Hundreds of open source projects have written AI contribution policies since 2025. Every
one of them is prose, in a different file, phrased differently. A coding agent about to
open a pull request has no way to look up whether it is welcome. Maintainers have no way
to enforce their policy other than reading diffs and getting angry.

This spec does for AI contribution policy what `robots.txt` did for crawling: one boring,
machine-readable statement of the rules, at a predictable location, with a lookup path for
consumers who do not own the repository.

## Non-goals

- **Not a new file format war.** A policy block is valid wherever it is found (see
  Discovery). Embedding it in an existing `AGENTS.md` is a first-class option.
- **Not detection.** This spec says nothing about *whether* a diff was AI-generated.
  Tools like Git AI and agentdiff answer that; they are complements, not competitors.
- **Not authoritative.** The linked `policy_url` is the source of truth. This is an index.

## Discovery

A consumer resolving the policy for a repository MUST try, in order:

1. `.github/ai-contrib.yml` (or `.yaml`) in the repository
2. `ai-contrib.yml` (or `.yaml`) in the repository root
3. A fenced code block tagged `ai-contrib` inside `AGENTS.md`, `CONTRIBUTING.md`, or
   `.github/CONTRIBUTING.md`
4. The consumer's registry, keyed by repository slug or a glob over it
5. Otherwise: `stance: unspecified`

The first hit wins. A policy found in the repository ALWAYS outranks the registry — the
project speaks for itself.

## Fields

```yaml
version: 1                     # required, integer
project: Fedora                # display name
policy_url: https://...        # required for stance != unspecified: the prose policy
homepage: https://...

stance: allowed                # required: forbidden | restricted | allowed | unspecified
autonomous_agents: forbidden   # forbidden | review_required | allowed | unspecified

disclosure: required           # required | recommended | not_required | unknown
human_in_the_loop: required    # required | recommended | not_required | unknown
copyright_statement: true      # does the policy demand a provenance/copyright assertion

trailer: Assisted-by           # required commit trailer name, or null
forbidden_trailers:            # trailers an agent must NOT add (kernel: Signed-off-by)
  - Signed-off-by

scope:                         # optional per-area override of `stance`
  docs: allowed
  translations: forbidden

notes: >
  Free text shown to the contributor.

sources:                       # provenance of THIS entry
  - https://...
confidence: verified           # verified | imported | unverified
updated: 2026-08-29            # ISO date
```

### stance

| value | meaning |
|---|---|
| `forbidden` | AI-assisted contributions are not accepted. |
| `restricted` | Accepted only under narrow conditions stated in `notes` (e.g. read-only agent use, docs only). |
| `allowed` | Accepted, subject to `disclosure` / `human_in_the_loop` / `trailer`. |
| `unspecified` | No policy found. Not the same as permission. |

`stance: allowed` with `disclosure: required` is the single most common real-world
configuration. It is not the same as `stance: allowed` alone, which is why disclosure is a
separate field rather than a stance value.

### confidence

| value | meaning |
|---|---|
| `verified` | Checked against the primary source by a human, or published by the project itself. |
| `imported` | Derived from a third-party aggregated list. Directionally right, details may be wrong. |
| `unverified` | Automated extraction, unchecked. |

Consumers SHOULD surface `confidence` to the user. An `imported` entry is a hint, not a
finding.

## Verdicts and exit codes

A consumer resolving a policy produces exactly one verdict. The reference CLI maps them to
process exit codes so that hooks and CI gates can branch without parsing output:

| verdict | exit | meaning for an agent about to contribute |
|---|---|---|
| `ok` | 0 | Proceed. |
| `conditions` | 2 | Proceed, and satisfy the listed requirements (trailer, disclosure, review). |
| `restricted` | 3 | Do not proceed autonomously. Ask the human operator. |
| `forbidden` | 4 | Do not contribute. |
| `unknown` | 5 | No policy found. Treat as "ask the human", not as "allowed". |
| — | 6 | Verification found commits that violate the policy (`verify` only). |
| — | 1 | Tool error (network, parse, bad input). |

`unknown` deliberately does not map to `ok`. Absence of a policy is absence of
information, not consent.

## Conformance

A conforming producer emits a document that validates against `schema/ai-contrib.schema.json`.
A conforming consumer implements the Discovery order above and the verdict table.
