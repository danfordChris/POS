# T-0116 Per-Service CI + Contracts Compatibility

## Status

- `pending`
- Last updated: 2026-09-01

## Linked Phase

- Phase 01 — Platform and Core Services

## Agent Context

- Skills: workflow-contract
- Design docs: `docs/design/architecture/service-decomposition.md`, `docs/design/interfaces/events-catalog.md`
- Constraints: CI fails on lint / test / build / OpenAPI drift / contracts break / workflow-doc violation; no author attribution in pipeline commits.
- Do not touch: service domain code.

## Objective

CI runs a matrix job per service + package (lint, test against ephemeral Postgres + NATS, build, docker build), a `@pos/contracts` backward-compatibility check, and the workflow-doc validator, blocking merge on any failure.

## Scope Boundary

**In scope:**
- CI workflow with a job matrix over `services/*` and `packages/*` (changed-path filter for speed) + always-run `contracts` and `docs` jobs.
- Ephemeral service containers in CI: one Postgres (a schema per service under test), NATS.
- `contracts` job: assert no removed/renamed event or RPC field vs. the base branch (schema diff).
- `docs` job: `python3 .agents/workflows/workflow-contract/scripts/validate_workflow.py`.
- `docker build` per service on a clean checkout as a release-readiness job.
- Dependency + turbo/nx cache; Flutter analyze/test for `mobile`.
- Branch-protection notes in the root README.

**Out of scope:**
- Deploy automation (post-Phase 01).
- Coverage gates (backlog).

## Acceptance Criteria

- [ ] A PR touching only `services/identity` runs the identity job (+ contracts + docs), not the whole matrix.
- [ ] A lint error, failing test, or build failure in any service fails its job.
- [ ] Removing a field from an event schema fails the `contracts` job.
- [ ] A workflow-doc violation fails the `docs` job.
- [ ] `docker build` succeeds for every service on a clean checkout.
- [ ] All jobs green on `main`.

## Dependencies

- T-0110, T-0112, T-0113, T-0114, T-0115

## Implementation Checklist

- [ ] Author the CI workflow with the service/package matrix + path filters.
- [ ] Add Postgres + NATS service containers for test jobs.
- [ ] Implement the contracts schema-diff check.
- [ ] Add the `docs` validator job.
- [ ] Add per-service `docker build` jobs + caching.
- [ ] Document branch protection.

## Verification

- Command: open a throwaway PR that (a) breaks a contract, (b) breaks a doc; confirm red; revert; confirm green.
- Evidence: links/screenshots of the failing and passing CI runs in the PR description.
