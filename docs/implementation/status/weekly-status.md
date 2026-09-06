# Weekly Status

## 2026-09-06 — T-0203 done: notifications service scaffold + contact projection

- New `services/notifications` (worker; Nest + `@pos/nest-common`, Prisma on the
  `notifications` schema, `/healthz` + `/readyz`, Dockerfile). Init migration
  `20260906140000_init`: `notification`, `notification_contact`, `outbox`,
  `processed_events`; forced RLS on the two tenant tables.
- `ContactProjectionConsumer` builds `notification_contact` from
  `BusinessCreated` / `MembershipCreated` / `MembershipSuspended` (idempotent on
  `event_id`, DLQ). Recipient resolution can now stay projection-based.
- `@pos/contracts` v1.1 (additive): optional `email`/`locale` on
  `MembershipCreated`, optional `owner_email`/`owner_locale` on `BusinessCreated`
  — optional so `tenancy`'s current emit still validates; tenancy enrichment is
  a new backlog item (until then `notification_contact.email` is null and
  `low_stock` has no owner recipients without `alert_config.recipients`).
- infra: compose worker service, `k8s/base/notifications.yaml` (Deployment + PDB),
  kustomization + secret example, CI matrix entry.
- Tests: `contact-projection.e2e-spec.ts` (5). Backend suites green
  (contracts 7, nest-common 16, testing 5, identity 7, tenancy 9, catalog 11,
  inventory 22, notifications 5); `docker compose config` valid; contracts-compat
  OK; validator `WORKFLOW:ok`.
- Next: T-0204 (low-stock consumer + `EmailSender` + retry/backoff worker).

## 2026-09-06 — T-0202 done: low-stock alert state + edge payloads

- `@pos/contracts` `SCHEMA_VERSION` `1.0.0 → 1.1.0`: `StockFellBelowThreshold`
  gains `opened_at` + `recipients[]`, `StockRecovered` gains `opened_at`
  (additive; `contracts-compat` green).
- `inventory`: new `low_stock_alert_state` table (migration
  `20260906130000_low_stock_alert_state`, RLS) is the edge source of truth;
  `stock_item.low_stock_open` column dropped. `applyToItem` stamps `opened_at`
  on the false→true edge, carries it on the matching `StockRecovered`, and reads
  `alert_config.recipients` onto `StockFellBelowThreshold` (`[]` when unset).
- Tests: 4 new inventory e2e (edge opens in-tx with `opened_at`+recipients, no
  re-emit while open, recover with matching `opened_at`, re-dip fresh
  `opened_at`, `recipients: []` without config). `pnpm --filter @pos/inventory
  test` → 22; contracts 7; backend suites green; validator `WORKFLOW:ok`.
- `pnpm -r build` has a pre-existing intermittent `web` `/_global-error`
  prerender flake under parallel runs (reproduces on the untouched T-0201 tree);
  standalone `web` / `inventory` / `contracts` builds pass.
- Next: T-0203 (`notifications` service scaffold + contact projection).

## 2026-09-06 — T-0201 done: inventory alert-config

- `alert_config` table in the `inventory` schema (migration
  `20260906120000_add_alert_config`, unique `business_id`, forced tenant RLS).
- `GET` / `PUT /v1/businesses/{id}/alert-config` (Owner-only) on
  `services/inventory` — lazy get-or-create default (`recipients: []`,
  `min_interval_hours: 24`), P2002-safe; `PutAlertConfigDto` validates
  `recipients` as an email/uuid list and `min_interval_hours` as int 1..8760.
- Kong edge route `~/v1/businesses/[^/]+/alert-config` added to `inventory-tenant`
  (`infra/kong/kong.yml` + `infra/k8s/base/kong-config.yaml`).
- Tests: `services/inventory/test/alert-config.e2e-spec.ts` (7) — get-or-create +
  persistence, PUT→GET round-trip, Staff `role_forbidden`, path/context mismatch
  `not_a_member`, operator denied, `400 validation_error` cases, tenant
  isolation. `pnpm --filter @pos/inventory test` → 18 passed; `pnpm -r build`
  exit 0; validator `WORKFLOW:ok`.
