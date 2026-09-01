# Phase 04 — Winger Portal

## Status

- `pending`
- Last updated: 2026-09-01

## Objective

Let an Owner authorize resellers who then see a whitelisted catalog view for that one business and nothing else.

## Scope

- `winger_account` model + migration + RLS; unique (business_id, user_id); mutually exclusive with `membership`.
- `POST/GET/PATCH /businesses/{id}/winger-accounts` (Owner) — resolve or create user by email/phone.
- `GET /winger/businesses` and `GET /winger/businesses/{id}/products` (Winger audience/scope).
- Winger product DTO: fixed whitelist `{ name, image_url, price, currency, in_stock }`; `price = winger_price ?? sell_price`; `in_stock = on_hand > 0`.
- Suspended winger → 403 on all winger routes.
- Web `/wingers`: authorize, list, suspend/reactivate, set per-product winger price, upload images.
- Mobile: winger-only catalog view + business switcher; no other routes registered.
- `winger_authorized` email.

## Features

- Winger price left blank falls back to retail sell price.
- Placeholder image when `image_url` is null.

## Tasks

- [ ] T-0401 `winger_account` model + migration + RLS + mutual-exclusion check
- [ ] T-0402 Owner winger-account endpoints + user resolution
- [ ] T-0403 Winger catalog endpoints + whitelist DTO + schema test
- [ ] T-0404 Scope enforcement (non-authorized business_id → 403)
- [ ] T-0405 Web `/wingers` management + winger price + image upload
- [ ] T-0406 Mobile winger catalog + business switcher (restricted routing)
- [ ] T-0407 `winger_authorized` email template (en/sw)

## Acceptance Criteria

- [ ] Winger catalog response validates against the whitelist schema — no `quantity`, `cost_price`, `created_by`, or member fields.
- [ ] Winger request for a non-authorized `business_id` returns 403.
- [ ] Suspended winger gets 403 on every winger route.
- [ ] `price` equals `winger_price` when set, else `sell_price`.
- [ ] A user with a `membership` in a business cannot be added as a `winger_account` there.

## Blockers

- Phase 01 catalog must be `done`.

## Linked Tasks

- `docs/implementation/tasks/`
