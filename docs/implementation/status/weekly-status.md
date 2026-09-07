# Weekly Status

## 2026-09-07 — v0.1.0 tagged (MVP release)

- `v0.1.0` annotated tag + GitHub Release cut on `main` @ `df65152` with full
  CI green — every `service` matrix job **and** the `acceptance (U1-U13 e2e)`
  job passing.
- Two CI fixes landed to get there (`df65152`): the `acceptance` job now
  migrates each service schema from the runner host before the app containers
  boot (the old step exec'd into containers still crash-looping on the missing
  schema) and fails loudly if a service never reaches `/readyz`; the `inventory`
  concurrency spec drives its stock-in barrage through the service layer
  instead of 25 parallel supertest sockets (intermittent `ECONNRESET`).
- Remaining release-checklist items are target-environment work for the deploy
  operator: secrets present + matching across Kong and every service, Kong
  `cors` origins pinned off `['*']` (security-review finding 1), images rolled,
  `prisma migrate deploy` per service, `/readyz` green, and
  `infra/acceptance-smoke.sh` against the deployed edge.

## 2026-09-07 — Phase 06 acceptance verified: MVP green

Full acceptance gate re-run on `main` at `6451933`, all pass:

- Backend test sweep (per service, serial): identity 8, tenancy 33, catalog 46,
  inventory 62, sales 48, winger 37, notifications 37, contracts 13,
  nest-common 22, testing 5 — all green. (`pnpm -r test` on the shared local
  Postgres still shows the documented pool-contention flake when the compose
  stack is also attached to `pos_dev`; each suite is green in isolation and the
  CI `service` matrix runs a dedicated DB per service.)
- `node scripts/check-contracts-compat.mjs HEAD` → OK.
- `python3 .agents/workflows/workflow-contract/scripts/validate_workflow.py` →
  `WORKFLOW:ok`.
- `kong config parse infra/kong/kong.yml` (with the `pos-internal-context`
  plugin mounted, as CI does) → `parse successful`.
- `kubectl kustomize infra/k8s/base` → renders clean.
- Live smokes through the local Kong edge: `infra/acceptance-smoke.sh` → all
  stories passed (U1/U4/U5/U8/U10–U12/U13); `infra/rate-limit-smoke.sh` → PASS;
  `infra/restore-drill.sh` → PASS.
- `pnpm --filter web lint` + `build` → clean. `flutter analyze` → no issues;
  `flutter test` → 15/15 pass.

Next: cut the release per `docs/ops/release-checklist.md`, then work the backlog.

## 2026-09-07 — Phase 06 complete: MVP ready (T-0501–T-0509)

- **T-0501** `tenancy` staff invitations (create/list/revoke/accept; opaque
  token, sha-256 stored, 7-day expiry, `410` on expired/used/revoked;
  `InvitationCreated` + en/sw `invitation` email). Unblocks U2, U3. Live smoke
  through Kong.
- **T-0502** `tenancy` control-plane `/v1/admin/*` (operator audience) +
  `support_access_grant` + `audit_log`; Owner approve (24h server cap) / revoke;
  an operator read of tenant data works **only** under an active grant and writes
  an `audit_log` row; no grant → `403 operator_data_access_denied`. Unblocks U13.
  Live smoke.
- **T-0503** cross-tenant isolation suite — `services/*/isolation.e2e-spec.ts`
  over every `/v1/businesses/{id}/*` route (wrong-business / operator / roleless
  → `403`; positive control) + `/v1/winger/*` (non-/suspended winger → `403`).
  `acceptance-map.md` (U1–U13 → test).
- **T-0504** RLS-only backstop — `services/*/rls-backstop.e2e-spec.ts`: strict
  tables read 0 rows unscoped / foreign; relaxed-read tables documented; every
  cross-tenant write rejected. `rls-policy-matrix.md`. No migration needed.
- **T-0505** concurrency test **found + fixed a real bug** — `inventory`
  read-modify-write on `stock_item.quantity` had no row lock (25 concurrent
  reservations succeeded against on_hand 10). Fix: `lockItems` (`SELECT … FOR
  UPDATE`) at the top of `recordMovement` / `reserve` / `commit` / `reverseSale`.
