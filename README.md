# ai-contrib

**Machine-readable AI contribution policies for open source repositories.**
Know the rules before the agent opens the pull request.

```
$ ai-contrib check torvalds/linux

 CONDITIONS  torvalds/linux
Linux Kernel accepts AI-assisted contributions under 5 conditions.

You must:
  - Disclose AI tool use in the pull request or commit message.
  - A human must review, understand, and be able to explain every submitted line.
  - Add the commit trailer 'Assisted-by:'.
  - Do NOT add the 'Signed-off-by:' trailer on agent-authored commits.
  - The policy requires a copyright/provenance assertion from the contributor.
```

## The problem

Since 2025, hundreds of open source projects have written policies on AI-assisted
contributions. They do not agree, and they are all prose:

| Project | Rule |
|---|---|
| Linux Kernel | **Requires** `Assisted-by:`. Agents **must not** add `Signed-off-by:`. |
| attrs | A PR listing an LLM in `Co-authored-by:` **is closed without discussion**. |
| LLVM | Allowed, but **bans autonomous agents** and forbids AI on "good first issue". |
| Alacritty | **Not accepted at all.** |

Two of those projects have exactly opposite rules about commit trailers. A coding agent
about to contribute has no way to look any of this up, and a maintainer has no way to
enforce it other than reading diffs and getting annoyed.

`ai-contrib` is the missing lookup and the missing gate. It does for AI contribution
policy what `robots.txt` did for crawling: one boring, machine-readable statement of the
rules, in a predictable place, with a registry for the projects that have not published
one yet.

## Install

```bash
npm install -g ai-contrib     # or: npx ai-contrib check <repo>
```

## Use it as a contributor (or as an agent)

```bash
ai-contrib check .                          # the repo you are standing in
ai-contrib check llvm/llvm-project          # any repo, by slug or URL
ai-contrib check llvm/llvm-project --autonomous   # "I am an agent with no human driving"
ai-contrib check some/repo --json           # for hooks and scripts
```

Exit codes are the API:

| code | verdict | what an agent should do |
|---|---|---|
| 0 | allowed | proceed |
| 2 | conditions | proceed and satisfy the listed requirements |
| 3 | restricted | stop, ask the human operator |
| 4 | forbidden | do not contribute |
| 5 | no policy found | stop, ask -- absence of a policy is **not** permission |
| 6 | violations found | (`verify` only) |

`examples/claude-code-hook.json` wires this into Claude Code as a `PreToolUse` hook, so
the agent checks before it pushes rather than after a maintainer complains.

## Use it as a maintainer

Declare your policy once, in `.github/ai-contrib.yml`:

```yaml
version: 1
project: My Project
policy_url: https://example.com/CONTRIBUTING.md#ai
stance: allowed          # forbidden | restricted | allowed | unspecified
autonomous_agents: forbidden
disclosure: required
human_in_the_loop: required
trailer: Assisted-by
forbidden_trailers: [Co-authored-by]
```

Then gate pull requests on it:

```yaml
- uses: iliasaberkane6-lab/ai-contrib@v0
```

`verify` reads the commits in the PR and reports violations: an AI tool named in a
forbidden trailer, a declared AI-assisted commit missing your required trailer, AI
assistance declared in a project that does not accept it.

**It never guesses whether code was AI-generated.** It only reads what a contributor or
their tool already declared. Detection is an explicit non-goal — tools like
[Git AI](https://usegitai.com) and [agentdiff](https://github.com/codeprakhar25/agentdiff)
answer that question, and they compose with this one.

## Where the policy comes from

Resolution order — a project always speaks for itself before the registry does:

1. `.github/ai-contrib.yml` or `ai-contrib.yml` in the repository
2. A fenced ` ```ai-contrib ` block inside `AGENTS.md` or `CONTRIBUTING.md`
3. The bundled registry (177 projects)
4. `unspecified`

There is no format war here. If you already have an `AGENTS.md`, put the block in it.

## The registry, and how much to trust it

Every entry carries a `confidence`:

- **`verified`** — checked against the primary source. Currently 11: Linux Kernel, LLVM,
  Rust, CPython, Django, curl, QEMU, ASF (org-wide), attrs, Electron, KubeVirt.
- **`imported`** — derived from the excellent
  [melissawm/open-source-ai-contribution-policies](https://github.com/melissawm/open-source-ai-contribution-policies)
  list (CC0-1.0), whose author notes the classification "is, in many cases, inadequate".
  Directionally right; details may be wrong. The `policy_url` is always authoritative.

The CLI prints the confidence with every answer. **Verifying an entry is the best first
contribution to this project** — see [registry/README.md](registry/README.md).

## Status

v0.1. The spec ([spec/SPEC.md](spec/SPEC.md)) is small on purpose and will change based on
what real policies need. Known gaps, honestly:

- `disclosure` is a four-value enum, so it cannot express "required only above a
  threshold" (Electron and KubeVirt both do this; the nuance lives in `notes` for now).
- Registry keys are `owner/repo` with the forge host stripped, so a GitHub repo and a
  Codeberg repo with the same path would collide. None currently do.
- 24 imported entries have no repo slug and cannot be matched by lookup yet (down from 72;
  the rest live on non-GitHub forges or have no public repository).
- GCC and Godot are widely reported to have banned AI contributions but are not in the
  registry: no primary source was located. Guessing was the wrong answer.

## License

MIT. The seeded registry derives from a CC0-1.0 list; see `registry/README.md`.
