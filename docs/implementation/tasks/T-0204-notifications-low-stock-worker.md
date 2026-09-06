# T-0204 Notifications — Low-Stock Consumer + Email Worker

## Status

- `pending`
- Last updated: 2026-09-06

## Linked Phase

- Phase 03 — Reorder Alerts

## Agent Context

- Skills: backend, workflow-contract
- Design docs: `docs/design/integrations/notifications.md` (Low-stock rules, Recipient resolution, Delivery), `docs/design/integrations/README.md` (`EmailSender` interface), `docs/design/interfaces/events-catalog.md` (`StockFellBelowThreshold`, `StockRecovered`, `NotificationSent`/`NotificationFailed`)
- Constraints: `notification` row created in the `notifications` transaction, idempotent on `event_id`, deduped on `dedupe_key = low_stock:{business_id}:{product_id}:{opened_at}`; recipients = event `recipients` when non-empty, else `notification_contact` rows `role='owner' AND active`; `EmailSender.send(template, to, vars)` is the only outbound path (local impl = Mailpit SMTP `:1025`); provider is env config; a `failed` send retries ≤ 3× with backoff, then stays `failed`; emit `NotificationSent` / `NotificationFailed` via the outbox; no direct SMTP in handlers.
- Do not touch: `services/inventory`, `tenancy`, `catalog`, digest flush (T-0205), `web/`, `mobile/`.

## Objective

Consume `StockFellBelowThreshold` / `StockRecovered` in `services/notifications` to create deduped `low_stock` `notification` rows, and add the `EmailSender` adapter + a retry/backoff send worker.

## Scope Boundary

**In scope:**
- `LowStockConsumer`: `StockFellBelowThreshold` → resolve recipients → create one `notification` (`type='low_stock'`, `status='queued'`, `dedupe_key`, `payload` = business/product/on_hand/threshold/catalog URL); idempotent on `event_id`; no-op when `dedupe_key` already exists. `StockRecovered` → mark the matching open digest state closed (row/flag used by T-0205) — no email.
- `EmailSender` interface in `services/notifications/src/email/` + `SmtpEmailSender` (nodemailer to Mailpit) + `email` env config; `NoopEmailSender` for tests capturing sends.
- `SendWorker`: polls `queued` (+ `failed` with `attempts < 3` and backoff elapsed), renders via the template registry (T-0206 provides templates; use a minimal inline `low_stock` template here as the seam), sends, sets `sent` / `failed` (`attempts++`, `last_error`), emits `NotificationSent` / `NotificationFailed`.
- Product/business display data (name, locale) taken from `notification_contact` + the event payload; if product name is not on the event, include `product_id` and resolve name from a lightweight `ProductUpserted` projection or accept `product_id` in the MVP email — **decide and document in the task PR, do not silently call `catalog`**.
- Tests with `@pos/testing` bus + capturing `EmailSender`.

**Out of scope:**
- Digest batching / periodic flush — T-0205.
- Localised template bodies — T-0206 (this task uses a placeholder).
- `invitation` / `winger_authorized` sends.

## Acceptance Criteria

- One `StockFellBelowThreshold` (`opened_at=T`) creates exactly one `notification` with `dedupe_key=low_stock:{b}:{p}:{T}`; a duplicate delivery (same `event_id`) and a same-key event create no second row.
- With `recipients=[]` on the event, the `notification.payload.recipients` equals the emails of `notification_contact` rows where `role='owner' AND active`; with `recipients=["x@y.com"]` it equals that list.
- The `SendWorker` sends via `EmailSender`; on a thrown send it sets `status='failed'`, `attempts=1`, records `last_error`, and retries on the next pass after the backoff; after 3 failed attempts `status` stays `failed` and no further attempts occur.
- A successful send sets `status='sent'`, `sent_at`, and emits `NotificationSent`; a terminal failure emits `NotificationFailed`.
- Swapping `EMAIL_PROVIDER` to the noop/capture impl requires no code change outside `src/email/`.
- `StockRecovered` closes the digest state for that product and sends no email.

## Dependencies

- T-0202, T-0203

## Implementation Checklist

1. `EmailSender` interface + `SmtpEmailSender` + capture impl + env config.
2. `LowStockConsumer` (fell-below → dedupe/create; recovered → close state) + idempotency.
3. Recipient resolver (event list ?? owner projection).
4. `SendWorker` with backoff + `attempts`/`last_error` + `NotificationSent`/`NotificationFailed` outbox.
5. Tests: dedupe, recipient resolution, send success, retry, terminal failure.
6. `pnpm --filter @pos/notifications test`, `pnpm -r build/lint`; validator.

## Verification

- `services/notifications/test/*` covers dedupe, recipient resolution, send success, 3× retry then terminal `failed`, and event emission.
- `pnpm --filter @pos/notifications test` green; `pnpm -r build` green.
- `python3 .agents/workflows/workflow-contract/scripts/validate_workflow.py` → `WORKFLOW:ok`.
