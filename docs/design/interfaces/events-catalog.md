# Events Catalog

## Context

- Domain events on NATS JetStream. Subject: `pos.evt.<context>.<EventName>`.
- Payload schemas live in `@pos/contracts` (zod). This doc is the human-readable index; the package is authoritative.
- Every event envelope carries: `event_id` (uuid), `occurred_at` (ISO), `business_id` (null only for `identity` events), `producer`, `schema_version`.

## Requirements

### Streams

| Stream | Subjects | Retention |
|---|---|---|
| `IDENTITY` | `pos.evt.identity.>` | limits, 7d |
| `TENANCY` | `pos.evt.tenancy.>` | limits, 30d |
| `CATALOG` | `pos.evt.catalog.>` | limits, 30d |
| `INVENTORY` | `pos.evt.inventory.>` | limits, 30d |
| `SALES` | `pos.evt.sales.>` | limits, 90d |
| `WINGER` | `pos.evt.winger.>` | limits, 30d |
| `NOTIFICATIONS` | `pos.evt.notifications.>` | limits, 7d |

Consumers are durable, per (service, event). Ack policy explicit; max-deliver with a dead-letter subject `pos.dlq.<context>.<EventName>`.

### Event index (MVP)

| Event | Producer | Key payload fields | Consumers |
|---|---|---|---|
| `UserRegistered` | identity | `user_id`, `email?`, `phone?` | tenancy (optional) |
| `BusinessCreated` | tenancy | `business_id`, `name`, `currency`, `locale`, `owner_user_id`, `owner_email`, `owner_locale` | catalog, inventory (bootstrap), notifications (contact projection) |
| `MembershipCreated` | tenancy | `business_id`, `user_id`, `role`, `email`, `locale` | notifications (contact projection) |
| `MembershipSuspended` | tenancy | `business_id`, `user_id` | edge membership-cache bust; notifications (contact projection) |
| `InvitationCreated` | tenancy | `business_id`, `invitation_id`, `email`, `role`, `accept_url`, `expires_at` | notifications |
| `InvitationAccepted` | tenancy | `business_id`, `invitation_id`, `user_id` | — |
| `CategoryUpserted` | catalog | `business_id`, `category_id`, `name` | — |
| `ProductUpserted` | catalog | `business_id`, `product_id`, `sku`, `name`, `unit`, `is_active`, `reorder_threshold` | inventory (seed `stock_item`, low-stock threshold), sales (name cache), winger |
| `PriceChanged` | catalog | `business_id`, `product_id`, `sell_price`, `winger_price?`, `currency` | sales, winger |
| `ProductDeactivated` | catalog | `business_id`, `product_id` | inventory, winger |
| `StockMovementRecorded` | inventory | `business_id`, `product_id`, `type`, `quantity_delta`, `movement_id` | — |
| `StockLevelChanged` | inventory | `business_id`, `product_id`, `on_hand` | winger |
| `AlertConfigChanged` | inventory | `business_id`, `min_interval_hours`, `recipients[]` | notifications (digest cadence projection) |
| `StockFellBelowThreshold` | inventory | `business_id`, `product_id`, `on_hand`, `threshold`, `opened_at`, `recipients[]` (emails/user-ids from `alert_config`; empty ⇒ consumer falls back to owner projection) | notifications |
| `StockRecovered` | inventory | `business_id`, `product_id`, `on_hand`, `opened_at` (value from the matching open edge) | notifications (closes digest state) |
| `SaleCompleted` | sales | `business_id`, `sale_id`, `lines[]`, `total`, `currency` | inventory (commit reservation) |
| `SaleVoided` | sales | `business_id`, `sale_id` | inventory (reverse) |
| `WingerAuthorized` | winger | `business_id`, `winger_account_id`, `user_id`, `portal_url`, `email`, `locale` | notifications |
| `WingerSuspended` | winger | `business_id`, `winger_account_id` | edge membership-cache bust |
| `NotificationSent` / `NotificationFailed` | notifications | `business_id`, `notification_id`, `type`, `channel` | — |

## Decisions

- Events describe facts that already happened; names are past tense.
- Additive schema changes bump `schema_version` minor; breaking changes use a new subject `…V2` with a deprecation window.
- Streams are not partitioned per tenant; handlers scope by `business_id`.

## Contracts

- A producer emits an event only after its local transaction commits (outbox relay).
- Consumers are idempotent on `event_id`.
- No event carries a secret, password hash, or full token.

## Acceptance Criteria

- Each event above has a zod schema + a round-trip test in `@pos/contracts`.
- Each consumer has an idempotency test (same `event_id` twice → one state change).
- A poisoned message lands on the dead-letter subject after max-deliver, not an infinite retry.
