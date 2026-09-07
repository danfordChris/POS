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
- [~] Invitations capability in `services/tenancy` (ex T-0005) — scheduled into Phase 06 as T-0501.
- [~] Operator control-plane `/v1/admin/*` + `support_access_grant` + `audit_log`
      (designed in api-contract / data-model / multi-tenancy, unbuilt) — scheduled
      into Phase 06 as T-0502.
- [ ] `tenancy` should enrich `BusinessCreated` / `MembershipCreated` with the
      owner/member `email` + `locale` (via `identity.getUser`). The
      `@pos/contracts` fields are optional as of v1.1 (T-0203); until tenancy
      populates them, `notification_contact.email` is null and `low_stock`
      emails have no owner recipients unless `alert_config.recipients` is set.
- [x] Expand Phase 02–06 checklist items into full task docs when each phase is
      scheduled — Phase 02 done; Phase 03 (T-0201–T-0207); Phase 04 (T-0301–T-0309);
      Phase 05 (T-0401–T-0407) done; Phase 06 task docs written (T-0501–T-0509, 2026-09-07)
- [ ] Service mesh (mTLS) evaluation — Phase 06 (proposal 0002, on-hold)
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
- [ ] Product image gallery — up to 10 images per product (new `product_image`
      table + count/size limits + web/mobile gallery UI). Requested 2026-09-07;
      only the single-image 10 MB size cap + friendly errors shipped in T-0506.
- [ ] `pnpm -r test` flakes locally on the shared Postgres since T-0503/T-0505
      added HTTP-heavy e2e specs (pool contention). Workaround:
      `pnpm --workspace-concurrency=1 test`. Fix: a per-service test DB or a
      pooled-connection cap in the vitest setup.
- [ ] CI coverage gates
- [ ] Security hardening follow-ups from `docs/ops/security-review-2026-09.md`:
      pin Kong `cors` origins for prod (finding 1); magic-byte sniff on image
      upload (2); progressive login backoff / account lock (3); Kong
      security-headers plugin for the prod edge (4); `pnpm audit` / Dependabot in
      CI (5).
- [ ] Post-MVP: NextSMS adapter, PDF invoicing, payments/mobile money, multi-location, EFD/VFD, offline sync, push notifications, `reporting`/`media` services