- Next: T-0202 (`low_stock_alert_state` + edge-event payloads + `@pos/contracts`).

## 2026-09-06 — Phase 03 planned: design refinement adopted + task docs

Thinking pass only — no service code.

- **Design refinement adopted** (proposal `0004`, drafted then merged into
  `docs/design/`, removed from `proposed/`):
  - `notifications` gains a `notification_contact` projection fed by
    `BusinessCreated` / `MembershipCreated` / `MembershipSuspended`; it resolves
    low-stock recipients from that, not a `tenancy` sync call.
  - `low_stock_alert_state` (in `inventory`) is the low-stock edge source of
    truth and supersedes the shipped `stock_item.low_stock_open` column;
    `opened_at` is carried on `StockFellBelowThreshold` / `StockRecovered` and
    forms `notification.dedupe_key`.
  - Additive `@pos/contracts` payload fields: `opened_at` + `recipients[]` on the
    edge events; `email` / `locale` on `MembershipCreated` / `WingerAuthorized`;
    `owner_email` / `owner_locale` on `BusinessCreated`.
  - `notification` creation restated for the schema-per-service reality (atomic
    outbox on producer, exactly-once on consumer); digest flush mechanism
    specified.
  - Edits: `service-decomposition.md`, `events-catalog.md`, `data-model.md`,
    `integrations/notifications.md`.
- **Phase 03 task docs written** — `phase-03-reorder-alerts.md` re-scoped;
  T-0201–T-0207 created, all `pending`:
  - T-0201 `inventory` `alert_config` + `GET/PUT /alert-config` (Owner)
  - T-0202 `inventory` `low_stock_alert_state` + `opened_at`/`recipients` on the
    edge events + contract additions
  - T-0203 `notifications` service scaffold + `notification` /
    `notification_contact` + contact-projection consumers
  - T-0204 `notifications` low-stock consumer + `EmailSender` + retry/backoff
    worker
  - T-0205 `notifications` digest batching within `min_interval_hours`
  - T-0206 `notifications` en/sw templates + Mailpit capture test
  - T-0207 web `/alerts` screen
  - Dependency order: T-0201 → T-0202 → T-0203 → T-0204 → T-0205 → T-0206;
    T-0207 after T-0201.

Validator `WORKFLOW:ok`.

## 2026-09-06 — Mobile brand + splash + e2e test; plan bookkeeping

No phase work. Mobile polish landed since the 2026-09-02 entries, plus a
reconciliation pass on the plan.

- **Rebrand to "Stoki"** (`b9e7175`) — `AppInfo.name` is the single source of
  truth; window title, login wordmark, Android label, iOS `CFBundleName` /
  `CFBundleDisplayName`, pubspec description, and the neumorphic token file
  headers all read from it. Not yet adopted in `docs/design/` — tracked in
  `docs/changes/proposed/0003-product-brand-name.md`; the
  `design_handoff_neumorphic_system/` bundle and `ui-design-system.md` still
  say "Duka Stock".
- **Animated in-app splash** (`93c09e0`) — `features/splash`; `AnimatedBrandMark`
  plays a hand-authored Lottie of three stock blocks converging, then
  cross-fades into the vector logo. Router holds `/splash` for a 3s minimum.
  New resources layer (`Images` / `Svgs` / `Animations`); `flutter_svg` +
  `lottie` wired.
- **Mobile live e2e test** (`a5f2131`) — `mobile/integration_test/live_e2e_test.dart`
  drives the real Dio `ApiClient` + services through
  register → login → business → catalog → stock against the live Kong edge.
  `integration_test` SDK dep + iOS pod.
- **NeuTextField fix** (`3143e10`) — error-border ternary had identical
  branches (every field showed a permanent red outline); restored to
  error-only. Plus Figma polish: smaller radius, shallower inset well,
  text-theme-driven label via new `BuildContext` extensions.
