# T-0008 CI Pipeline + OpenAPI Drift Check

## Status

- `blocked`
- Last updated: 2026-09-01

> **Superseded.** Superseded by Phase 01 T-0116 (per-service CI + contracts compatibility check).

## Linked Phase

- Phase 00 — Foundations

## Agent Context

- Skills: workflow-contract
- Design docs: `docs/design/architecture/system-overview.md`, `docs/design/interfaces/api-contract.md`
- Constraints: CI must fail on lint error, test failure, build failure, OpenAPI drift, or workflow-validator failure; no author attribution anywhere in pipeline-authored commits or tags.
- Do not touch: application feature code.

## Objective

Every push and pull request runs lint, tests, builds for all three apps, the OpenAPI drift check, and the workflow validator, blocking merge on any failure.

## Scope Boundary

**In scope:**
- CI workflow with jobs: `api` (lint, unit + contract tests against a Postgres service, build, `check-openapi-drift`), `web` (lint, test, build), `mobile` (analyze, test), `docs` (`python3 .agents/workflows/workflow-contract/scripts/validate_workflow.py`).
- Dependency caching.
- Branch protection notes in the repo README (manual step documented).
- `docker build` of the `api` and `web` images as a release-readiness job.

**Out of scope:**
- Deploy / release automation (post-Phase 00).
- Coverage gates (backlog).

## Acceptance Criteria

- [ ] A PR with a lint error fails the `api` or `web` job.
- [ ] A PR with a failing test fails its job.
- [ ] Changing an API route without regenerating `openapi.json` fails `check-openapi-drift`.
- [ ] Introducing a workflow-doc violation fails the `docs` job.
- [ ] `docker build` succeeds for `api` and `web` on a clean checkout.
- [ ] All jobs green on the current `main`.

## Dependencies

- T-0001, T-0002

## Implementation Checklist

- [ ] Add the CI workflow with the four jobs + a Postgres service for API tests.
- [ ] Wire `check-openapi-drift` into the `api` job.
- [ ] Add the `docs` job running the workflow validator.
- [ ] Add `docker build` jobs for `api` and `web`.
- [ ] Add caching for package managers and Flutter.
- [ ] Document branch-protection setup in the README.

## Verification

- Command: open a throwaway PR with (a) a lint error, (b) a doc violation, confirm red; then revert and confirm green.
- Evidence: links/screenshots of the failing and passing CI runs in the PR description.
