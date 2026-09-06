# Data Model — MVP

## Context

- PostgreSQL + Prisma. Every tenant-owned table has `business_id uuid not null` and an RLS policy.
- On-hand stock is derived from the `stock_movement` ledger; a cached `stock_item.quantity` is maintained in the same transaction.
- IDs are UUID v7. Timestamps are `timestamptz`. Money stored as integer minor units (TZS has no minor unit → store whole TZS as integer) plus a `currency` field.

## Requirements

### Entities

#### Global (not tenant-owned)

| Table | Key fields |
|---|---|
| `user` | id, name, email (unique, nullable), phone (unique, nullable), password_hash, locale, created_at, disabled_at |
| `operator` | id, name, email (unique), password_hash, created_at, disabled_at |
| `refresh_token` | id, token_hash (unique, sha-256 of the opaque token), subject_type (`user`\|`operator`), subject_id, family_id (rotation chain), issued_at, expires_at, rotated_at (nullable), revoked_at (nullable), replaced_by_id (nullable), user_agent (nullable) |

`refresh_token` rotation: each `/auth/refresh` marks the presented row `rotated_at` and issues a new row in the same `family_id`. Presenting a token that is already `rotated_at` or `revoked_at` is treated as reuse: the whole `family_id` is revoked and the request is rejected. `/auth/logout` revokes the presented token's family. Access tokens are short-lived JWTs and are not stored.

#### Tenant-owned

| Table | Key fields | Notes |
|---|---|---|
| `business` | id, name, country, currency, locale, timezone, subscription_status, created_at | tenant root; RLS on `id` |
| `membership` | id, business_id, user_id, role (`owner`\|`staff`), status (`active`\|`suspended`), invited_by, joined_at | unique (business_id, user_id); FK to `user` |
| `invitation` | id, business_id, role, email, token_hash, status (`pending`\|`accepted`\|`revoked`\|`expired`), expires_at, created_by, created_at | |
| `category` | id, business_id, name | unique (business_id, name) |
| `product` | id, business_id, sku, name, description, category_id, unit, image_url, cost_price, sell_price, winger_price (nullable), reorder_threshold (default 0), code (QR/barcode, nullable), is_active, created_at, updated_at | unique (business_id, sku); unique (business_id, code) |
| `stock_item` | id, business_id, product_id, location_id (nullable), quantity | one row per product in MVP; cached on-hand |
| `stock_movement` | id, business_id, product_id, type (`stock_in`\|`adjustment`\|`sale`\|`return`\|`void_reversal`), quantity_delta (signed), reason, reference_type, reference_id, created_by, created_at | append-only ledger |
| `sale` | id, business_id, number (per-business sequence — allocated from `sale_number_counter` in the sale txn), status (`completed`\|`voided`), subtotal, discount_total, total, currency, sold_by, customer_label (nullable), created_at, voided_at | |
| `sale_number_counter` | business_id (pk), next_number | `sales` schema; row-locked (`SELECT … FOR UPDATE`) inside the sale transaction |
| `sale_line` | id, sale_id, business_id, product_id, name_snapshot, unit_price_snapshot, quantity, discount, line_total | |
| `receipt` | id, business_id, sale_id, public_token (unique), business_name_snapshot, currency, status (`issued`\|`void`), issued_at | token is unguessable (≥128-bit); `/r/{token}` needs no auth so the name is snapshotted, not joined |
| `product_cache` | business_id, product_id, name, sell_price, currency | `sales` schema; read-only projection from `ProductUpserted` / `PriceChanged`; fills line snapshots when the client omits `unit_price` |
| `winger_account` | id, business_id, user_id, status (`active`\|`suspended`), authorized_by, created_at | unique (business_id, user_id); a user row here has no `membership` |
| `alert_config` | id, business_id, recipients (json: user_ids or emails), min_interval_hours (default 24) | one per business; defaults to all owners |
| `notification` | id, business_id, type (`low_stock`\|`invitation`\|`winger_authorized`), channel (`email`), payload (json), status (`queued`\|`sent`\|`failed`), dedupe_key (nullable), attempts (default 0), last_error (nullable), created_at, sent_at | `notifications` schema |
| `notification_contact` | id, business_id, user_id, role (`owner`\|`staff`), email, locale, active (bool) | `notifications` schema; read-only projection from `BusinessCreated` / `MembershipCreated` / `MembershipSuspended`; unique (business_id, user_id) |
| `digest_config` | business_id (pk), min_interval_hours, recipients (json) | `notifications` schema; read-only projection from `AlertConfigChanged`; drives the low-stock digest cadence (no RLS — internal worker config) |
| `notification_business` | business_id (pk), name, locale | `notifications` schema; read-only projection from `BusinessCreated`; supplies the business name + locale for email rendering (no RLS) |
| `low_stock_alert_state` | id, business_id, product_id, is_open (bool), opened_at, closed_at | `inventory` schema; one per product; source of truth for the low-stock edge (supersedes any `stock_item` flag) |
| `audit_log` | id, business_id (nullable for control-plane), actor_id, actor_type (`user`\|`operator`\|`system`), action, target_type, target_id, metadata (json), created_at | |
| `support_access_grant` | id, business_id, operator_id, reason, approved_by (owner user_id), granted_at, expires_at, revoked_at | max lifetime 24h |

