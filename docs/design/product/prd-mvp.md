# PRD — MVP

## Context

- First shippable release. Scope frozen at the capabilities below.
- Clients: Flutter mobile app, Next.js web admin. Backend: NestJS + PostgreSQL.
- Single location per business in MVP.

## Requirements

### In scope

1. **Business onboarding**
   - Sign up a business: name, country (Tanzania), currency (TZS), locale (en/sw).
   - Creator becomes Owner.
2. **Members**
   - Owner invites Staff by email; invite has an expiring token.
   - Invitee sets a password and joins as Staff.
   - Owner can suspend or remove a member.
3. **Catalog**
   - Create/edit/deactivate products: name, SKU, category, unit, description, single image, cost price, sell price, winger price (optional), reorder threshold, QR/barcode value.
   - List and search products by name, SKU, or scanned code.
4. **Stock**
   - Record stock-in (quantity, reason/reference).
   - Record adjustment (delta, reason).
   - On-hand quantity derived from the movement ledger.
   - Every change writes a `StockMovement` row.
5. **Scan**
   - Mobile scans a QR/barcode → opens matching product, or offers "create product" with the code prefilled.
6. **Reorder alerts**
   - When a movement brings on-hand ≤ `reorder_threshold`, queue a low-stock email to the business alert recipients (default: all Owners).
   - Deduplicate: no repeat alert for the same product while it stays at/below threshold.
7. **Sales + digital receipt**
   - Build a sale from products (qty, unit price defaulting to sell price, optional line discount).
   - Completing a sale writes `sale` type movements and decrements on-hand.
   - Generate a receipt with a public token URL viewable without login.
   - Void a sale → reverses movements, marks receipt void.
8. **Winger portal**
   - Owner authorizes an existing user as a Winger for the business.
   - Winger login shows only authorized business's active products: name, image (if set), winger price (else sell price), and in-stock / out-of-stock flag.
   - Winger sees no quantities, cost, sales, members, or any other business.
9. **Tenant isolation**
   - Every tenant-owned API response is scoped to a `business_id` the caller is a member of.
   - Platform operator endpoints cannot read catalog, stock, sales, prices, or members.

### Out of scope (deferred)

- SMS notifications; PDF invoices; credit sales / payment tracking; payment gateway / mobile money.
- Multi-location, stock transfers; barcode label printing.
- Fiscal / EFD / VFD receipt compliance.
- Winger ordering; winger self-signup.
- Offline write queue / sync; advanced analytics; role beyond Owner/Staff/Winger.

## Decisions

- Manager role deferred; Owner and Staff only in MVP.
- Receipt delivery in MVP is a shareable link only (no email/SMS send, no PDF).
- Winger price is a single optional field on the product, not a full price list.

## Contracts

### User stories → acceptance criteria

| ID | Story | Acceptance criteria |
|---|---|---|
| U1 | As a visitor I sign up a business | `POST /v1/businesses` with valid body returns 201; caller gets Owner membership |
| U2 | As an Owner I invite staff | `POST /v1/businesses/{id}/invitations` returns 201 with token; token expires per config |
| U3 | As an invitee I join | Accepting a valid token creates a Staff membership; expired/used token returns 410 |
| U4 | As Staff I add a product | `POST .../products` returns 201; product appears in list scoped to the business only |
| U5 | As Staff I record stock-in | On-hand increases by exactly the quantity; one `StockMovement type=stock_in` row created |
| U6 | As Staff I scan an item | Known code returns the product; unknown code returns 404 with the code echoed |
| U7 | As the system I alert on low stock | Movement crossing threshold enqueues exactly one `Notification type=low_stock`; none while still ≤ threshold |
| U8 | As Staff I complete a sale | On-hand decreases per line; receipt token URL returns 200 for anonymous request |
| U9 | As Staff I void a sale | On-hand restored to pre-sale values; receipt marked void |
| U10 | As an Owner I authorize a winger | `POST .../winger-accounts` returns 201; that user can call the winger catalog for this business |
| U11 | As a Winger I view the catalog | Response contains name, price, in-stock flag; contains no quantity, cost, or member fields |
| U12 | As a Winger I probe another business | Winger catalog request for a non-authorized `business_id` returns 403 |
| U13 | As an operator I attempt data access | Operator token on any `/v1/businesses/{id}/*` data route returns 403 |

## Acceptance Criteria

- All stories U1–U13 pass automated tests.
- A cross-tenant test suite asserts every tenant route rejects a non-member (403) and never leaks another business's rows.
- Low-stock dedupe verified: repeated sub-threshold movements produce one notification until on-hand rises above threshold.
- Receipt public URL works logged-out and exposes no internal identifiers beyond the sale contents.
