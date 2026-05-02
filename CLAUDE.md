# Yalla Farm — project rules for Claude

## Git workflow — READ FIRST, every git operation

Before performing **any** git command in this repository — committing,
branching, merging, pushing, hotfixing, anything — open
[`docs/git-flow.md`](docs/git-flow.md) and follow it. That document is the
source of truth for branch naming, commit-message format, merge rules and
release process. Treat it as binding, not as suggestion.

Hard rules from that document, summarised:

- **Long-lived branches:** `main` (releases only) and `develop` (integration
  branch). Direct commits to `main` are forbidden.
  *Repo note: the default branch is currently named `master`. Treat `master`
  as `main` per the flow until it is renamed.*
- **Short-lived branches** are always created from `develop`, except
  `hotfix/*` which is created from `main`/`master`:
  - `feature/<name>` — new functionality
  - `bugfix/<name>` — non-critical bug fixes (planned for next release)
  - `hotfix/<name>` — critical production fixes, branched from `main`/`master`
  - `refactor/<name>` — code-quality / structural changes
  - `release/v<X.Y.Z>` — release stabilisation, branched from `develop`
- **Lifecycle:** finish work on the short-lived branch → merge back into
  the right long-lived branch(es) → delete the short-lived branch (local
  and origin).
- **Commit messages:** [Conventional Commits](https://www.conventionalcommits.org/)
  format `type(scope): subject`, English, imperative mood, capitalised
  subject, no trailing period, ≤ 72 chars. Allowed types: `feat`, `fix`,
  `refactor`, `docs`, `style`, `test`, `chore`.
- **Releases on `main`/`master`:** every commit there is a release and
  must be tagged (`v1.2.3`). `release/*` branches merge into BOTH
  `main`/`master` AND `develop`. `hotfix/*` branches likewise merge into
  BOTH and bump a patch tag.

When the user says "merge and push" or "ship this", default to the
release-branch flow (cut a `release/v…` from `develop`, merge into both
long-lived branches, tag) — do **not** merge a feature branch directly
into `main`/`master`.

If the user requests something that contradicts `docs/git-flow.md`,
flag the conflict and ask for confirmation before proceeding.

## Other project context

See `yalla-back/AI_PROJECT_CONTEXT.md` for backend architecture, layers
and runtime behaviour.
