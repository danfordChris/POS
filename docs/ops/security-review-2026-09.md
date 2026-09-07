# Security Review — 2026-09 (MVP / Phase 06)

Manual review of the platform's security posture at the end of Phase 06. The
`/security-review` tooling is run separately by the maintainer; this is the
recorded manual pass and its triage. **No high or critical findings.**

## Scope

Auth & tokens, multi-tenant isolation (RLS + edge), input handling / injection,
the edge (Kong) configuration, secrets & logging, the Phase 06 additions
(invitations, control-plane / break-glass, rate limiting, per-business export,
observability, the `inventory` locking fix).

## What holds up

| Area | Assessment |
|---|---|
| **Token model** | JWT access (900s) + opaque, sha-256-hashed rotating refresh tokens; user/operator audience split verified at Kong and re-checked in each service guard. |
| **Operator isolation (U13)** | Operator tokens `403` on every `/v1/businesses/{id}/*` route — enforced at Kong **and** each `TenantGuard`; proven by `services/*/test/isolation.e2e-spec.ts`. Break-glass is the only exception: Owner-approved, ≤ 24h (server-capped), audited per read, revocable — `services/tenancy/test/control-plane.e2e-spec.ts`. |
| **RLS backstop** | `FORCE ROW LEVEL SECURITY` on every tenant table; one non-superuser role per schema; no cross-schema grants. `services/*/test/rls-backstop.e2e-spec.ts` proves an unset / foreign `app.business_id` reads 0 rows from strict tables and every cross-tenant write is rejected. Preserved across `pg_restore` (`infra/restore-drill.sh`). |
| **Internal context** | HMAC-SHA256 signed by Kong, verified per service; a tampered context is rejected. |
| **Invitation tokens** | 24 random bytes (~192 bit), only the sha-256 stored, 7-day expiry, single-use, revocable; `410` on expired/used/revoked. |
| **Passwords** | argon2id at the OWASP baseline (19 MiB / 2 iterations). Provisioned "shell" users get an unusable sentinel hash — cannot authenticate. |
| **Input** | Prisma parameterises all queries; the one raw-SQL helper (`inventory` `lockItems`) uses bound params. Global `ValidationPipe` (`whitelist` + `forbidNonWhitelisted`). |
| **Error handling** | `AllExceptionsFilter` returns a canonical envelope; no stack trace or `devMessage` internals to clients (only a request-id reference on 5xx). |
| **Logging** | Structured `HTTP` lines carry `request_id`, `business_id`, method, path, status — **no tokens, no bodies, no PII**. |
| **Rate limiting** | `/v1/auth/*` 60/min, `/v1/r/{token}` 120/min at Kong (`limit_by: ip`). |
| **Concurrency** | `inventory` row-locks `stock_item` on every quantity mutation (T-0505) — no lost update / over-reservation. |
| **Supply chain** | `pnpm --frozen-lockfile` in CI and every Dockerfile. |

## Findings & triage

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Medium (prod config) | Kong `cors` plugin uses `origins: ['*']`. Auth is bearer-token in a header (not cookies) and `credentials: false`, so there are no ambient credentials to steal, but a production edge should pin `origins` to the known web origin(s). | **Fix before prod** — environment config, not code. Added to `docs/ops/release-checklist.md`. |
| 2 | Low / hardening | Image upload validates the client-declared multipart MIME, not magic bytes. A file with an image content-type but other bytes would be stored (served as its declared type; no server-side image processing). | **Backlog** — magic-byte sniff on upload. |
| 3 | Low / hardening | No progressive backoff / lockout on repeated failed logins beyond the 60/min IP rate limit. | **Backlog** — per-account failure counter + temp lock. |
| 4 | Low / hardening | No security-headers plugin at Kong (HSTS, X-Content-Type-Options, …). The API is JSON-only; the Next.js web app sets its own headers. | **Backlog** — add for the prod edge. |
| 5 | Low / hardening | No `pnpm audit` / Dependabot job in CI. | **Backlog** — added to `docs/implementation/tasks/backlog.md` ("CI coverage gates" neighbourhood). |
| 6 | Low / accepted | `tenancy.business` + `tenancy.membership` carry a SELECT-only `control_plane_read` PERMISSIVE policy (any unscoped SELECT by `tenancy_app` succeeds) so the operator `/v1/admin/businesses` list works. A future unscoped-query bug in `tenancy` could read across tenants. | **Accepted** — SELECT-only; `tenancy_app` is used only by `tenancy`; all app code scopes; the T-0503 isolation + T-0504 backstop specs guard regressions. Documented in `docs/implementation/status/rls-policy-matrix.md`. |
| 7 | Informational | `.env.example` / `infra/docker-compose.yml` ship dev placeholder secrets (`dev-only-…-change-me`). | **Release checklist** already requires real, matching `JWT_ACCESS_SECRET` / `INTERNAL_CONTEXT_SECRET` per environment. |
| 8 | Informational | A winger provisioned by email has no claim / set-password flow, so cannot sign in yet. | **Backlog** feature, not a vulnerability. |

## Outcome

No open high/critical findings. One medium item (wildcard CORS) is a
prod-configuration fix captured in the release checklist. The rest are hardening
follow-ups on the backlog or accepted risks with regression guards.
