# Weekly Status

## 2026-09-02 — Phase 02 start (catalog service)

### Summary

- **`catalog` service is live** — the third domain service, behind Kong at
  `/v1/businesses/{businessId}/(categories|products)`. Category + product CRUD,
  role-aware serialization, product image upload to the S3-compatible store, and
  the `catalog` domain events on the outbox.

### Completed

- **T-0101** `services/catalog` scaffold + `category` / `product` in the `catalog`
  schema with forced tenant RLS; init migration; outbox + processed-events tables.
- **T-0102** Catalog endpoints (`GET/POST` categories; `GET/POST/PATCH` products;
  `POST .../deactivate`) behind `InternalContextGuard` + a context-trusting
  `TenantGuard` + `RolesGuard`. `cost_price` is Owner-only; Staff price writes are
  silently dropped. Scan lookup (`?code=`) returns the product or a 404 that
  echoes the code. `CategoryUpserted` / `ProductUpserted` / `PriceChanged` /
  `ProductDeactivated` emitted via the transactional outbox. Idempotent
  `tenancy.BusinessCreated` consumer (bootstrap seam). Kong + compose + k8s + CI
  wired for `catalog`.
- **T-0103** `POST .../products/{id}/image` — multipart upload, MIME allow-list
  (JPEG/PNG/WebP), size cap, existence check, S3 `PutObject` via
  `@aws-sdk/client-s3`; failures return the `upstream_unavailable` envelope, never
  a raw S3 error.

### Contracts

- `@pos/contracts`: added `SUBJECTS.catalog.*` and the `catalog` event payload
  schemas (`CategoryUpserted`, `ProductUpserted`, `PriceChanged`,
  `ProductDeactivated`) with round-trip tests. Additive only — `contracts-compat`
  stays green.

### Tests

- 54 workspace tests green (contracts 6, testing 5, nest-common 16, **catalog 11**,
  tenancy 9, identity 7). `pnpm -r build` / `lint` / `format:check` clean.
  `kong config parse` OK; `kubectl kustomize infra/k8s/base` renders. Validator
  `WORKFLOW:ok`.

### Next

- **T-0104 / T-0105** — `inventory` service: `stock_item` cache + append-only
  `stock_movement` ledger with the transactional on-hand invariant, movement +
  read endpoints (`/stock`, `/stock/movements`, `/stock/low`), `reserveStock` /
  `commitReservation` / `releaseReservation` RPC, and the `Stock*` events.
- **T-0106 – T-0109** — mobile (catalog list/detail, product form, scan, stock-in,
  adjustment) and web (catalog table, product form, stock/movements, CSV). These
  need the app shells (ex T-0006/T-0007), still only `create` scaffolds.

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
