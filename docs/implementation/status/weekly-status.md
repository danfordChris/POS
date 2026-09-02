# Weekly Status

## 2026-09-02 — web + mobile app shells

### Summary

- **Both clients now have a real app shell** — sign in / register / create-business
  against Kong, session-driven routing, and the navigation chrome. Feature screens
  (T-0106–T-0109) plug into this next.

### Completed

- **T-0120 (web)** — `lib/api.ts` typed Kong client (`ApiError` carries the
  envelope); Next 16 `proxy.ts` gates every route on a refresh-token cookie and
  transparently refreshes the access token against Kong before expiry; httpOnly
  cookies set by `/api/auth/{login,register,logout}` + `/api/businesses` route
  handlers (the browser never holds a token); `(auth)` login/register + `/onboarding`;
  `(shell)` layout with a 232px sidebar (Owner-only "Manage" section hidden for
  Staff), header (business switcher, theme toggle, sign out), dashboard, and themed
  stubs for the feature routes (`Forbidden` for Staff on Owner-only pages). Gallery
  moved to `/style`. Theme provider is now SSR-deterministic. `lint` + `build` pass.
- **T-0121 (mobile)** — `data/api_client.dart` (Dio + bearer + one-shot 401
  refresh + `ApiException`); `flutter_secure_storage` token store; `SessionController`
  state machine (`loading → signedOut → needsBusiness → ready`) that `go_router`
  redirects on; `StatefulShellRoute` bottom nav (Home / Catalog / Scan* / Sell /
  More, Scan raised); real login/register/onboarding on the neumorphic kit; stubs
  for the rest; gallery reachable from More. `flutter analyze` clean; `flutter test`
  (3) pass.
- **tenancy** — `GET /v1/businesses/:businessId` now echoes the caller's `role`
  (from the membership `TenantGuard` already resolves) so a client can gate
  Owner-only UI without a members lookup.

### API gaps surfaced (backlog)

- No `GET /v1/businesses` "list my memberships" endpoint → the shells force
  onboarding for every user and cannot offer multi-business switching.
- `GET /v1/auth/me` returns empty `memberships` / `wingerAccounts` (identity does
  not compose tenancy data).

### Tests

- Web: `pnpm --filter web lint` + `build` pass. Mobile: `flutter analyze` +
  `flutter test` pass. Backend unchanged — 66 workspace tests still green.
  Validator `WORKFLOW:ok`.

### Next

- The Phase 02 screens against the live catalog + inventory APIs: mobile catalog +
  product form (T-0106), scan (T-0107), stock-in / adjustment (T-0108); web catalog
  + stock + movements + CSV (T-0109).

## 2026-09-02 — inventory service (Phase 02 backend complete)

### Summary

- **`inventory` service is live** — the fourth domain service, behind Kong at
  `/v1/businesses/{businessId}/stock`. Phase 02's backend (catalog + inventory) is
  now complete; what remains in the phase is the client app shells + screens.

### Completed

- **T-0104** — `services/inventory` scaffold; `stock_item` (cache), append-only
  `stock_movement` ledger, `stock_reservation`, all with forced tenant RLS in the
  `inventory` schema. `POST /stock/movements` (`stock_in` | `adjustment`) records
  the movement and moves `stock_item.quantity` by the same delta in one tenant
  transaction, so `quantity == sum(quantity_delta)` holds by construction.
  `Idempotency-Key` replay; 422 `insufficient_stock` when an adjustment would go
  negative. Emits `StockMovementRecorded` / `StockLevelChanged` and the
  `StockFellBelowThreshold` / `StockRecovered` edge events via the outbox.
  `catalog.ProductUpserted` consumer seeds `stock_item` + tracks
  `reorder_threshold`/active; `ProductDeactivated` clears active — idempotent on
  `event_id`.
- **T-0105** — `GET /stock`, `/stock/movements` (`?product_id=` `?type=`),
  `/stock/low` (on-hand ≤ threshold). `reserveStock` / `commitReservation` /
  `releaseReservation` NATS handlers — soft holds against on-hand, commit writes
  `sale` movements, all idempotent on `reservation_id`.

### Contracts

- `@pos/contracts`: `SUBJECTS.inventory.stockMovementRecorded` + `stockRecovered`;
  `stockMovementRecordedPayload` / `stockLevelChangedPayload` /
  `stockRecoveredPayload`; `commitReservation` / `releaseReservation` request +
  response pairs. **`ProductUpserted` payload gains `reorder_threshold`** (additive)
  — `events-catalog.md` and the catalog emitter updated. `contracts-compat` green.

### Tests

- 66 workspace tests green (contracts 7, testing 5, nest-common 16, **inventory 11**,
  catalog 11, tenancy 9, identity 7). `pnpm -r build` / `lint` / `format:check`
  clean. `kong config parse` OK; `kubectl kustomize infra/k8s/base` renders;
  `docker compose config` valid. Validator `WORKFLOW:ok`.

### Next

- Client app shells (nav / routing / auth / API client) on `web/` + `mobile/`, then
  the Phase 02 screens (T-0106–T-0109) built from the neumorphic kit against the
  live catalog + inventory APIs.

## 2026-09-02 — Neumorphic design system wired into both clients

### Summary

- **`web/` and `mobile/` now carry the neumorphic design system** from
  `docs/design/interfaces/design_handoff_neumorphic_system/` — tokens (color roles,
  elevation, radius, spacing, type) + per-component and accessibility rules. The
  handoff's screen mockups are **not** adopted; screens are designed fresh from
  `web-app-spec.md` / `mobile-app-spec.md`.

### Completed

- **T-0118 (web)** — `app/tokens.css` (OKLCH roles, light base + dark via
  `[data-theme]` and `prefers-color-scheme`, elevation/radius/spacing/type),
  `globals.css` Tailwind v4 `@theme` utility mapping, `lib/tokens.ts`,
  `lib/theme.tsx` (`ThemeProvider`, localStorage-persisted, no-flash init script),
  Nunito via `next/font`, and `components/ui/` (`Button`, `Card`/`Well`/`Panel`,
  `TextField`, `Toggle`, `SegmentedControl`, `ErrorCard`, `ThemeToggle`) — tokens
  only. `app/page.tsx` is a living component gallery. `pnpm --filter web lint` +
  `build` pass.
- **T-0119 (mobile)** — `theme/duka_colors.dart` (`DukaColors` ThemeExtension),
  `theme/duka_tokens.dart` (radius/spacing/elevation), `theme/neu.dart` (`NeuBox`
  raised + `NeuWell` inset via `CustomPainter`), `theme/duka_theme.dart`
  (`buildDukaTheme(Brightness)` with a Nunito text theme), `widgets/` (`NeuButton`,
  `NeuTextField`, `NeuToggle`, `SegmentedNeu`, `ErrorByCodeCard`), and a component
  gallery `main.dart`. `flutter analyze` clean; `flutter test` (3) pass.
- Design record: `docs/design/interfaces/ui-design-system.md`.

### Design system rules baked in

- One surface hue family — elevation via shadow only; no pure white/black surfaces.
- Primary CTA is always a solid accent pill; destructive is `danger` + confirm.
- Error-by-code component is the only surface for a failed request (title + code +
  one action; never a stack trace / `devMessage`).
- 2px accent focus ring; reduced-motion respected; touch targets ≥ 48 (mobile).

### Next

- App shells (nav / routing / auth) on both clients, then the Phase 02 screens
  (T-0106–T-0109) built from this kit.

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
