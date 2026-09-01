# Project agent guide

<!-- One source of truth for every AI coding agent. AGENTS.md is read by Codex,
     Cursor, Gemini CLI, Copilot and others; CLAUDE.md is a symlink to this file. -->

## What this project is

Multi-tenant stock management platform for small retailers (starting in Tanzania). Each business
is a fully isolated tenant; the platform vendor cannot see tenant business data. Three deliverables:

- `api/` — NestJS + TypeScript REST API (PostgreSQL + Prisma from task T-0002 onward)
- `web/` — Next.js web admin console
- `mobile/` — Flutter app (Android / iOS)
- `infra/` — Docker Compose local backing services

`api` + `web` form a pnpm workspace. `mobile` is a standalone Flutter project.

## Workflow Authority

- Canonical workflow policy: `.agents/workflows/workflow-contract/spec/*`
- Canonical validator: `python3 .agents/workflows/workflow-contract/scripts/validate_workflow.py`

## Start Here

1. Classify the task (layer, lifecycle state, agent mode).
2. Run `python3 .agents/workflows/workflow-contract/scripts/validate_workflow.py`.
3. Read `docs/design/`.
4. Read `docs/implementation/`.
5. If behavior is unresolved, read or create `docs/changes/proposed/`.
6. Load required repo skill(s).
7. Inspect target service code before editing.

## Conventions

- Commit messages: imperative mood; no author, co-author, or tool attribution of any kind.
- Branch, don't commit to a shared base, unless told otherwise. Commit/push only when asked.
- Wrap fallible I/O and external calls in try/catch; return typed errors, never raw stack traces.
- `docs/design/` holds approved product/system truth. Do not define net-new behavior in
  `docs/implementation/`; put unresolved behavior in `docs/changes/proposed/`.
- Run `pnpm format` / `pnpm lint` / `pnpm test` before proposing changes to `api` or `web`.
- Flutter: `flutter analyze` and `flutter test` in `mobile/`.

## Skills

Reusable skills live in `.agents/skills/` and are shared across all agents.
Workflow packages live in `.agents/workflows/`.

- Docs / tasks / proposals → `.agents/skills/workflow-contract/SKILL.md` (first).
- Backend (`services/*`, `packages/*`) → `.agents/skills/skills/backend/SKILL.md`.
  Repeatable commands: `/scaffold-service`, `/add-prisma-model`, `/add-event`,
  `/add-consumer`, `/add-rpc`, `/add-endpoint`, `/add-service-ci`.
- Mobile (`mobile/`) → `.agents/skills/skills/mobile/SKILL.md`.
