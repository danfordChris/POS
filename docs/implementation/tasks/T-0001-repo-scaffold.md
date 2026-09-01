# T-0001 Repo Scaffold and Tooling

## Status

- `pending`
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

- [ ] `docker compose -f infra/docker-compose.yml up` starts Postgres, Redis, MinIO, and mail capture with healthchecks passing.
- [ ] `api/`, `web/`, `mobile/` each build with a no-op starter (`api` serves `GET /health` 200 stub; `web` renders a placeholder; `mobile` runs a debug build).
- [ ] Lint and format run clean at repo root.
- [ ] Git initialized (pending residual decision) or explicitly deferred with a note in the PR.

## Dependencies

- Residual items 3–4 in `docs/changes/proposed/0001-stock-management-platform.md` (git init, backend confirmation).

## Implementation Checklist

- [ ] Create monorepo directories and root config.
- [ ] Scaffold NestJS app in `api/` with `/health` stub.
- [ ] Scaffold Next.js app in `web/`.
- [ ] Scaffold Flutter app in `mobile/`.
- [ ] Write `infra/docker-compose.yml` with the four services + healthchecks.
- [ ] Add `.env.example` covering DB, Redis, storage, mail.
- [ ] Write root README setup section.

## Verification

- Command: `docker compose -f infra/docker-compose.yml up -d && curl -fsS localhost:3000/health`
- Evidence: compose ps output with healthy services + `200` from `/health` pasted into the PR.
