# Phase 03 — Reorder Alerts

## Status

- `pending`
- Last updated: 2026-09-06

## Objective

Send a low-stock email to business alert recipients on the transition into the low state, with dedupe and a per-business interval floor. Stand up the `notifications` service to deliver it.

## Scope

- `inventory`: `alert_config` model + `GET/PUT /v1/businesses/{id}/alert-config` (Owner).
- `inventory`: `low_stock_alert_state` table (replaces the `stock_item.low_stock_open` column) as the low-stock edge source of truth; `opened_at` threaded onto `StockFellBelowThreshold` / `StockRecovered` with `recipients` from `alert_config`.
- `@pos/contracts`: additive payload fields on `StockFellBelowThreshold`, `StockRecovered`, `MembershipCreated`, `BusinessCreated`, `WingerAuthorized` (minor `schema_version` bump).
- `notifications`: new service — `notification` + `notification_contact` schema, contact-projection consumers, low-stock consumer creating deduped `notification` rows, `EmailSender` (Mailpit local), queue worker with retry/backoff, digest flush, en/sw templates.
- Web: `/alerts` screen (alert-config form + recent low-stock notifications).

## Features

- Default recipients = all active Owners when `alert_config.recipients` is empty (resolved from `notification_contact`, not a `tenancy` call).
- Catalog deep link in the email.
- `invitation` / `winger_authorized` email templates are wired by their own phases; Phase 03 builds only the `low_stock` path plus the shared `notifications` foundation.

## Tasks

- [ ] T-0201 `inventory` — `alert_config` model + `GET/PUT /alert-config` (Owner)
- [ ] T-0202 `inventory` — `low_stock_alert_state` table + `opened_at`/`recipients` on the edge events + `@pos/contracts` payload additions
- [ ] T-0203 `notifications` service scaffold + `notification` / `notification_contact` schema + contact-projection consumers
- [ ] T-0204 `notifications` — low-stock consumer (`StockFellBelowThreshold` / `StockRecovered`) → deduped `notification` rows + `EmailSender` + retry/backoff worker
- [ ] T-0205 `notifications` — digest batching within `min_interval_hours` (periodic flush)
- [ ] T-0206 `notifications` — en/sw low-stock templates + `EmailSender` Mailpit capture test
- [ ] T-0207 Web `/alerts` screen

## Acceptance Criteria

- [ ] Repeated sub-threshold movements produce exactly one `low_stock` notification until on-hand rises above threshold.
- [ ] On-hand recovering then dipping again fires a second notification (new `opened_at`, new `dedupe_key`).
- [ ] `failed` send retried up to 3× and final state persisted (`attempts`, `last_error`).
- [ ] Two products dipping within `min_interval_hours` produce one digest email listing both.
- [ ] Email body language matches business locale for en and sw.
- [ ] Removing `notifications` from the local stack leaves every other endpoint working (per service-decomposition acceptance).

## Blockers

- Phase 02 stock ledger `done` (met).
- Design refinements adopted 2026-09-06 into `service-decomposition.md`, `events-catalog.md`, `data-model.md`, `integrations/notifications.md`.

## Linked Tasks

- `docs/implementation/tasks/`