- **T-0506** edge rate limiting — `receipt-public` 120/min added, `auth-public`
  60/min confirmed; `request-size-limiting` 10 → 12 MB; `infra/rate-limit-smoke.sh`.
  (Same turn: product image cap 5 → 10 MB + friendly `image_too_large` /
  `unsupported_image_type` errors; multi-image gallery → backlog.)
- **T-0507** per-business export — web route `GET /settings/export` (Owner-gated,
  fans out tenant-scoped reads); `docs/ops/backup-restore-runbook.md` +
  `infra/restore-drill.sh` (PASS: roles non-superuser, FORCE RLS intact,
  scoped-role unscoped read = 0 post-restore).
- **T-0508** observability — `@pos/nest-common` structured request logs
  (`{ request_id, business_id, … }`) + an injectable `ErrorReporter` hook (no-op
  default) on `AllExceptionsFilter`; health probes audited.
- **T-0509** `docs/ops/release-checklist.md` + `docs/ops/runbook.md` +
  `docs/ops/security-review-2026-09.md` (**no open high/critical**; 1 medium
  prod-config CORS pin, 5 low hardening → backlog); `infra/acceptance-smoke.sh`
  (U1/U4/U5/U8/U10-U12/U13 through Kong — PASS) + a CI `acceptance` job wiring
  the acceptance + rate-limit + restore smokes.
- **MVP ready**: Phases 00–06 done; U1–U13 have passing automated tests in CI
  (`service` matrix + `acceptance` job). Next: cut the release per the checklist,
  then the backlog.

## 2026-09-07 — Phase 06 planned: hardening + MVP acceptance (T-0501–T-0509)

- Discovery: two PRD-acceptance features are **designed but unbuilt** —
  staff invitations (`tenancy`, U2/U3) and the operator control-plane +
  break-glass (`/v1/admin/*`, `support_access_grant`, `audit_log`, U13). Their
  HTTP shapes + data-model columns were already in `docs/design/`; only a
  service-owner gap-fill was needed.
- **Design gap-fill** (`docs(design):`): `tenancy` owns `support_access_grant` +
  `audit_log`, serves `/v1/admin/*` (audience `operator`) + the Owner
  support-grant routes, caps grants at 24h, and writes the `audit_log` row on
  each operator read under a grant (`service-decomposition.md`,
  `multi-tenancy.md`).
- **`phase-06-hardening.md`** re-scoped (Last updated 2026-09-07): 9 tasks, an
  expanded acceptance list, gap-fill notes.
- **Task docs**: T-0501 `tenancy` staff invitations (+ `invitation` email);
  T-0502 control-plane `/v1/admin/*` + `support_access_grant` + `audit_log` +
  Owner approve/revoke + 24h cap; T-0503 cross-tenant isolation suite over every
  data-plane route (CI); T-0504 RLS-only backstop test (app filter bypassed);
  T-0505 concurrency / no-lost-update test on `on_hand`; T-0506 rate limiting on
  `/v1/r/{token}` + `/v1/auth/*` + a 429 test; T-0507 per-business export
  endpoint + backup/restore runbook; T-0508 observability (`request_id` +
  `business_id` in logs, health/uptime, error hook); T-0509 release checklist +
  ops runbook + `/security-review` + U1–U13 CI matrix.
- `backlog.md`: invitations + operator control-plane marked scheduled into
  Phase 06; "expand phase checklists into task docs" closed.
- Validator `WORKFLOW:ok`. No code yet — build starts at T-0501.

## 2026-09-07 — Phase 05 complete: winger portal (T-0401–T-0407)

- **T-0401** `services/winger` scaffolded from `sales` (schema `winger`, role
  `winger_app`); `winger_account` + `winger_catalog_projection` + forced RLS;
  `@pos/contracts` `SUBJECTS.winger` + `wingerAuthorizedPayload` /
  `wingerSuspendedPayload`; `SCHEMA_VERSION` 1.1.0 → 1.2.0; compose + k8s + CI.
