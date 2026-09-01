# T-0007 Mobile App Shell + Login + Session + Business Switcher

## Status

- `pending`
- Last updated: 2026-09-01

## Linked Phase

- Phase 00 — Foundations

## Agent Context

- Skills: workflow-contract, flutter-apply-architecture-best-practices, flutter-setup-declarative-routing, flutter-setup-localization, flutter-use-http-package
- Design docs: `docs/design/interfaces/mobile-app-spec.md`, `docs/design/interfaces/api-contract.md`, `docs/design/product/roles-and-permissions.md`
- Constraints: secure token storage; online-required (no write queue); every network call in try/catch → typed error → `error.code`-keyed message; role-restricted routing (Winger build sees only the catalog route).
- Do not touch: API code; feature flows (catalog/scan/sell land in later phases).

## Objective

The Flutter app authenticates, stores the session securely, routes by auth + role, and lets a multi-context user switch business, with placeholder Home and a restricted Winger shell.

## Scope Boundary

**In scope:**
- Layered structure (data / domain / UI) per the architecture skill.
- Declarative routing: unauthenticated (Login, Accept Invitation) vs authenticated Owner/Staff (bottom nav placeholders: Home, Catalog, Scan, Sell, More) vs Winger (single Catalog route only).
- Secure storage for tokens; transparent refresh; logout.
- Business switcher in the app bar from `GET /v1/auth/me`.
- Offline banner + write-button disabling helper (used by later phases).
- Localization scaffold (en/sw).
- HTTP client with error envelope mapping.

**Out of scope:**
- Scanning, stock, sales, real catalog data (later phases).
- Push notifications.

## Acceptance Criteria

- [ ] Cold start with no session shows Login; with a valid session shows Home.
- [ ] Login stores tokens in secure storage; logout clears them.
- [ ] Access-token expiry triggers a transparent refresh; refresh failure returns to Login with a message.
- [ ] A Winger-only identity has no registered route to Home/Catalog(internal)/Scan/Sell/More.
- [ ] Business switcher lists every context from `/auth/me`; switching swaps the active `business_id` used by API calls.
- [ ] Airplane mode shows the offline banner and disables write-action buttons via the shared helper.
- [ ] Locale switch toggles en/sw strings.

## Dependencies

- T-0003, T-0004, T-0005

## Implementation Checklist

- [ ] Apply layered architecture + routing + localization scaffolds.
- [ ] Implement secure token storage + refresh interceptor (try/catch).
- [ ] Implement HTTP client + error mapping.
- [ ] Build Login and Accept Invitation screens.
- [ ] Build role-aware router + placeholder Home + Winger catalog shell.
- [ ] Implement business switcher from `/auth/me`.
- [ ] Add offline banner + write-disable helper.
- [ ] Widget/integration tests for the Acceptance Criteria.

## Verification

- Command: `cd mobile && flutter test`
- Evidence: passing test output + screenshots of Login, Home, switcher, and the Winger shell in the PR.
