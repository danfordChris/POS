# Weekly Status

## 2026-09-02

### Summary

- **Phase 01 — Platform complete.** The monolith `api/` is removed; the platform now runs as Kong (edge) → `identity` + `tenancy` services over NATS + a shared Postgres (schema/role per service).

### Completed (Phase 01)

- **T-0110** monorepo + `@pos/contracts` + `@pos/nest-common`.
- **T-0115** transactional outbox + `runIdempotent` + `subscribeWithDlq` + `MessageBus`/`NatsCoreBus`/`NatsModule` + `@pos/testing` (`InMemoryBus`).
- **T-0111** NATS (JetStream) + 7 Postgres schemas/roles (cross-schema access denied) + `infra/k8s/base` (kustomize).
- **T-0112** `services/identity` — auth relocated to the `identity` schema, `getUser`/`verifyToken` RPC, `UserRegistered` via outbox, generic `HealthModule`, Dockerfile.
- **T-0113** `services/tenancy` — `business`/`membership` in the `tenancy` schema with RLS, `POST/GET/PATCH /v1/businesses` + members, `resolveMembership` RPC + `X-Internal-Api-Key`-guarded `/v1/internal/membership`, `BusinessCreated`/`MembershipCreated`/`MembershipSuspended` via outbox, `InternalContextGuard`, Dockerfile.
- **T-0114** edge = **Kong** (DB-less) + `pos-internal-context` Lua plugin (HS256 verify, operator gate, cached membership lookup, HMAC-signed internal context). NestJS gateway dropped. compose + `infra/k8s/base` updated. Live e2e through Kong verified.
- **T-0116** `.github/workflows/ci.yml` (per-service matrix + Postgres/NATS + contracts-compat + kong parse + kustomize + docs) and `scripts/ci-local.sh`.
- **T-0117** `test/parity/README.md` endpoint-coverage map + live Kong evidence; `api/` deleted and references purged.

### Error envelope change

- All failure bodies are now `{ error: { code, message, devMessage, details }, requestId }` — `message` user-friendly, `devMessage` technical. `FRIENDLY_MESSAGES` map + optional `userMessage` override in `@pos/nest-common`.

### Design changes (this session)

- decision 0002 + system-overview + service-decomposition + api-contract + integrations updated for **Kong** and the **devMessage** envelope. Data topology stays **one shared Postgres, schema + role per service**.

### Tests

- 42 workspace tests green (contracts 5, testing 5, nest-common 16, identity 7, tenancy 9). `pnpm -r build`/`lint`/`format:check` clean. `kubectl kustomize infra/k8s/base` renders (22 kinds). `kong config parse` OK.

### Next

- Phase 02 — Inventory core (`catalog` + `inventory` services): catalog, stock ledger, scan lookup. Web/mobile shells (ex T-0006/T-0007) target Kong — schedule alongside Phase 02.
