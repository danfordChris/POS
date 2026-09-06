# Notifications

## Context

- MVP channel: transactional email only. All sends are async via the job queue.
- Recipients and rules are per business.

## Requirements

### Events → templates

| Event | Trigger | Recipients | Template vars |
|---|---|---|---|
| `invitation` | Owner invites Staff | invited email | business name, inviter name, accept URL, expiry |
| `winger_authorized` | Owner authorizes a winger | winger email | business name, portal URL |
| `low_stock` | Stock movement drives on-hand ≤ `reorder_threshold` (false→true edge only) | `alert_config.recipients` (default: all active Owners) | business name, product name, on-hand, threshold, catalog URL |

### Low-stock rules

- `inventory` owns the edge: `low_stock_alert_state.is_open` flips false→true when
  on-hand ≤ `reorder_threshold` (threshold > 0, product active), written in the
  same tenant transaction as the movement. `opened_at` is stamped on that edge.
- `inventory` emits `StockFellBelowThreshold` on the false→true edge (carrying
  `opened_at` and `recipients` from `alert_config`) and `StockRecovered` on
  true→false (carrying the matching `opened_at`).
- While `is_open` stays true, no further `StockFellBelowThreshold` for that product.
- `notifications` respects `alert_config.min_interval_hours` as a per-business
  floor between low-stock emails, batching all currently-low products into one
  digest.

### Recipient resolution

- `notifications` keeps `notification_contact` — a read-only projection from
  `BusinessCreated` / `MembershipCreated` / `MembershipSuspended`. It never reads
  `tenancy` tables.
- `low_stock` recipients: `alert_config.recipients` when non-empty (passed on the
  event as `recipients`); otherwise `notification_contact` rows where
  `role = 'owner' AND active`.
- `invitation`: the `InvitationCreated.email`. `winger_authorized`: the
  `WingerAuthorized.email`.

### Delivery

- `inventory` writes the `low_stock_alert_state` edge + the outbox event
  atomically. `notifications` then creates the `notification` row (`status =
  queued`) in its own transaction — idempotent on `event_id`, deduped on
  `dedupe_key`.
- Worker sends via `EmailSender`, sets `sent` or `failed` (+ `last_error`,
  `attempts`), retries `failed` up to 3× with backoff.
- Idempotency: `dedupe_key = low_stock:{business_id}:{product_id}:{opened_at}`.

### Digest flush

- `notifications` runs a periodic flush (interval = min active
  `alert_config.min_interval_hours`, default hourly). Per business with an open
  digest window and ≥1 `queued` low-stock `notification`: send one digest email
  listing every product whose `low_stock_alert_state.is_open` is still true, mark
  those rows `sent`, and stamp the window.
- A lone dip still sends at the next flush; it is not held a full interval when
  the window is already open.

### Localization

- Template rendered in the business `locale` (en/sw).

## Decisions

- No in-app notification center in MVP; email only.
- Batching for min-interval uses a single digest email listing all products currently low.
- `alert_config` + `low_stock_alert_state` live in the `inventory` schema (it owns
  the edge). `notifications` owns only `notification` + `notification_contact`.
- Recipient resolution is projection-based, not a sync call to `tenancy`.

## Contracts

- Edge state + outbox event are atomic on the producer (`inventory`); the
  `notification` row is created exactly-once on the consumer (`notifications`),
  keyed by `event_id` + `dedupe_key`. Delivery (send) is not transactional.
- `EmailSender` is the only outbound path; no direct SMTP calls in handlers.

## Acceptance Criteria

- Repeated sub-threshold movements produce exactly one `low_stock` notification until on-hand recovers.
- A `failed` send is retried and its final state recorded.
- Email body language matches the business locale in tests for en and sw.
