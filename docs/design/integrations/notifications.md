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

- Fire only on the transition into the low state (`low_stock_alert_state.is_open` false→true).
- While `is_open` stays true, no further emails for that product.
- When on-hand rises above threshold, set `is_open = false`; next dip fires again.
- Respect `alert_config.min_interval_hours` as a per-business floor between any two low-stock emails (batch if multiple products dip within the window).

### Delivery

- `notification` row created `queued` in the same transaction as the triggering event.
- Worker sends via `EmailSender`, sets `sent` or `failed` (+ error), retries `failed` up to 3× with backoff.
- Idempotency: `dedupe_key = low_stock:{business_id}:{product_id}:{opened_at}`.

### Localization

- Template rendered in the business `locale` (en/sw).

## Decisions

- No in-app notification center in MVP; email only.
- Batching for min-interval uses a single digest email listing all products currently low.

## Contracts

- Notification creation is transactional with its trigger; delivery is not.
- `EmailSender` is the only outbound path; no direct SMTP calls in handlers.

## Acceptance Criteria

- Repeated sub-threshold movements produce exactly one `low_stock` notification until on-hand recovers.
- A `failed` send is retried and its final state recorded.
- Email body language matches the business locale in tests for en and sw.
