# T-0107 Mobile — Scan Lookup + Prefill

## Status

- `done`
- Last updated: 2026-09-02

## Linked Phase

- Phase 02 — Inventory Core

## Agent Context

- Skills: mobile, workflow-contract
- Design docs: `docs/design/interfaces/mobile-app-spec.md` (Scan), `docs/design/interfaces/api-contract.md` (`GET /products?code=`), `docs/design/architecture/mobile-architecture.md`
- Constraints: project Flutter architecture; neumorphic kit; a code miss is a 404 that echoes the code (`catalog` behaviour).
- Do not touch: `web/`, `services/*`.

## Objective

The Scan tab resolves a product code: a match opens the product; an unknown code starts a new product with the code prefilled.

## Scope Boundary

**In scope:**
- `lib/features/scan/screens/scan_screen.dart` — code entry + `CatalogProvider.lookupByCode` → navigate to `AppRoute.productDetail` (found) or `AppRoute.productNew` with the code as `extra` (miss).
- `CatalogProvider.lookupByCode(businessId, code)` over `CatalogService.findByCode` (`?code=`, 404 → null).

**Out of scope:**
- Camera capture (`mobile_scanner` + platform permissions) — deferred to the backlog; the screen states this and takes manual entry. The lookup/prefill flow is identical once the camera is added.

## Acceptance Criteria

- Entering a known code and tapping "Look up" pushes the matching product's detail screen.
- Entering an unknown code shows a "No product uses …" card with an "Add a product with this code" button that opens `ProductFormScreen` with the `code` field prefilled.
- A transport failure renders through the provider's `error`, not a crash.
- `flutter analyze` clean; imports are `package:pos_mobile/...`.

## Dependencies

- T-0106, T-0102

## Implementation Checklist

1. `CatalogProvider.lookupByCode`.
2. `scan_screen.dart` — replace the stub; entry field + result handling.
3. Camera deferral noted in `docs/implementation/tasks/backlog.md`.

## Verification

- `flutter analyze` → "No issues found!".
- Manual: found → detail; miss → prefilled form. Exercised against `docker compose up` with catalog seeded.
