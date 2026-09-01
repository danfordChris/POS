# T-0001 Repo Scaffold and Tooling

## Status

- `done`
- Last updated: 2026-09-01

## Linked Phase

- Phase 00 — Foundations

## Agent Context

- Skills: workflow-contract
- Design docs: `docs/design/architecture/system-overview.md`, `docs/design/decisions/0001-foundational-choices.md`
- Constraints: no author attribution in commit messages; wrap fallible I/O in try/catch; production-grade defaults.
- Do not touch: `docs/design/*`, `.agents/*`

## Objective

A monorepo exists with `api/`, `web/`, `mobile/`, shared config, and a `docker-compose` local stack, all building green.

## Scope Boundary

**In scope:**
- Repo layout: `api/` (NestJS), `web/` (Next.js), `mobile/` (Flutter), `infra/` (compose).
- Root tooling: formatter, linter, commit hooks, `.editorconfig`, `.gitignore`, `.env.example`.
- `infra/docker-compose.yml`: Postgres, Redis, MinIO, mail capture (e.g. Mailpit).
- README with setup steps.

**Out of scope:**
- Any feature code, auth, models, migrations (T-0002+).
- CI pipeline (T-0008).

## Acceptance Criteria

- [x] `infra/docker-compose.yml` defines Postgres, Redis, MinIO (+ bucket setup), and Mailpit with healthchecks; `docker compose config` validates. Live bring-up + healthcheck verification is owned by T-0009 (which adds the app containers and Dockerfiles); no Docker daemon is available in the current session.
- [x] `api/`, `web/`, `mobile/` each build with a no-op starter (`api` serves `GET /health` 200; `web` renders a placeholder; `mobile` passes `flutter analyze` + widget test — full device debug build needs an attached device/emulator).
- [x] Lint and format run clean at repo root.
- [x] Git initialized on `main`; scaffold committed.

## Dependencies

- Resolved 2026-09-01: git initialized; backend confirmed NestJS + PostgreSQL + Prisma.

## Implementation Checklist

- [x] Create monorepo directories and root config (`pnpm-workspace.yaml`, `package.json`, `.editorconfig`, `.nvmrc`, `.prettierrc.json`, `.prettierignore`, `.husky/pre-commit` + lint-staged).
- [x] Scaffold NestJS app in `api/` with `/health` stub (NestJS 12, ESM, vitest, oxlint).
- [x] Scaffold Next.js app in `web/` (Next 16, Tailwind 4) with a placeholder page.
- [x] Scaffold Flutter app in `mobile/` (`org tz.co.pos`, `pos_mobile`) with a placeholder screen.
- [x] Write `infra/docker-compose.yml` with Postgres, Redis, MinIO (+ bucket setup), Mailpit + healthchecks.
- [x] Add `.env.example` covering DB, Redis, storage, mail, web.
- [x] Write root README setup section + `infra/README.md`; fill `AGENTS.md`.

## Verification

- Commands run:
  - `pnpm install` — exit 0.
  - `pnpm format:check` — "All matched files use Prettier code style!"
  - `pnpm --filter api lint` — oxlint, exit 0.
  - `pnpm --filter api test` — vitest, 1 file / 1 test passed.
  - `pnpm --filter api build` — `api/dist/main.js` produced.
  - `pnpm --filter web lint` — eslint, exit 0.
  - `pnpm --filter web build` — Next 16 build "Compiled successfully", routes `/` and `/_not-found` prerendered.
  - `cd mobile && flutter analyze` — "No issues found!"
  - `cd mobile && flutter test` — "All tests passed!"
  - `docker compose -f infra/docker-compose.yml config -q` — valid.
- Not verified here: live `docker compose up` healthchecks (no Docker daemon in session) — owned by T-0009. Full on-device mobile debug build (no device/emulator attached).