- **T-0402** Owner `POST/GET/PATCH /v1/businesses/{id}/winger-accounts`
  (Owner-only); `identity.getUser { create }` provisions a passwordless shell
  user; `tenancy.resolveMembership` → `409` member/winger mutual exclusion;
  `WingerAuthorized` / `WingerSuspended` via the outbox; Kong
  `winger-accounts-tenant` route. Live smoke through Kong.
- **T-0403** `CatalogProjectionConsumer` rebuilds `winger_catalog_projection`
  from `ProductUpserted` / `PriceChanged` / `ProductDeactivated` /
  `StockLevelChanged` (idempotent + DLQ each); `image_url` added to
  `ProductUpserted`; `catalog` emits it on image change.
- **T-0404** `GET /v1/winger/businesses` + `GET
  /v1/winger/businesses/{id}/products` (whitelist `{ name, image_url, price,
  currency, in_stock }`, `price = winger_price ?? sell_price`, `in_stock =
  on_hand > 0`); `WingerUserGuard`; `403 winger_scope_denied` for
  non-authorized / suspended; `winger_business` projection + relaxed
  `winger_account` read RLS for the cross-tenant businesses list; Kong
  `winger-portal` route (`require_business_scope: false`). Live smoke.
- **T-0405** web `/wingers` — authorize (email/phone), list, suspend/reactivate;
  per-product winger price + image upload already live on `/catalog`.
- **T-0406** mobile winger-only app: `WingerProvider` + catalog screen +
  business switcher; `SessionStatus.winger` (probes `/v1/winger/businesses`);
  router forces a winger session to `/winger` only. `flutter analyze` clean,
  `flutter test` 15.
- **T-0407** `notifications` `WingerAuthorizedConsumer` → `notification` row →
  transactional `winger_authorized` email, en/sw; `skipped` when no email;
  idempotent on `event_id` + `winger_account_id`. `vitest` `fileParallelism:
  false` for the shared-schema e2e specs.
- **Design gap-fills** folded in (`data-model`, `events-catalog`, `internal-rpc`,
  `service-decomposition`, `api-contract`) — all consistent with existing truth.
- Backend suites green: contracts 12, nest-common 16, testing 5, identity 8,
  tenancy 9, catalog 11, inventory 24, sales 20, winger 24, notifications 27;
  web lint+build; mobile analyze+test 15; `check-contracts-compat` OK; kong
  parse + kustomize + compose config OK; validator `WORKFLOW:ok`.
- **Phase 05 done.** Next: Phase 06 — hardening and MVP acceptance.

## 2026-09-07 — Phase 05 planned: winger portal task docs T-0401–T-0407

- **Design gap-fills** (`docs(design):`): `winger_catalog_projection` columns in
  `data-model.md`; `image_url?` on `ProductUpserted` (`events-catalog.md`);
  `identity.getUser` gains `create?` and `winger` calls `tenancy.resolveMembership`
  (`internal-rpc.md` + `service-decomposition.md`); `/v1/winger/*` authorized in
  the `winger` service, not by Kong membership (`api-contract.md`). All consistent
  with existing data-model/events truth — no proposal needed.
- **`phase-05-winger-portal.md`** re-scoped (Last updated 2026-09-07): 7 tasks,
  10 acceptance criteria, gap-fill notes recorded.
- **Task docs**: T-0401 `winger` service scaffold + `winger_account` +
  `winger_catalog_projection` + winger contracts; T-0402 Owner winger-account
  endpoints + `identity.getUser { create }` + member/winger mutual exclusion +
  `WingerAuthorized`/`WingerSuspended`; T-0403 projection consumers +
  `image_url` on `ProductUpserted` (catalog emits on image change); T-0404
  winger catalog endpoints + whitelist DTO + scope/suspension `403` + Kong
  `/v1/winger/*` route; T-0405 web `/wingers` (authorize, suspend, winger price,
  image upload); T-0406 mobile winger catalog + business switcher (restricted
  routing); T-0407 `notifications` `WingerAuthorized` consumer + `winger_authorized`
  en/sw email.
