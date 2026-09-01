# Phase 05 — Hardening and MVP Acceptance

## Status

- `pending`
- Last updated: 2026-09-01

## Objective

Prove tenant isolation, operator restrictions, and the PRD acceptance criteria, then cut the MVP release.

## Scope

- Cross-tenant test suite across every data-plane route.
- RLS backstop test with the application filter disabled.
- Operator/break-glass tests: 403 without a grant; success + `audit_log` with an active grant; grant auto-expiry ≤ 24h.
- Winger DTO schema snapshot test.
- Load smoke: sale + stock endpoints under concurrency (no lost updates on on-hand).
- Rate limiting on `/auth/*` and public `/r/{token}`.
- Backup + per-business export path verified through tenant scope.
- Observability: structured logs with `business_id`, error tracking, uptime check.
- Release checklist + runbook.

## Features

- `docs/implementation/status/weekly-status.md` updated with MVP readiness.
- Security review pass (`/security-review`).

## Tasks

- [ ] T-0501 Cross-tenant route test suite
- [ ] T-0502 RLS-only isolation test (app filter off)
- [ ] T-0503 Operator + support-grant test suite
- [ ] T-0504 Winger DTO schema snapshot test
- [ ] T-0505 Concurrency test on on-hand updates
- [ ] T-0506 Rate limiting + abuse guards
- [ ] T-0507 Backup + per-business export verification
- [ ] T-0508 Observability wiring
- [ ] T-0509 Release checklist + runbook + security review

## Acceptance Criteria

- [ ] All PRD stories U1–U13 pass in CI.
- [ ] Isolation suite: every data route rejects non-members (403); RLS-only test leaks zero rows.
- [ ] Operator token denied on all data routes; access under a grant recorded in `audit_log`; grant expires ≤ 24h.
- [ ] Concurrent sales on one product never drive on-hand below zero or lose a decrement.
- [ ] Security review has no open high/critical findings.

## Blockers

- Phases 00–04 must be `done`.

## Linked Tasks

- `docs/implementation/tasks/`
