# T-0508 Observability — `request_id` + `business_id` in Logs, Health/Uptime, Error Hook

## Status

- `done`
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

Delivered (all in `@pos/nest-common`, so every service picks it up via `configureApp`):

- `correlationId` middleware now logs **one structured JSON line per request** on
  the `HTTP` logger: `{ request_id, method, path, status, duration_ms,
  business_id? }`. `business_id` is read from `req.internalContext` on
  `res.on('finish')` (after `InternalContextGuard` ran) and is omitted when the
  request had no tenant context.
- `http/error-reporter.ts` — `ErrorReporter` interface (`captureException(err,
  { requestId, method, path, businessId })`), a `noopErrorReporter` default, and
  a documented adapter shape for wiring a real client (Sentry, …).
- `AllExceptionsFilter` takes an optional `ErrorReporter` (default no-op) and
  calls it **once per unhandled 5xx**, wrapped in try/catch so a broken reporter
  never affects the HTTP response. `configureApp({ errorReporter })` threads it
  through. Not invoked for 4xx.
- Health probes audited: `GET /healthz` + `/readyz` are on every service (via
  `HealthModule`) and wired in compose `healthcheck`s + k8s
  `liveness/readinessProbe`s — nothing missing. Uptime + log-shipping + error-hook
  guidance added to `docs/ops/backup-restore-runbook.md`.

Evidence:

- `pnpm --filter @pos/nest-common test` → 22 (+6): `correlation-id.middleware.spec`
  — one structured line with `request_id`, no `business_id` when unscoped,
  `business_id` from the internal context, honours an inbound `x-request-id`;
  `all-exceptions.filter.spec` — reporter invoked once for a 5xx with
  request/business context, NOT for a 4xx, a throwing reporter never breaks the
  response.
- Per-service suites all green (run serially — see note): identity 8, tenancy 33,
  catalog 46, inventory 62, sales 48, notifications 37, winger 37. contracts 13,
  testing 5.
- `pnpm --filter @pos/nest-common lint` clean; `node scripts/check-contracts-compat.mjs HEAD` → OK; validator `WORKFLOW:ok`.

Note: `pnpm -r test` across all packages at once can flake on the shared local
Postgres now that T-0503/T-0505 added HTTP-heavy specs (connection-pool
contention → a transient non-403). CI runs each service in its own matrix job
with a dedicated Postgres, so it is unaffected; locally use
`pnpm --workspace-concurrency=1 test`. Logged in `backlog.md`.
