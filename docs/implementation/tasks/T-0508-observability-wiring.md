# T-0508 Observability — `request_id` + `business_id` in Logs, Health/Uptime, Error Hook

## Status

- `pending`
- Last updated: 2026-09-07

## Linked Phase

- Phase 06 — Hardening and MVP Acceptance

## Agent Context

- Skills: backend, workflow-contract
- Design docs: `docs/design/architecture/multi-tenancy.md` (path-scoped tenancy "so tenancy is visible in logs"), `docs/design/architecture/system-overview.md` (edge + services), `docs/design/interfaces/internal-rpc.md` (internal context carries `request_id`, `business_id`)
- Constraints: prefer wiring in `@pos/nest-common` so every service benefits from one change; the `correlation-id` Kong plugin already sets `X-Request-Id`; the internal context already carries `request_id` + `business_id` — surface them, don't invent new ones; structured (JSON) log lines; the error hook is a pluggable interface (a no-op default + a Sentry-style adapter stub), not a hard dependency on a vendor.
- Do not touch: business logic. This is cross-cutting middleware + config.

## Objective

Every service request emits a structured log line carrying its `request_id` and (when tenant-scoped) `business_id`; health/readiness are wired for uptime monitoring; unhandled errors flow through a pluggable reporting hook.

## Scope Boundary

**In scope:**
- `@pos/nest-common`: a request-logging middleware/interceptor that logs one structured line per request with `request_id` (from `X-Request-Id` / internal context), `method`, `path`, `status`, `duration_ms`, and `business_id` when the internal context has one; a Nest exception filter that, in addition to the existing error response, calls an injectable `ErrorReporter` (default no-op; a documented adapter interface).
- Wire the middleware + filter into each service's bootstrap (`configureApp` if that is the shared entrypoint).
- Confirm `/healthz` + `/readyz` exist on every service (they do) and are referenced by compose healthchecks + k8s `readinessProbe`/`livenessProbe` (they are) — add any missing one; add a short "uptime check" note to the runbook (T-0509) pointing at `/readyz` per service and Kong `/status`.
- A test: a scoped request produces a log line containing its `request_id` and `business_id` (assert via a captured logger).

**Out of scope:**
- Standing up Prometheus / Grafana / Loki / a real Sentry project (ops; the runbook points at it).
- Distributed tracing spans (post-MVP).
- Metrics endpoints.

## Acceptance Criteria

- A tenant-scoped request through any service logs exactly one structured line that includes its `request_id` and the `business_id` from the internal context.
- A request with no tenant scope logs a line with `request_id` and no `business_id` (not `null` noise — omitted or explicitly null, pick one and be consistent).
- An unhandled error invokes the `ErrorReporter` hook once; with the default no-op reporter nothing is emitted and the HTTP error response is unchanged.
- `/healthz` + `/readyz` are present on every service and wired in compose + k8s.
- `pnpm --filter @pos/nest-common test` + every service `test` green after the wiring.

## Dependencies

- None.

## Implementation Checklist

1. `@pos/nest-common`: request-log middleware + `ErrorReporter` interface + exception-filter hook.
2. Wire into `configureApp` / each service bootstrap.
3. Audit compose + k8s health probes; fill gaps.
4. Logger-capture test for `request_id` + `business_id`.
5. `pnpm -r build/test/lint`; validator.

## Verification

Run and capture:

- The captured structured log line for a scoped request (`request_id` + `business_id`) and for an unscoped one.
- The `ErrorReporter`-invoked-once test.
- `pnpm -r test` green; `python3 .agents/workflows/workflow-contract/scripts/validate_workflow.py` → `WORKFLOW:ok`.
