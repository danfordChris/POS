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
| `sale` | id, business_id, number (per-business sequence — allocated from `sale_number_counter` in the sale txn), status (`completed`\|`voided`), payment_terms (`cash`\|`credit`, default `cash`), customer_id (nullable; required when `credit`), subtotal, discount_total, total, currency, sold_by, customer_label (nullable), created_at, voided_at | |
| `sale_number_counter` | business_id (pk), next_number | `sales` schema; row-locked (`SELECT … FOR UPDATE`) inside the sale transaction |
| `sale_line` | id, sale_id, business_id, product_id, name_snapshot, unit_price_snapshot, quantity, discount, line_total | |
| `receipt` | id, business_id, sale_id, public_token (unique), business_name_snapshot, currency, status (`issued`\|`void`), issued_at | token is unguessable (≥128-bit); `/r/{token}` needs no auth so the name is snapshotted, not joined |
| `customer` | id, business_id, name, phone (nullable), email (nullable), address (nullable), tax_id (nullable), outstanding_balance (default 0), disabled_at (nullable), created_at, updated_at | `sales` schema; `outstanding_balance` = `sum(invoice.balance_due)` over non-void invoices, cached in-txn |
| `invoice` | id, business_id, number (per-business sequence — `invoice_number_counter`), sale_id (nullable), customer_id, status (`draft`\|`issued`\|`partially_paid`\|`paid`\|`void`), currency, subtotal_minor, discount_minor, tax_minor, total_minor, amount_paid_minor, balance_due_minor, issue_date, due_date, public_token (unique), business_name_snapshot, void_reason (nullable), document_url (nullable), document_generated_at (nullable), created_at | `sales` schema; `/i/{token}` needs no auth → name + lines snapshotted |
| `invoice_number_counter` | business_id (pk), next_number | `sales` schema; row-locked inside the issue transaction |
| `invoice_line` | id, invoice_id, business_id, product_id (nullable), description, quantity, unit_price_minor, discount_minor, line_total_minor | snapshot at issue time |
| `payment` | id, business_id, invoice_id, amount_minor, method (`cash`\|`bank_transfer`\|`mobile_money`\|`other`), reference (nullable), received_at, created_by, created_at | `sales` schema; label only, no gateway |
| `document` | id, business_id, kind (`invoice`), ref_id, url, bytes, sha256, created_at | `media` schema; object stored in MinIO/S3; one current row per `(kind, ref_id)` |
| `product_cache` | business_id, product_id, name, sell_price, currency | `sales` schema; read-only projection from `ProductUpserted` / `PriceChanged`; fills line snapshots when the client omits `unit_price` |
| `winger_account` | id, business_id, user_id, status (`active`\|`suspended`), authorized_by, created_at | unique (business_id, user_id); a user row here has no `membership` |
| `winger_catalog_projection` | business_id, product_id, name, image_url (nullable), sell_price, winger_price (nullable), currency, on_hand (default 0), is_active, updated_at | `winger` schema; read-only projection from `ProductUpserted` / `PriceChanged` / `ProductDeactivated` / `StockLevelChanged`; unique (business_id, product_id); serves the winger catalog read |
| `alert_config` | id, business_id, recipients (json: user_ids or emails), min_interval_hours (default 24) | one per business; defaults to all owners |
| `notification` | id, business_id, type (`low_stock`\|`invitation`\|`winger_authorized`), channel (`email`), payload (json), status (`queued`\|`sent`\|`failed`), dedupe_key (nullable), attempts (default 0), last_error (nullable), created_at, sent_at | `notifications` schema |
| `notification_contact` | id, business_id, user_id, role (`owner`\|`staff`), email, locale, active (bool) | `notifications` schema; read-only projection from `BusinessCreated` / `MembershipCreated` / `MembershipSuspended`; unique (business_id, user_id) |
| `digest_config` | business_id (pk), min_interval_hours, recipients (json) | `notifications` schema; read-only projection from `AlertConfigChanged`; drives the low-stock digest cadence (no RLS — internal worker config) |
| `notification_business` | business_id (pk), name, locale | `notifications` schema; read-only projection from `BusinessCreated`; supplies the business name + locale for email rendering (no RLS) |
| `low_stock_alert_state` | id, business_id, product_id, is_open (bool), opened_at, closed_at | `inventory` schema; one per product; source of truth for the low-stock edge (supersedes any `stock_item` flag) |
| `audit_log` | id, business_id (nullable for control-plane), actor_id, actor_type (`user`\|`operator`\|`system`), action, target_type, target_id, metadata (json), created_at | |
| `support_access_grant` | id, business_id, operator_id, reason, approved_by (owner user_id), granted_at, expires_at, revoked_at | max lifetime 24h |

