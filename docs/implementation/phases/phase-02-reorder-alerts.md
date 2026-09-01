# Phase 02 — Reorder Alerts

## Status

- `pending`
- Last updated: 2026-09-01

## Objective

Send a low-stock email to business alert recipients on the transition into the low state, with dedupe and a per-business interval floor.

## Scope

- `alert_config` model + `GET/PUT /alert-config` (Owner).
- `low_stock_alert_state` per product; edge detection in the stock movement handler.
- `notification` rows created transactionally with the triggering movement.
- Job queue worker: send via `EmailSender`, retry `failed` 3× with backoff.
- Digest batching when multiple products dip within `min_interval_hours`.
- Localized email templates (en, sw).
- Web: `/alerts` screen.

## Features

- Default recipients = all active Owners when `alert_config.recipients` is empty.
- Catalog deep link in the email.

## Tasks

- [ ] T-0201 `alert_config` model + endpoints
- [ ] T-0202 `low_stock_alert_state` + edge detection in movement handler
- [ ] T-0203 Notification creation (transactional) + `dedupe_key`
- [ ] T-0204 Queue worker + retry/backoff
- [ ] T-0205 Digest batching within interval
- [ ] T-0206 Email templates (en/sw) + `EmailSender` local capture test
- [ ] T-0207 Web `/alerts` screen

## Acceptance Criteria

- [ ] Repeated sub-threshold movements produce exactly one `low_stock` notification until on-hand rises above threshold.
- [ ] On-hand recovering then dipping again fires a second notification.
- [ ] `failed` send retried up to 3× and final state persisted.
- [ ] Two products dipping within `min_interval_hours` produce one digest email listing both.
- [ ] Email body language matches business locale for en and sw.

## Blockers

- Phase 01 stock ledger must be `done`.

## Linked Tasks

- `docs/implementation/tasks/`
