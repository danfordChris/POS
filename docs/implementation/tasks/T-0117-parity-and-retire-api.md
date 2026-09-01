# T-0117 Parity Suite + Retire the Monolith

## Status

- `pending`
- Last updated: 2026-09-01

## Linked Phase

- Phase 01 — Platform and Core Services

## Agent Context

- Skills: workflow-contract
- Design docs: `docs/design/interfaces/api-contract.md`, `docs/design/architecture/system-overview.md`
- Constraints: no behaviour change vs. end-of-Phase-00; delete `api/` only after parity is green.
- Do not touch: nothing off-limits — this task removes `api/`.

## Objective

An end-to-end parity suite proves every Phase 00 endpoint behaves identically through the microservice stack, then `api/` is deleted and all references removed.

## Scope Boundary

**In scope:**
- `test/parity/` (root or `services/gateway`): black-box HTTP tests against the composed stack for every Phase 00 endpoint — auth register/login/refresh(+reuse)/logout/me, operator login/me, businesses create/get/patch, cross-tenant 403, operator 403, validation + not-found envelopes.
- Run parity in CI against the docker-compose stack.
- Delete `api/`; remove it from `pnpm-workspace.yaml`, CI, compose, docs; update `README.md`.
- Update `docs/implementation/phases/phase-00-foundations.md` note to point at the shipped services.

## Acceptance Criteria

- [ ] Parity suite: every listed endpoint returns the same status + body shape as the Phase 00 monolith (golden snapshots).
- [ ] Parity suite runs in CI and is required for merge.
- [ ] `api/` is gone; `grep -r "api/" ` finds no live references (docs history excepted).
- [ ] `docker compose up` no longer starts an `api` container; the stack still serves every parity endpoint.
- [ ] `pnpm -r build && pnpm -r test` green without `api/`.

## Dependencies

- T-0112, T-0113, T-0114, T-0116

## Implementation Checklist

- [ ] Write `test/parity/*` covering the Phase 00 endpoint list with golden snapshots captured from the current monolith.
- [ ] Wire parity into CI + compose.
- [ ] Delete `api/`; purge references (workspace, CI, compose, README, scripts).
- [ ] Update the Phase 00 phase doc note.
- [ ] Full `pnpm -r build && pnpm -r test` + compose smoke.

## Verification

- Command: `docker compose -f infra/docker-compose.yml up -d && pnpm --filter parity test && pnpm -r build && pnpm -r test`
- Evidence: parity report (all green), a diff showing `api/` removed, and a compose `ps` without `api`, pasted into the PR.
