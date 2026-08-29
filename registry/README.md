# The ai-contrib registry

One YAML file per project, in `policies/`. It exists so the tool is useful for repositories
that have not published a machine-readable policy themselves. A policy found **in** a
repository always outranks anything here.

## Attribution

The initial seed derives from
[melissawm/open-source-ai-contribution-policies](https://github.com/melissawm/open-source-ai-contribution-policies),
released under **CC0-1.0**. Thank you — that list is the reason this registry started with
177 projects instead of five.

That list carries its own disclaimer, which we take seriously and propagate:

> The classification in the columns below is, in many cases, inadequate. It serves only as
> a general guide and should not be taken as the source of truth.

Which is why every generated entry is marked `confidence: imported`, never `verified`.

## Confidence levels

| level | meaning |
|---|---|
| `verified` | A human read the primary source and filled the fields from it. |
| `imported` | Machine-translated from the CC0 list. Stance is usually right; trailers, agent rules and nuance are usually missing. |
| `unverified` | Automated extraction, unchecked. |

Trailer names are **never** auto-extracted. The upstream list keeps them in free-text
notes, where `attrs` says *"No LLM bots in `Co-authored-by:`s"* — a naive regex would
invert that into a requirement to add one. Trailers are only ever set by hand.

## Verifying an entry (the best first contribution)

1. Pick a file in `policies/` with `confidence: imported`.
2. Open its `policy_url` and **read the actual policy**.
3. Correct the fields against what it says. Add what the importer could not know:
   `trailer`, `forbidden_trailers`, `autonomous_agents`, `repos`, a useful `notes`.
4. Set `confidence: verified` and `updated:` to today. The importer never overwrites a
   verified entry.
5. Open a PR quoting the sentence in the policy that supports each field you changed.

If the policy is ambiguous, say so in `notes` and leave the field `unknown`. `unknown` is
a better answer than a confident wrong one.

## Adding a project

Same shape, `confidence: verified`, and include `repos:` so lookup can find it. Run
`npm test` — every entry is validated in CI.

## If you maintain one of these projects

Two things you can do, in order of preference:

1. **Publish `.github/ai-contrib.yml` in your own repo.** Then this registry stops
   speaking for you entirely.
2. Open a PR here correcting your entry. We will take your word for it and mark it
   `verified`.

If your policy is misrepresented here, that is a bug and we will fix it quickly.
