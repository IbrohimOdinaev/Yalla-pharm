# Yalla Farm — project rules for Claude

## Git workflow

Simple two-branch flow:

- **`develop`** — integration branch. All feature/bugfix/refactor work
  lands here first (directly, or via short-lived branches merged back
  into `develop`).
- **`master`** — releases. `develop` is merged into `master` when a
  release is cut. **Never make changes directly on `master`** unless
  the user explicitly asks for a release/hotfix.

Conventional Commits format for messages:
`type(scope): subject` — English, imperative, capitalised, no trailing
period, ≤ 72 chars. Types: `feat`, `fix`, `refactor`, `docs`, `style`,
`test`, `chore`.

The old long-lived `receptMaster` branch and its `recept/*` sub-branches
have been retired — the prescription system is now part of `master` /
`develop` like any other feature.

## Other project context

See `yalla-back/AI_PROJECT_CONTEXT.md` for backend architecture, layers
and runtime behaviour.