- Backlog note added: `identity` resolve-or-create user RPC also serves the
  future `tenancy` invitations flow.
- Validator `WORKFLOW:ok`. No code yet — build starts at T-0401.

## 2026-09-07 — T-0307/08/09 done: sales clients — Phase 04 complete

- **T-0307 mobile sell flow** (`main` `970ad1b`): `sale_models.dart`,
  `sales_service.dart` (`createSale` sets `Idempotency-Key`; `ApiClient.post`
  gained a `headers` param). `SellProvider` — cart + live totals (line total
  ≥ 0), one idempotency key per cart version held across retries; `submit()` →
  `422 insufficient_stock` marks the short lines, keeps the cart.
  `sell_screen.dart` replaces the stub (picker + `NeuStepper` rows + total bar +
  Complete button + `ErrorByCodeCard`). Offline banner scoped out (no
  connectivity provider in `mobile/` yet — backlog).
- **T-0308 mobile receipt** (`main` `032159d`): `qr_flutter` + `share_plus`;
  `lib/core/receipt_url.dart` (`$kApiBaseUrl/v1/r/{token}`); `receipt_screen.dart`
  (total, lines, `QrImageView`, link, Share / New-sale) + `AppRoute.receipt`;
  sell-flow success now pushes the receipt route.
- **T-0309 web sales screens**: `/sales` list (table + status badge + cursor
  "Load more" + empty state), `/sales/[id]` detail (line table + totals +
  "View public receipt ↗" + Owner-only `<VoidSaleButton>` with a `confirm`),
  `sales/actions.ts` `voidSale`. `web/lib/models.ts` sale types.
- Evidence: `flutter analyze` clean, `flutter test` green (mobile);
  `pnpm --filter web lint` + `build` green; **live smoke through Kong** (rebuilt
  `sales` container): `POST /sales` → `GET /sales` → `GET /sales/{id}` →
  `GET /v1/r/{token}` → `POST .../void` → `GET /v1/r/{token}` `404`. Validator
  `WORKFLOW:ok`.
- **Phase 04 done** — T-0301–T-0309 complete; `phase-04` + `project.md` updated.
  Next priority: Phase 05 (Winger portal).

## 2026-09-07 — T-0306 done: sales list + detail with role scoping

- `sales`: `GET /businesses/:id/sales` + `GET .../:id` (Owner/Staff). Staff
  `where.soldBy = <their user_id>`; Owner sees all. Newest-first cursor
  pagination on the time-ordered `id`. `getSale` → `404` when missing or a
  Staff reads another user's sale (never `403`). Summary vs full (`toSaleView`)
  mappers.
- Tests: +4 in `sales.e2e-spec.ts` — Owner-all vs Staff-own list; cursor paging;
  Staff detail own `200` / other `404`; Owner any + unknown `404` + cross-tenant
  `404`. sales → 20; backend suites green (contracts 10 … sales 20,
  notifications 22); contracts-compat OK; validator `WORKFLOW:ok`.
- Backend for Phase 04 is complete (T-0301–T-0306). Next: T-0307 (mobile sell
  flow), T-0308 (mobile receipt), T-0309 (web sales screens).

## 2026-09-07 — T-0305 done: public receipt endpoint

- `sales`: `GET /v1/r/:token` (`ReceiptController`, no guards). `publicReceipt`
  does an unscoped `receipt` lookup by `public_token`; `null`/`void` → `404`.
  Payload = snapshots only (number, business name, lines, totals) — no `*_id`.
- Migration `20260907140000_public_receipt_read`: relax the RLS *read* path on
  `receipt` / `sale` / `sale_line` for an unscoped public context; writes stay
  strictly scoped.
- Kong: `~/v1/r/[^/]+` route on `sales` **without** `pos-internal-context`
  (`kong.yml` + `kong-config.yaml`).
- Tests: +3 in `sales.e2e-spec.ts` — no-auth `200` + no internal IDs; unknown →
  `404`; voided → `404`. sales → 16; `kong config parse` OK; backend suites
  green; validator `WORKFLOW:ok`.