### Relationships

- `business` 1–N `membership`, `product`, `sale`, `winger_account`, `customer`, `invoice`, ...
- `product` 1–1 `stock_item` (MVP), 1–N `stock_movement`, 1–N `sale_line`.
- `sale` 1–N `sale_line`, 1–1 `receipt`, 0–1 `invoice`.
- `customer` 1–N `invoice`; `invoice` 1–N `invoice_line`, 1–N `payment`.
- `invoice` 0–1 `document` (kind `invoice`) in the `media` schema, referenced by id only.
- `user` N–N `business` via `membership`; `user` 1–N `winger_account`.
- `business` 1–N `winger_catalog_projection` (one row per active product; rebuilt from catalog + inventory events; read fields are a fixed whitelist).

### Invariants

- `stock_item.quantity == sum(stock_movement.quantity_delta)` for that product, always, enforced in-transaction.
- A completed `sale` has ≥1 `sale_line`; `total == sum(line_total) - discount_total` and `total >= 0`.
- Voiding a `sale`: insert `void_reversal` movements equal and opposite to the sale movements; set `receipt.status = void`.
- `winger_price` when null resolves to `sell_price` at read time.
- `invoice.balance_due_minor == total_minor - amount_paid_minor` and `0 <= balance_due_minor <= total_minor`, always, enforced in-transaction.
- `invoice.amount_paid_minor == sum(payment.amount_minor)` for that invoice.
- `customer.outstanding_balance == sum(invoice.balance_due_minor)` over that customer's non-`void` invoices, maintained in the same transaction as any invoice/payment write.
- A completed `sale` with `payment_terms = credit` has a non-null `customer_id` and exactly one `invoice` with `balance_due_minor == total_minor` at issue.
- Voiding a `sale` voids its `invoice` (`status = void`, `balance_due_minor = 0`) and decrements the customer balance by the pre-void `balance_due_minor`.
- A `user` cannot have both a `membership` and a `winger_account` in the same `business`.
- `low_stock_alert_state.is_open` flips true when on-hand ≤ threshold, false when on-hand > threshold; email sent only on the false→true edge.

### Indexes

- `product (business_id, is_active)`, `product (business_id, code)`, `product (business_id, sku)`.
- `stock_movement (business_id, product_id, created_at)`.
- `sale (business_id, created_at)`, `receipt (public_token)`.
- `membership (user_id)`, `winger_account (user_id)`.
- `invoice (business_id, status, due_date)`, `invoice (public_token)`, `invoice (business_id, customer_id)`.
- `payment (business_id, invoice_id)`, `customer (business_id, name)`, `document (business_id, kind, ref_id)`.

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
- Invoicing lives in the `sales` schema (invoices are a sale artifact — same number
  counter, product cache, and void path). Receivable balance is derived + cached,
  never hand-entered; the invoice ledger is the source of truth. See
  `docs/design/product/invoicing-and-credit.md` (adopted 2026-09-07, Phase 07).
- `media` owns `document` and stores the rendered object in MinIO/S3; other services
  reference a document by id only. `invoice.document_url` is a convenience copy
  written from `InvoiceDocumentReady`.

## Contracts

- Prisma schema mirrors this doc. Any change here precedes a migration.
- All tenant tables get an RLS policy in the same migration that creates them, via the `enable_tenant_rls('<table>' [, '<tenant_col>'])` SQL helper (defined in migration `20260901201947_tenancy_business_membership`; defaults the column to `business_id`).

## Acceptance Criteria

- Migration creates every table above with `business_id` + RLS on tenant tables.
- Invariant tests: ledger sum equals cached quantity after randomized movement sequences.
- Void test: post-void on-hand equals pre-sale on-hand for every line.
