# Mobile App Spec — MVP

## Context

- Flutter, Android + iOS. Audience: Owner and Staff doing floor work. Winger uses the mobile app too (read-only catalog).
- Online required. A local read cache (catalog, on-hand) speeds screens; all writes call the API and fail clearly when offline.
- Locales: en, sw.

## Requirements

### Navigation

- Unauthenticated: Login, Accept Invitation, Register.
- Authenticated (Owner/Staff): bottom nav — Home, Catalog, Scan, Sell, More.
- Authenticated (Winger): single Catalog view + business switcher; no other tabs.
- Business switcher in the app bar when the user has >1 context.

### Screens (Owner/Staff)

| Screen | Content | Actions |
|---|---|---|
| Home | Today's sales count/total; low-stock count; quick buttons | Go to low-stock list, new sale |
| Catalog list | Search field, product rows (name, on-hand, price) | Tap → detail; FAB → new product |
| Product detail | All fields; cost/price shown to Owner only | Edit; record stock-in; adjust; deactivate |
| New/Edit product | Form; price fields hidden for Staff; image picker | Save (`POST/PATCH /products`) |
| Scan | Camera QR/barcode | Match → product detail; no match → New product with `code` prefilled |
| Stock-in | Product, quantity, reason/reference | Submit (`POST /stock/movements type=stock_in`) |
| Adjustment | Product, signed delta, reason | Submit (`type=adjustment`) |
| Sell | Add lines (scan or pick), qty, optional line discount, running total | Complete (`POST /sales`); handle 422 `insufficient_stock` inline |
| Receipt | Sale summary, shareable link, QR of link | Share sheet; new sale |
| Low-stock list | Products with on-hand ≤ threshold | Tap → stock-in |
| More | Profile, language, members (Owner), alert config (Owner), logout | |

### Screens (Winger)

| Screen | Content |
|---|---|
| Catalog | Product cards: image (or placeholder), name, price, In stock / Out of stock badge. No quantities. |
| Business switcher | Only businesses where the caller is an active winger |

### Behaviors

- Offline: show a persistent banner; disable write buttons with a tooltip; reads served from cache with a "last updated" time.
- Scan: debounce duplicate reads; torch toggle.
- All network calls wrapped in try/catch → typed error → user-facing message keyed by `error.code`; never surface a raw stack trace.
- Auth token refresh handled transparently; on refresh failure → return to Login with a message.
- Money formatted per business `currency` + device locale.

## Decisions

- One image per product in MVP.
- No offline write queue; explicit failure instead of silent retry.
- Winger app experience is deliberately minimal — no search filters in MVP beyond text search.

## Contracts

- Screens map 1:1 to endpoints in `api-contract.md`; no client-only fields.
- Winger screens call only `/v1/winger/*`.

## Acceptance Criteria

- Manual + integration test: scan of a known code opens the product; unknown code opens prefilled New product.
- Completing a sale that exceeds on-hand shows the `insufficient_stock` message and does not create a sale.
- Winger build cannot navigate to any Owner/Staff screen (no route registered).
- Airplane mode: write buttons disabled, reads still render from cache.
