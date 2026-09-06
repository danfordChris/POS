# Backlog

## Status

pending

## Objective

Hold work not yet scheduled into a phase or written as a full task doc.

## Implementation Checklist

- [x] Web app shell (ex T-0006) — done as T-0120 (Kong edge, not a `gateway` service)
- [x] Mobile app shell (ex T-0007) — done as T-0121
- [ ] `GET /v1/businesses` — list the caller's memberships → businesses. Needed for the
      client business switcher and to skip forced onboarding for users who already
      belong to a business. tenancy's `membership` RLS is per-business, so this needs a
      SECURITY DEFINER function or an identity→tenancy composition.
- [ ] `GET /v1/auth/me` should compose `memberships` / `wingerAccounts` (identity calls
      tenancy `resolveMembership` / a new list RPC). Currently returns empty arrays.
- [ ] Invitations capability in `services/tenancy` (ex T-0005) — schedule after T-0113
- [~] Expand Phase 02–06 checklist items into full task docs when each phase is
      scheduled — Phase 02 done; Phase 03 done (T-0201–T-0207, 2026-09-06);
      Phases 04–06 pending
- [ ] Service mesh (mTLS) evaluation — Phase 06
- [ ] Invitation resend endpoint
- [ ] Mobile camera scanning (`mobile_scanner` + camera permission config) — the
      Scan screen (T-0107) does manual code entry today; the lookup/prefill flow is
      already in place.
- [ ] Mobile product image upload + a mobile stock/movements list screen.
- [ ] Mobile provider unit tests (`CatalogProvider`/`StockProvider` load/error
      transitions) — needs an injectable `ApiClient` or `http_mock_adapter` on Dio.
- [ ] Revisit `skeletonizer` once it catches up to the current Flutter `Canvas`
      API — `NeuSkeleton` (hand-rolled shimmer) is the stand-in.
- [x] Figma-inspired polish (2026-09-02): first slice
      (Badge/EmptyState/Skeleton/Stepper/icon-headed panels) + product-detail
      Inventory panel with a stock-health `NeuRing`, catalog thumbnails +
      scan-in-search + circular FAB, `More` -> menu drawer, Home + web dashboard
      hero cards with a requires-attention low-stock list.
- [ ] Inline-editable low-stock / reorder thresholds on the product detail
      (currently read-only chips) — needs a PATCH round-trip + optimistic update.
- [ ] Mobile: product image upload; a Stock / movements list screen.
- [ ] CI coverage gates
- [ ] Post-MVP: NextSMS adapter, PDF invoicing, payments/mobile money, multi-location, EFD/VFD, offline sync, push notifications, `reporting`/`media` services