- **Plan reconciliation** — `project.md` Phase 02 moved `[~]` → `[x]` (it was
  verified done on 2026-09-02 per the entries below and `phase-02` doc);
  Current Priorities rolled forward to Phase 03; stale Phase 01 dependency
  lines corrected.
- Chore: stopped tracking a committed `.pyc` under the workflow scripts
  (`c75d5a7`).

Verification: `flutter analyze` clean; `flutter test` (3) pass;
`flutter build apk --debug` succeeds; validator `WORKFLOW:ok`.

## 2026-09-02 — Phase 02 verified end-to-end (`docker compose up`)

Brought the full local stack up and ran a smoke test through Kong (`:8000`).

- **Docker build fixes** — the four service images (`identity`, `tenancy`,
  `catalog`, `inventory`) now build. Root causes: (1) `COPY . .` pulled the host
  `node_modules` into the context → added `.dockerignore`; (2) pnpm aborted the
  non-interactive `node_modules` purge → `ENV CI=true HUSKY=0`; (3) the root
  `prepare` (husky) ran during the `--prod` install with husky pruned →
  `--ignore-scripts` on that step; (4) `@pos/nest-common` declared `@nestjs/*` +
  `express` as **peerDependencies**, so `pnpm --prod` dropped them and the
  runtime image threw `ERR_MODULE_NOT_FOUND: @nestjs/swagger` from
  `nest-common/dist` — moved the real runtime imports into `dependencies`.
- **Migrations** — the service Dockerfiles don't migrate; ran
  `prisma migrate deploy` for all four schemas against the fresh volume
  (initdb creates the schemas/roles only).
- **Smoke test** (`scratchpad/e2e.sh`) — **25/25 pass**: register → login →
  `/auth/me` → create business (role echo `owner`) → category CRUD → product
  create (owner sees `cost_price`) → scan `?code=` hit + 404 echo → `stock_in`
  20 → adjustment −5 → over-adjust → `422 insufficient_stock` → `/stock` →
  `/stock/movements` → drive on-hand to 3 → `ProductUpserted` event feeds
  `reorder_threshold` so `/stock/low` lists it → stranger gets `403 not_a_member`
  on the business and its products.

Phase 02 marked `done`; acceptance criteria checked off. Validator `WORKFLOW:ok`.

## 2026-09-02 — UI polish slice (Figma-inspired, neumorphic)

Read the `Danford-Jurvis's-team-library` Figma ("nexus" POS design, 238 frames) via
the REST API and pulled the first improvement slice, kept in the neumorphic
language:

- **Web** (`a98faee`) — `Badge` (tinted semantic pills + sunken neutral chip),
  `EmptyState` (Card + inset icon chip + CTA), `Skeleton` / `SkeletonTable`
  (`@keyframes shimmer`, reduced-motion aware). Applied to `ProductTable` /
  `StockTable` / `MovementsTable`; `catalog` / `stock` / `stock/movements` got
  `loading.tsx` skeleton screens.
- **Mobile** (`55d8141`, `84db14e`) — `NeuBadge`, `NeuEmptyState`, `NeuStepper`
  (`− value +`, haptic), `NeuSkeleton` (hand-rolled shimmer — `skeletonizer`
  trails the current Flutter `Canvas` API), `NeuSection` (icon-headed panel).
  Catalog list now shows a skeleton + a search-aware empty state; `ProductRow`
  uses `NeuBadge`. `product_form_screen` restructured into Item details / Pricing
  (Owner-only) / Inventory control panels with leading field icons, a stepper for
  the reorder threshold, and a sticky Save bar. `record_movement_screen` uses a
  stepper for stock-in quantity.

`pnpm --filter web lint` + `build` pass; `flutter analyze` clean; `flutter test`
(3) pass. Follow-on polish items tracked in `tasks/backlog.md`.

### Second pass (same day)

