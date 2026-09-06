# T-0205 Notifications — Digest Batching Within `min_interval_hours`

## Status

- `done`
- Last updated: 2026-09-06

## Linked Phase

- Phase 03 — Reorder Alerts

## Agent Context

- Skills: backend, workflow-contract
- Design docs: `docs/design/integrations/notifications.md` (Digest flush, Low-stock rules), `docs/design/data/data-model.md` (`alert_config`, `notification`)
- Constraints: one digest email per business per window, listing every product currently `is_open`; window length = that business's `alert_config.min_interval_hours` (default 24); a lone dip still goes out at the next flush, not held a full interval when the window is already open; flush is time-driven (periodic timer or NATS scheduled message), interval = min active `min_interval_hours` (default hourly); flush work is idempotent and safe to run concurrently on multiple pods (row-level claim or advisory lock); `alert_config` is read via a projection or carried on the event — no sync call to `inventory`.
- Do not touch: `services/inventory` stock/edge/movement logic (the alert-config module MAY gain one additive `AlertConfigChanged` emit), `EmailSender` internals (T-0204), `web/`, `mobile/`.

## Objective

Replace per-event low-stock emails with a per-business digest: batch all currently-low products into one email bounded by `alert_config.min_interval_hours`.

## Scope Boundary

**In scope:**
- `digest_window` state per business (`business_id`, `opened_at`, `flushed_at`, `min_interval_hours`) or equivalent columns on an existing table; opened when the first `queued` low-stock `notification` arrives with no open window.
- `min_interval_hours` projection in `notifications`: consume `alert-config` changes — either an `AlertConfigChanged` event added to `inventory` (additive contract) **or** carry `min_interval_hours` on `StockFellBelowThreshold`. Pick one; record the choice. Default 24 when unknown.
- `DigestFlushJob`: periodic; for each business whose window is due (`now - opened_at >= min_interval_hours` OR first-ever flush), collect its `queued` low-stock notifications whose product is still `is_open`, render one digest via `EmailSender`, mark those rows `sent` (+ `sent_at`), stamp `flushed_at`, close the window when nothing is still open.
- Products that recovered (`StockRecovered`, `is_open=false`) before flush are dropped from the digest and their `notification` row marked `superseded` (new `status` value) — not emailed.
- Concurrency-safe claim so two pods don't double-send.
- Tests with a controllable clock + capture `EmailSender`.

**Out of scope:**
- The single-notification create path — T-0204 (this task changes *when/how* they are sent, not their creation).
- Template bodies — T-0206.

## Acceptance Criteria

- Two products dipping within one business's `min_interval_hours` produce exactly one digest email listing both, sent at the flush.
- A single product dipping produces one digest email at the next flush (≤ `min_interval_hours` later, immediately if the window was already open and due).
- A product that dipped then recovered before the flush does not appear in the digest and its `notification` row is `superseded`, not `sent`.
- After a flush with all products recovered, the window is closed; a later dip opens a new window.
- Running `DigestFlushJob` twice for the same due window sends one email (claim/lock proven by a concurrent-invocation test).
- Changing `alert_config.min_interval_hours` to 1 shortens the window for that business only.

## Dependencies

- T-0204

## Implementation Checklist

1. Decide the `min_interval_hours` propagation mechanism; add the additive contract if needed.
2. `digest_window` state + open-on-first-queued logic.
3. `DigestFlushJob` timer + due-window selection + concurrency claim.
4. Digest assembly (still-open products only) + `EmailSender` send + row status transitions (`sent` / `superseded`).
5. `StockRecovered` path marks pending rows `superseded`.
6. Tests: two-product digest, lone dip, recover-before-flush, window reopen, concurrent flush, per-business interval.
7. `pnpm --filter @pos/notifications test`, `pnpm -r build/lint`; validator.

## Verification

Delivered:

- **`min_interval_hours` propagation**: `inventory`'s `AlertConfigService.put`
  emits `AlertConfigChanged` (`business_id`, `min_interval_hours`, `recipients`)
  via the outbox — one additive event on the alert-config module, no
  stock/edge/movement change. `@pos/contracts` gains
  `alertConfigChangedPayload` + `SUBJECTS.inventory.alertConfigChanged`.
- `notifications/src/digest/`:
  - `DigestConfigConsumer` projects `AlertConfigChanged` into `digest_config`
    (`business_id` pk, `min_interval_hours`, `recipients`; migration
    `20260906160000_digest_config`, no RLS — internal worker config), idempotent
    on `event_id`.
  - `DigestFlushJob.tick(now?)`: groups `queued` low_stock by business, window =
    oldest `created_at`, due when `now - opened_at >= min_interval_hours`
    (`digest_config` else `DIGEST_DEFAULT_INTERVAL_HOURS`). Per due business,
    claims rows atomically (`queued → sending` in one tenant tx), sends one
    digest, marks `sent` + emits `NotificationSent` per row. Send failure →
    rows back to `queued` `attempts++` (terminal `failed` + `NotificationFailed`
    at 3). No recipients → terminal `failed`.
- `SendWorker` (T-0204's per-row sender) removed; `DigestFlushJob` owns the
  `low_stock` send lifecycle. Timer-driven in prod (`DIGEST_POLL_MS`).
- Design adopted: `AlertConfigChanged` + `digest_config` added to
  `events-catalog.md`, `service-decomposition.md`, `data-model.md`; digest-flush
  section rewritten in `integrations/notifications.md`.

Evidence:

- `pnpm --filter @pos/notifications test` → 16 passed (`low-stock.e2e-spec.ts`,
  digest suite): two-product digest at the due flush; not sent before due;
  recovered product dropped + `superseded`; fresh window after a flush;
  concurrent `tick()` race → one email; per-business `min_interval_hours` from
  `AlertConfigChanged` (fast business flushes, slow one waits); 3× retry →
  terminal `failed` + `NotificationFailed`; no-recipients terminal fail.
- `pnpm --filter @pos/inventory test` → 23 (new: `PUT /alert-config` emits
  `AlertConfigChanged`).
- Backend suites green: contracts 9, nest-common 16, testing 5, identity 7,
  tenancy 9, catalog 11, inventory 23, notifications 16.
- `pnpm --filter @pos/{notifications,inventory,contracts} build` + `lint` clean;
  `prettier` + `prisma format` clean;
  `node scripts/check-contracts-compat.mjs HEAD` → OK.
- `python3 .agents/workflows/workflow-contract/scripts/validate_workflow.py` → `WORKFLOW:ok`.
