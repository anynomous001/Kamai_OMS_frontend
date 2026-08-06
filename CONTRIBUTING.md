# Contributing

## Branches

Three long-lived branches:

- **`main`** — production. Deploys to `app.getkamai.online` (Vercel, auto-deploy on push). Only updated via PR from `stage`.
- **`stage`** — pre-production. Only updated via PR from `development`. See "Staging environment" below — as of 2026-08-07 this does not yet deploy anywhere distinct from `main`.
- **`development`** — integration branch. All feature/fix work branches from here and merges back here via PR.

Nothing is committed directly to `main` or `stage`.

## Branch naming

- `feature/xyz` — new functionality
- `fix/xyz` — non-urgent bug fix, branched from `development`
- `hotfix/xyz` — urgent production bug, branched directly from `main` (see below)

## Promotion flow

```
feature/* ,fix/* ──PR──> development ──PR──> stage ──PR──> main
```

`development` and `stage` are expected to drift ahead of `main` between releases; `main` should never contain a commit that didn't pass through `development` and `stage` first — **except** hotfixes.

## Hotfixes

For a bug already live in production:

1. Branch `hotfix/xyz` directly off `main`.
2. Fix, verify, PR into `main`.
3. After merging to `main`, merge the same commit(s) back into both `stage` and `development` so they don't silently miss the fix and reintroduce the bug on the next normal promotion.

## Before merging to `main`

- CI must pass (typecheck, build, lint — see note below on current CI status).
- Manual smoke test of the affected flow(s), not just a passing build.
- PR description states what was verified and how.

## Current gaps (tracked, not yet closed)

- No CI workflow exists yet (no `.github/workflows`) — typecheck/build/lint are run locally before pushing, not enforced automatically on PRs.
- No dedicated staging deployment exists yet — pushes to `stage` currently only produce Vercel's generic ephemeral preview URLs, not a stable staging domain. Until this is set up, "verify on stage" means running a preview deployment locally against real backend data, not a persistent staging URL.
