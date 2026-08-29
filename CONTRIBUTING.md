# Contributing to ai-contrib

## AI-assisted contributions

Welcome and expected. This project exists to make them legible, so it would be strange to
ban them. The rules are declared machine-readably in
[`.github/ai-contrib.yml`](.github/ai-contrib.yml) — run `ai-contrib check .` to read them.

In short: add an `Assisted-by:` trailer, and be able to explain every line you submit.
"An LLM wrote it" is not an answer to a review comment.

## Good first contributions

Open issues are labelled, and the four below are filed and ready to pick up:

- **[#1](../../issues/1) Verify a registry entry.** 156 of 177 entries are `imported` —
  machine-translated from a third-party list, missing trailers and agent rules. One entry
  per PR is fine and welcome. See [registry/README.md](registry/README.md).
- **[#2](../../issues/2) Add GCC and Godot.** Both are widely reported to have restricted
  AI contributions in mid-2026, but no primary source was located, so neither is in the
  registry. Guessing was rejected as the wrong answer.
- **[#3](../../issues/3) Add repo slugs to 24 unmatchable entries**, so lookup can find
  them.
- **[#4](../../issues/4) Write an adapter** — a Codex or Cursor equivalent of
  `examples/claude-code-hook.json`, or a plain git `pre-push` hook.

## Development

```bash
npm install
npm test            # builds, then runs node --test
node dist/cli.js check . --offline
```

Every registry entry is validated in CI. If you add a field to the schema, update
`spec/SPEC.md`, `schema/ai-contrib.schema.json`, `src/parse.ts` and a test — in that order.

## Design rules that will not change

1. **No detection.** This project never guesses whether code was AI-generated. It reads
   declared policy and declared trailers. Guessing is a different problem with different
   tools.
2. **A project speaks for itself.** A policy file in a repository always outranks the
   registry.
3. **`unknown` beats a confident wrong answer.** If a policy is ambiguous, say so.
4. **Absence of a policy is not permission.** It exits 5, never 0.