- Next: T-0306 (`GET /sales` + `/sales/{id}`, Owner-all / Staff-own).

## 2026-09-07 — T-0304 done: sale void + inventory reversal

- `sales`: `POST /sales/:id/void` (Owner) → `voidSale` in one tenant txn:
  `404`/already-voided `200`/`409` else set `sale.voided` + `voidedAt`,
  `receipt.void`, emit `SaleVoided` (lines from `sale_line`).
- `inventory`: `StockService.reverseSale` (one `void_reversal` movement per line,
  on-hand back up via the existing `applyToItem` path) + `SaleVoidedConsumer`
  (`runIdempotent` on `event_id`, DLQ), registered in `StockModule`. No change
  to existing movement/edge logic.
- Tests: sales +4 (void/role/404/re-void), inventory +1 (reversal restores
  pre-sale on-hand, idempotent). sales → 13, inventory → 24; backend suites
  green; contracts-compat OK; validator `WORKFLOW:ok`.
- Next: T-0305 (public `GET /v1/r/{token}`).

## 2026-09-07 — T-0303 done: sales insufficient-stock path

- `reserveStock` `{ ok: false }` → `422 insufficient_stock` with per-shortfall
  `details` (`<product_id>: requested <n>, available <m>`), thrown before the
  write txn; no `releaseReservation` (inventory holds nothing on a shortfall).
- Tests: +2 in `sales.e2e-spec.ts` — full shortfall and a one-line-short
  multi-line cart, each asserting `422`, zero `sale_line` rows, unchanged
  `SaleCompleted` outbox, no release. `sales` suite → 9; backend green;
  contracts-compat OK; validator `WORKFLOW:ok`.
- Next: T-0304 (void + `inventory` `SaleVoided` consumer).

## 2026-09-07 — T-0302 done: POST /sales reserve→write→commit saga

- `sales`: `InventoryClient` (RPC to `reserveStock`/`commitReservation`/
  `releaseReservation`, 3s timeout → `503 upstream_unavailable`).
  `SalesController` `POST /businesses/:id/sales` (Owner/Staff, `Idempotency-Key`).
  `SalesService.createSale`: idempotency replay → resolve line snapshots
  (request else `product_cache`, else `400`) → `reserveStock` → one tenant txn
  (allocate `number` from `sale_number_counter`, write `sale`/`sale_line`/
  `receipt` + `SaleCompleted` outbox) → `commitReservation` (event is the
  backstop). Txn failure → `releaseReservation` once; P2002 on the idem key →
  release + return the winner.
- `ProductCacheConsumer` (`ProductUpserted`/`PriceChanged`) + `BusinessCacheConsumer`
  (`BusinessCreated` → new `sales_business` table, migration
  `20260907130000_sales_business`). Idempotent, DLQ.
- Kong: `~/v1/businesses/[^/]+/sales` → `sales` service (with internal-context)
  in `kong.yml` + `kong-config.yaml`; compose `kong depends_on: sales`.
- Tests: `sales.e2e-spec.ts` (7): complete sale + totals + number sequence +
  receipt + one `SaleCompleted`; idempotent replay; `400` unpriced line;
  reserve-unavailable → no rows / no release; txn failure → one release.
  Backend suites green (contracts 10 … sales 7, notifications 22); `kong config
  parse` OK; `docker compose config` valid; contracts-compat OK; validator
  `WORKFLOW:ok`.
- Next: T-0303 (`422 insufficient_stock` shortfall shaping) and T-0304 (void +
  `inventory` `SaleVoided` consumer).

## 2026-09-07 — T-0301 done: sales service scaffold

- New `services/sales` (Nest + `@pos/nest-common`, Prisma on the `sales`
  schema, `OutboxRelayService`, `/healthz` + `/readyz`, Dockerfile). Init
  migration `20260907120000_init`: `sale`, `sale_line`, `receipt`,
  `sale_number_counter`, `product_cache`, `outbox`, `processed_events`; forced
  RLS on the five tenant tables.
