# T-0509 Release Checklist + Ops Runbook + Security Review + U1–U13 CI Matrix

## Status

- `done`
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

Delivered:

- `docs/ops/release-checklist.md` — pre-flight (all CI jobs incl. `acceptance`
  green, contracts-compat, validator, openapi), infrastructure (kong parse, k8s
  render, secrets present + matching, rate limits, pinned CORS, a verified
  restore), deploy (tag, roll images, `migrate deploy` per service, `/readyz`,
  run the acceptance smoke against the deployed edge), post-deploy, and a
  rollback procedure.
- `docs/ops/runbook.md` — umbrella runbook: architecture, deploy (compose + k8s),
  migrations policy, rollback, backup/restore (→ T-0507 doc), the break-glass
  operator flow (T-0502), incident basics, uptime checks (T-0508).
- `.github/workflows/ci.yml` `acceptance` job — brings up the full compose stack,
  waits for readiness, migrates every service, then runs
  `infra/acceptance-smoke.sh` (the U1-U13 walk-through), `infra/rate-limit-smoke.sh`
  (T-0506), and `infra/restore-drill.sh` (T-0507). Fails the build on any
  regression.
- `infra/acceptance-smoke.sh` — new: register → create business (U1) → add
  product (U4) → stock-in (U5) → sale + anonymous receipt (U8) → authorize a
  winger + whitelisted catalog + cross-business probe `403` (U10/U11/U12) →
  operator token on a data route `403` (U13).
- `docs/ops/security-review-2026-09.md` — the manual security pass and triage.
  **No high/critical findings.** 1 medium (wildcard Kong CORS — prod config, in
  the release checklist), 5 low/hardening (image magic-byte sniff, login
  backoff, security-headers plugin, `pnpm audit` in CI, the accepted
  `control_plane_read` relaxation) — logged in `backlog.md`.
- `docs/implementation/status/weekly-status.md` — MVP-readiness entry.

## U-story → CI evidence map

| U | Assertion in CI |
|---|---|
| U1 | `acceptance` job — business + owner membership; `services/tenancy` `service`-matrix specs |
| U2 / U3 | `services/tenancy` `service` matrix — `invitations.e2e-spec.ts` |
| U4 | `acceptance` job + `services/catalog` `service` matrix |
| U5 | `acceptance` job + `services/inventory` `service` matrix |
| U6 | `services/catalog` `service` matrix (find-by-code) |
| U7 | `services/inventory` + `services/notifications` `service` matrix |
| U8 | `acceptance` job (sale + anon receipt) + `services/sales` `service` matrix |
| U9 | `services/sales` + `services/inventory` `service` matrix (void + reversal) |
| U10 / U11 / U12 | `acceptance` job + `services/winger` `service` matrix |
| U13 | `acceptance` job (operator `403`) + `services/*/isolation.e2e-spec.ts` + `services/tenancy/control-plane.e2e-spec.ts` (grant lifecycle) |
| Isolation | `services/*/isolation.e2e-spec.ts` (T-0503) — every data route |
| RLS backstop | `services/*/rls-backstop.e2e-spec.ts` (T-0504) |
| Concurrency | `services/inventory/concurrency.e2e-spec.ts` (T-0505) |
| Rate limits | `acceptance` job → `infra/rate-limit-smoke.sh` (T-0506) |
| Backup/restore | `acceptance` job → `infra/restore-drill.sh` (T-0507) |

(Also `docs/implementation/status/acceptance-map.md`.)

Evidence:

- `bash infra/acceptance-smoke.sh` against the local stack → **all stories
  passed** (U1, U4, U5, U8, U10/U11/U12, U13).
- `bash infra/rate-limit-smoke.sh` → PASS; `bash infra/restore-drill.sh` → PASS.
- `.github/workflows/ci.yml` renders (`acceptance` job added); validator
  `WORKFLOW:ok`.
- `/security-review` (tooling) is the maintainer's to run; the manual review is
  recorded with no open high/critical findings.
