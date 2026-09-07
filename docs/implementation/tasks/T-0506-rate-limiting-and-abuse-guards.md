# T-0506 Rate Limiting on `/v1/r/{token}` + `/v1/auth/*` + a 429 Test

## Status

- `pending`
- Last updated: 2026-09-07

## Linked Phase

- Phase 06 — Hardening and MVP Acceptance

## Agent Context

- Skills: backend, workflow-contract
- Design docs: `docs/design/interfaces/api-contract.md` (`/v1/auth/*` public, `/v1/r/{token}` public no-auth; `429` code), `docs/design/architecture/multi-tenancy.md` (edge is the choke point)
- Constraints: Kong declarative config only for the limits (`infra/kong/kong.yml` + `infra/k8s/base/kong-config.yaml`); the `rate-limiting` plugin already exists on the `auth-public` route — extend, don't rebuild; `policy: local`, `limit_by: ip`; the receipt route currently has **no** limit; pick conservative values (e.g. auth `60/min`, receipt `120/min`) and put them in one place; a test asserts `429` after the limit.
- Do not touch: service code (limits live at the edge). The `request-size-limiting` global plugin is already present.

## Objective

Both public surfaces — auth and the tokenised receipt — are rate-limited at Kong, and a test proves the limit returns `429`.

## Scope Boundary

**In scope:**
- `infra/kong/kong.yml`: add a `rate-limiting` plugin to the `receipt-public` route; confirm / normalise the `auth-public` limit. Mirror both into `infra/k8s/base/kong-config.yaml`.
- A test (extend the compose e2e smoke or a dedicated script) that fires > limit requests at `/v1/auth/login` and `/v1/r/{token}` within a minute and asserts a `429` with the expected body/headers appears.
- A one-line note in `docs/design/interfaces/api-contract.md` Decisions (or a nearby doc) recording the chosen limits, if not already stated.

**Out of scope:**
- Per-user / per-business quotas (post-MVP).
- WAF / bot detection.
- CAPTCHA.

## Acceptance Criteria

- `kong config parse` succeeds with a `rate-limiting` plugin on both `auth-public` and `receipt-public`.
- `kubectl kustomize infra/k8s/base` renders the same limits in `kong-config.yaml`.
- The test shows `POST /v1/auth/login` returns `429` after the configured number of attempts within the window, then recovers after the window.
- The test shows `GET /v1/r/{token}` returns `429` after the configured number within the window.
- Legitimate single requests to both routes still return their normal status.

## Dependencies

- None. `/v1/r/{token}` exists (Phase 04).

## Implementation Checklist

1. Add `rate-limiting` to `receipt-public` in both Kong config files; align `auth-public`.
2. Write the `429` test / extend the smoke.
3. Record the limits in a design Decisions line if absent.
4. `kong config parse`; `kubectl kustomize infra/k8s/base`; validator.

## Verification

Run and capture:

- `kong config parse` output; the `kong-config.yaml` diff.
- The rate-limit test hitting `429` on both routes and recovering.
- `python3 .agents/workflows/workflow-contract/scripts/validate_workflow.py` → `WORKFLOW:ok`.