- **Mobile catalog list** — `ProductThumb` (image / box-icon), leading search
  icon + trailing scan icon (→ Scan tab), circular FAB, thumb in the skeleton row.
- **Mobile product detail** — restructured: hero (thumb + status badge + name +
  big price), `NeuRing` stock-health ring in an Inventory `NeuSection` (large
  AVAILABLE count, ring coloured green/amber, low-stock-threshold chip), Details
  section, then the actions.
- **Mobile `More`** — a real menu: business-identity header, Switch-business row,
  grouped Manage / App tiles (settings, members, language EN/SW, support,
  gallery), sign out.
- **Mobile Home + web `/`** — hero card (stock value at retail + Products /
  Low-on-stock / Today-sales sub-stats), quick-action row, and a
  requires-attention low-stock list.
- New shared widgets: `NeuRing`, `NeuSection`, `ProductThumb`; `NeuTextField`
  gained a `suffix` slot.

`flutter analyze` clean; `flutter test` (3) pass; `pnpm --filter web lint` +
`build` pass.

## 2026-09-02 — Phase 02 feature screens code-complete

### Summary

- **All Phase 02 screens (T-0106–T-0109) are built** against the live catalog +
  inventory APIs. The mobile app was first refactored onto the project's
  documented Flutter architecture (see the mobile-architecture note below).

### Completed

- **T-0109 (web)** — `lib/tenant-api.ts` (server tenant-scoped Kong client);
  `/catalog` list (search / category / status filters, on-hand column, cost
  Owner-only, cursor) + `/catalog/new` + `/catalog/[id]` product form (price
  fields Owner-only) + image upload + confirmed deactivate via server actions;
  `/stock` on-hand table + `/stock/export` CSV route + Record-movement panel;
  `/stock/movements` filterable ledger.
- **Mobile architecture refactor** — `mobile/lib` restructured to the
  `.agents/skills/skills/mobile/` conventions: `AppRoute` enum routing,
  `provider` + local `BaseProvider`, `SessionProvider` (was an
  `InheritedNotifier`), `AppProvider` (ThemeMode), `MultiProvider` in `main.dart`,
  feature-first `lib/features/`, `lib/core/{router,network,theme,extensions}`,
  `lib/data/services/<f>_service.dart` (static over `ApiClient.instance`),
  `lib/models/`, `lib/shared/{providers,widgets}`. All imports
  `package:pos_mobile/...` — `analysis_options` enforces
  `always_use_package_imports`. Truth doc: `docs/design/architecture/mobile-architecture.md`.
- **T-0106 (mobile)** — `CatalogProvider`; catalog list (search, on-hand + low
  badge, refresh, "load more"); product detail (refetch, `cost_price` Owner-only,
  Stock-in / Adjust / Deactivate actions); create/edit form (price fields
  Owner-only, category dropdown). Home wired to product / low-stock counts +
  quick actions.
- **T-0107 (mobile)** — Scan screen: code entry → `CatalogService.findByCode`
  (`?code=`, 404 → null) → open the product, or start a new product with the
  code prefilled. Camera capture (`mobile_scanner`) is on the backlog.
- **T-0108 (mobile)** — `StockProvider`; one Record-movement screen (segmented
  `stock_in` / `adjustment`, product fixed from a detail or picked from Home,
  signed quantity, reason) → `POST /stock/movements`; on success refreshes the
  catalog's cached `StockItem` and shows the new on-hand; `422 insufficient_stock`
  renders `ErrorByCodeCard`.

### Tests

- Web: `pnpm --filter web lint` + `build` pass. Mobile: `flutter analyze` →
  "No issues found!"; `flutter test` → 3 passing. Backend unchanged — 66
  workspace tests green. Validator `WORKFLOW:ok`.

### Next

- Live end-to-end pass: `docker compose up` (Kong + identity + tenancy + catalog
  + inventory) and drive web + mobile against the real APIs; then Phase 02
  acceptance sign-off. Then Phase 03 (reorder alerts: `inventory` →
  `notifications`).

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
