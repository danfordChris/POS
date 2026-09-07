# T-0509 Release Checklist + Ops Runbook + Security Review + U1–U13 CI Matrix

## Status

- `pending`
- Last updated: 2026-09-07

## Linked Phase

- Phase 06 — Hardening and MVP Acceptance

## Agent Context

- Skills: workflow-contract, backend
- Design docs: `docs/design/product/prd-mvp.md` (U1–U13 + Acceptance Criteria), `docs/design/architecture/multi-tenancy.md` (threat model), all Phase 00–05 phase docs
- Constraints: this is the phase's closing task — it depends on T-0501–T-0508 being `done`; the CI matrix must run the actual acceptance tests those tasks produced (not re-implement them); the security review is `/security-review` (user-triggered) — this task prepares the surface, records findings, and triages each; MVP readiness is recorded in `docs/implementation/status/weekly-status.md`.
- Do not touch: feature behaviour. Fixes for review findings are separate follow-ups unless trivial.

## Objective

Ship a release checklist, an ops runbook, a triaged security-review result, and a CI job that runs the full U1–U13 acceptance matrix — so the MVP can be cut with confidence.

## Scope Boundary

**In scope:**
- `docs/` release checklist: version/tag, migrations applied per service, `openapi.json` regenerated, Kong config parsed, k8s manifests rendered, secrets present, backups verified (T-0507), rate limits active (T-0506), all CI green.
- `docs/` ops runbook: deploy (compose + k8s), rollback, per-service migrate, backup/restore (link T-0507), break-glass operator flow (T-0502), incident basics, uptime checks (T-0508).
- `.github/workflows/ci.yml`: an `acceptance` job that runs the isolation suite (T-0503), the RLS backstop specs (T-0504), the concurrency test (T-0505), the rate-limit check (T-0506), and the invitation + grant e2e (T-0501/T-0502) — i.e. the U1–U13 evidence — and fails the build on any regression. A checklist in the task mapping each U-story to its asserting job/spec.
- `/security-review` run: capture the report, triage every finding (fix now / follow-up task / accepted-with-rationale), no open high/critical left untriaged.
- `weekly-status.md`: an MVP-readiness entry summarising the acceptance state.

**Out of scope:**
- Building new features to close review findings (spin follow-up tasks).
- Production infra provisioning (the runbook documents it; standing it up is ops).
- Marketing / release-notes copy.

## Acceptance Criteria

- The release checklist and ops runbook exist under `docs/` and cover deploy, rollback, migrate, backup/restore, break-glass, and uptime.
- `.github/workflows/ci.yml` has an `acceptance` job that runs the T-0503/T-0504/T-0505/T-0506 suites plus the T-0501/T-0502 e2e, and a U-story → job map is in this task doc.
- Every U-story U1–U13 maps to at least one passing automated assertion.
- `/security-review` has been run; every high/critical finding is either fixed or has a linked follow-up task or a written accepted-risk rationale.
- `weekly-status.md` records MVP readiness.
- `python3 .agents/workflows/workflow-contract/scripts/validate_workflow.py` → `WORKFLOW:ok`.

## Dependencies

- T-0501, T-0502, T-0503, T-0504, T-0505, T-0506, T-0507, T-0508 all `done`.

## Implementation Checklist

1. Write the release checklist + ops runbook.
2. Add the `acceptance` CI job wiring the Phase 06 suites.
3. Build the U1–U13 → assertion map.
4. Run `/security-review`; triage findings.
5. Record MVP readiness in `weekly-status.md`.
6. Validator.

## Verification

Run and capture:

- Links to the release checklist + runbook; the `ci.yml` `acceptance` job diff; the U-story map.
- The `/security-review` summary + triage table.
- The `weekly-status.md` MVP-readiness entry.
- `python3 .agents/workflows/workflow-contract/scripts/validate_workflow.py` → `WORKFLOW:ok`.