- `@pos/contracts` (additive): `SUBJECTS.sales.*`, `saleCompletedPayload`
  (`reservation_id` + `lines`), `saleVoidedPayload` (`lines`).
- infra: compose `sales` service, `k8s/base/sales.yaml` (Deployment + Service +
  HPA + PDB), kustomization + secret example, CI matrix entry, `SALES_PORT`.
- Tests: `scaffold.e2e-spec.ts` (2 — health + RLS). Backend suites green
  (contracts 10 … sales 2, notifications 22); contracts-compat OK; `docker
  compose config` valid; validator `WORKFLOW:ok`.
- Next: T-0302 (`POST /sales` reserve→write→commit saga).

## 2026-09-07 — Phase 04 planned: sales + digital receipts task docs

Thinking pass — no service code.

- `phase-04-sales-and-receipts.md` re-scoped to the reserve → write → commit
  saga (stock movements written by `inventory` on commit / on `SaleVoided`,
  never by `sales`).
- Design gap-fills adopted (consistent with data-model + events-catalog, not
  net-new behavior):
  - `service-decomposition.md`: `sales` owns `product_cache`; consumes
    `ProductUpserted` / `PriceChanged` / `BusinessCreated`. `inventory` consumes
    `SaleVoided` (writes `void_reversal` movements).
  - `events-catalog.md`: `SaleCompleted` carries `reservation_id` + `lines`
    (`product_id`, `quantity`); `SaleVoided` carries `lines`.
  - `data-model.md`: `sale_number_counter`, `product_cache`, `receipt`
    `business_name_snapshot` + `currency`.
- Task docs T-0301–T-0309 written, all `pending`:
  - T-0301 `sales` scaffold + models + `SaleCompleted`/`SaleVoided` contracts
  - T-0302 `POST /sales` reserve→write→commit saga + `Idempotency-Key` +
    `product_cache` consumers
  - T-0303 insufficient-stock path (`422`, no partial writes)
  - T-0304 void handler + `inventory` `SaleVoided` consumer (`void_reversal`)
  - T-0305 public `GET /v1/r/{token}` (no internal-context plugin)
  - T-0306 `GET /sales` + `/sales/{id}` Owner-all / Staff-own
  - T-0307 mobile sell flow + `422` handling
  - T-0308 mobile receipt screen (link + QR + share)
  - T-0309 web sales list / detail / void
  - Chain: T-0301 → T-0302 → {T-0303, T-0304, T-0305, T-0306};
    T-0307 after T-0302/03; T-0308 after T-0305/07; T-0309 after T-0304/06.
- Validator `WORKFLOW:ok`.

## 2026-09-06 — T-0207 done: web /alerts screen — Phase 03 complete

- `web/app/(shell)/alerts/` — Owner-only page (`getSession` → `<Forbidden />`
  for Staff, same pattern as `settings`/`members`), server `GET /alert-config`
  via `tenant-api` (→ `<ErrorCard>` on failure), `saveAlertConfig` server action
  (`PUT`, mirrors API validation, `ApiError` → error state,
  `revalidatePath`). `AlertConfigForm` client component: add/remove recipient
  rows, `min_interval_hours`, client-guard before round-trip, "empty ⇒ all
  Owners" helper — neumorphic primitives only. `loading.tsx` skeleton;
  `AlertConfig` type in `lib/models.ts`.
- `pnpm --filter web lint` + `build` green; no color/radius/shadow literals in
  the new files.
- Live smoke through Kong (`:8000`): `GET` fresh → `{recipients:[],
  min_interval_hours:24}`; `PUT {recipients:["ops@shop.co.tz"],
  min_interval_hours:6}` → echoes; follow-up `GET` persisted; `PUT {…:0}` →
  `400 validation_error`. (Needed a local `inventory` image rebuild + Kong
  reload — running containers predated T-0201.)
- **Phase 03 done** — T-0201–T-0207 complete; `phase-03` + `project.md`
  updated; next priority is Phase 04 (Sales + digital receipts).

## 2026-09-06 — T-0206 done: localized low-stock templates