### Relationships

- `business` 1–N `membership`, `product`, `sale`, `winger_account`, ...
- `product` 1–1 `stock_item` (MVP), 1–N `stock_movement`, 1–N `sale_line`.
- `sale` 1–N `sale_line`, 1–1 `receipt`.
- `user` N–N `business` via `membership`; `user` 1–N `winger_account`.

### Invariants

- `stock_item.quantity == sum(stock_movement.quantity_delta)` for that product, always, enforced in-transaction.
- A completed `sale` has ≥1 `sale_line`; `total == sum(line_total) - discount_total` and `total >= 0`.
- Voiding a `sale`: insert `void_reversal` movements equal and opposite to the sale movements; set `receipt.status = void`.
- `winger_price` when null resolves to `sell_price` at read time.
- A `user` cannot have both a `membership` and a `winger_account` in the same `business`.
- `low_stock_alert_state.is_open` flips true when on-hand ≤ threshold, false when on-hand > threshold; email sent only on the false→true edge.

### Indexes

- `product (business_id, is_active)`, `product (business_id, code)`, `product (business_id, sku)`.
- `stock_movement (business_id, product_id, created_at)`.
- `sale (business_id, created_at)`, `receipt (public_token)`.
- `membership (user_id)`, `winger_account (user_id)`.

## Decisions

- Cached `stock_item.quantity` alongside the ledger for read speed; ledger is source of truth.
- Money as integer minor units + explicit currency, even though TZS is effectively integer, to keep the model portable.
- `low_stock_alert_state` table rather than scanning notifications for dedupe.
- `opened_at` from `low_stock_alert_state` is carried on `StockFellBelowThreshold` /
  `StockRecovered` and forms `notification.dedupe_key = low_stock:{business_id}:{product_id}:{opened_at}`.
- `notifications` cannot read `tenancy` tables; it resolves recipients from its own
  `notification_contact` projection (default `low_stock` recipients = active owners)
  unless `alert_config.recipients` is set, in which case `inventory` passes the
  explicit list on the event.

## Contracts

- Prisma schema mirrors this doc. Any change here precedes a migration.
- All tenant tables get an RLS policy in the same migration that creates them, via the `enable_tenant_rls('<table>' [, '<tenant_col>'])` SQL helper (defined in migration `20260901201947_tenancy_business_membership`; defaults the column to `business_id`).

## Acceptance Criteria

- Migration creates every table above with `business_id` + RLS on tenant tables.
- Invariant tests: ledger sum equals cached quantity after randomized movement sequences.
- Void test: post-void on-hand equals pre-sale on-hand for every line.
