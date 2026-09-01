# Product Overview

## Context

- Multi-tenant SaaS for small retail businesses, starting in Tanzania.
- Tenant = one business. Data isolation is absolute: no business sees another's stock, prices, customers, sales, or figures (Microsoft Teams isolation model).
- The business owner administers all access. The platform vendor cannot see tenant business data.
- Two clients: a Flutter mobile app for floor work (stock, scanning, sales) and a Next.js web app for management.

## Requirements

### Personas

| Persona | Needs |
|---|---|
| Owner | Full control of catalog, stock, staff, wingers, prices, reports, alerts. Confidence the vendor cannot see their figures. |
| Staff / Cashier | Fast sale capture, stock-in, item lookup by scan, low-stock visibility. |
| Winger (reseller) | See authorized shop's products, reseller price, image, and whether an item is in stock. Nothing else. |
| Platform operator | Provision businesses, manage subscription status, provide support without seeing business data. |

### Value proposition

- Owner keeps control of their data; vendor is structurally blind to it.
- Stock accuracy with reorder alerts before stockout.
- Controlled reseller (winger) channel without exposing internal data.
- Digital receipts with no paper or fiscal-device dependency.

### Success metrics (first 90 days post-MVP)

- Time to first recorded sale after signup < 15 min.
- % of active businesses with at least one reorder threshold set > 70%.
- Low-stock alert to restock action median < 48h.
- Zero cross-tenant data exposure incidents.

## Decisions

- MVP capability set and deferrals: see `docs/design/product/prd-mvp.md`.
- Roles and access: see `docs/design/product/roles-and-permissions.md`.
- Foundational tech and isolation choices: see `docs/design/decisions/0001-foundational-choices.md`.

## Contracts

- Product behavior is authoritative here and in `prd-mvp.md`. APIs implement it; they do not extend it.

## Acceptance Criteria

- Every persona above has at least one covered user story in `prd-mvp.md`.
- No requirement in this doc depends on SMS, payments, invoicing, offline sync, or fiscal compliance.