- `notifications/src/templates/`: `TemplateRegistry.render('low_stock', locale,
  vars)` → `{subject,text,html}`. en/sw copy in per-locale modules (no `if
  locale` branching); unknown locale → en. `vars = {business_name, catalog_url,
  items:[{product_name,on_hand,threshold}]}` (1 item = single, many = digest).
- New `notification_business` projection (migration
  `20260906170000_notification_business`, no RLS) fed by the existing
  `BusinessCreated` consumer — supplies business name + locale.
- `DigestFlushJob` renders via the registry (no inline strings).
  `product_name` is still `product_id` (same T-0204 follow-up).
- Design: `notification_business` in `data-model.md` /
  `service-decomposition.md`; localization section rewritten.
- Tests: `template-registry.spec.ts` (5) + a Swahili digest integration check.
  notifications 22; backend suites green; contracts-compat OK; validator
  `WORKFLOW:ok`.
- Next: T-0207 (web Owner-only `/alerts`).

## 2026-09-06 — T-0205 done: low-stock digest batching

- `inventory` `PUT /alert-config` now emits `AlertConfigChanged`
  (`min_interval_hours`, `recipients`) via the outbox — `@pos/contracts` gains
  the payload + subject (additive).
- `notifications/src/digest/`: `DigestConfigConsumer` projects it into
  `digest_config` (migration `20260906160000_digest_config`, no RLS).
  `DigestFlushJob.tick(now?)` groups `queued` low_stock by business, sends **one
  digest per due window** (`now - oldest_queued >= min_interval_hours`), claims
  rows atomically (`queued → sending` in a tenant tx) so concurrent flushes send
  once, emits `NotificationSent` per row. Failure → rows back to `queued`
  `attempts++`, terminal `failed` + `NotificationFailed` at 3.
- T-0204's per-row `SendWorker` removed — `DigestFlushJob` owns the low_stock
  send lifecycle now.
- Design adopted: `AlertConfigChanged` + `digest_config` into
  `events-catalog.md` / `service-decomposition.md` / `data-model.md`;
  digest section rewritten in `integrations/notifications.md`.
- Tests: `low-stock.e2e-spec.ts` digest suite (11 total in file); inventory 23.
  Backend suites green (contracts 9 … notifications 16); contracts-compat OK;
  validator `WORKFLOW:ok`.
- Next: T-0206 (en/sw templates) then T-0207 (web `/alerts`).

## 2026-09-06 — T-0204 done: low-stock consumer + email send worker

- `@pos/contracts` v1.1: `NotificationSent` / `NotificationFailed` payloads +
  `SUBJECTS.notifications.*`.
- `notifications/src/email/`: `EmailSender` interface + `SmtpEmailSender`
  (nodemailer → Mailpit) + `CaptureEmailSender`; `EmailModule` picks impl from
  `EMAIL_PROVIDER` (config-only swap).
- `LowStockConsumer` turns `StockFellBelowThreshold` / `StockRecovered` into
  `queued` / `superseded` `low_stock` notifications — idempotent on `event_id`,
  deduped on `dedupe_key = low_stock:{b}:{p}:{opened_at}`. Recipients = event
  list (emails, or uuids via the contact projection) else active-owner emails.
- `SendWorker.tick()` drains `queued` + retryable `failed` (`attempts < 3`),
  sends via `EmailSender`, sets `sent`/`failed`, emits
  `NotificationSent`/`NotificationFailed` via the outbox. Prod runs it on a
  timer (`SEND_WORKER_POLL_MS`).
- Migration `20260906150000_notification_worker_rls`: relax the `notification`
  RLS *read* path so the unscoped worker scans all tenants; *writes* stay
  strictly scoped.
- MVP email references the product by `product_id` + `WEB_BASE_URL/catalog/{id}`
  deep link — no `catalog` call (product-name projection is a follow-up).
- Tests: `low-stock.e2e-spec.ts` (7). Backend suites green (…, notifications 12);
  contracts-compat OK; `docker compose config` valid; validator `WORKFLOW:ok`.
- Next: T-0205 (digest batching within `min_interval_hours`).

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
