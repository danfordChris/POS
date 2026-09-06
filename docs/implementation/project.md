# Project Implementation

## Overview

- Build the MVP of the multi-tenant stock management platform defined in `docs/design/`.
- Architecture: microservices (decision 0002) — Kong edge + `identity`, `tenancy`, `catalog`, `inventory`, `sales`, `winger`, `notifications`; NATS; one shared PostgreSQL (schema + role per service); Kubernetes in prod.
- Frozen product scope: `docs/design/product/prd-mvp.md`. No net-new behavior added here.

## Current Priorities

1. Phase 05 — Winger portal (`winger` read model + portal API). Expand into
   task docs, then build the `winger` service + portal screens.
2. Phase 06 — Hardening and MVP acceptance.
3. Backlog: mobile offline banner/connectivity provider; `tenancy` event
   enrichment for `notification_contact`; low-stock email product-name.

## Active Phases

- [x] Phase 00 — Foundations (monolith baseline: T-0001–T-0004 done; T-0005–T-0009 superseded by Phase 01)
- [x] Phase 01 — Platform and Core Services
- [x] Phase 02 — Inventory core (`catalog` + `inventory` services, neumorphic design system, web + mobile app shells, all feature screens; `docker compose up` e2e smoke 25/25 through Kong; acceptance verified 2026-09-02)
- [x] Phase 03 — Reorder alerts (`inventory` `alert_config` + `low_stock_alert_state` + `AlertConfigChanged`; `notifications` service — projections, low-stock consumer, digest flush, en/sw templates; web `/alerts`; T-0201–T-0207 done 2026-09-06)
- [x] Phase 04 — Sales and digital receipts (`sales` service — reserve→write→commit saga, `422` path, void + `inventory` `SaleVoided` reversal, public `/v1/r/{token}`, list/detail; mobile sell + receipt; web sales screens; T-0301–T-0309 done 2026-09-07)
- [ ] Phase 05 — Winger portal (`winger` read model + portal API)
- [ ] Phase 06 — Hardening and MVP acceptance

## Deferred Phases

- [ ] SMS notifications (`notifications` + NextSMS adapter)
- [ ] PDF invoicing and credit sales
- [ ] Payments / mobile money
- [ ] Multi-location and stock transfers
- [ ] Fiscal (EFD/VFD) receipt compliance
- [ ] Offline write queue / sync
- [ ] `reporting` and `media` services

## Dependencies

- Phases 01–02 complete; decision 0002 defaults confirmed 2026-09-01 (`docs/design/decisions/0002-microservices.md`).
- Phases 03–06 depend on Phase 01 (Kong edge + `identity` + `tenancy` + `@pos/*` + NATS) and Phase 02 (`catalog` + `inventory`).
- Phase 04 (`sales`) depends on the Phase 02 `inventory` reservation RPC.
- Phase 05 (`winger`) depends on Phase 02 (`catalog` + `inventory` events).
- Web + mobile app shells shipped in Phase 02 as T-0120 / T-0121 (target the Kong edge, not a `gateway` service).

## Linked Artifacts

- phases: `docs/implementation/phases/`
- tasks: `docs/implementation/tasks/`
- status: `docs/implementation/status/weekly-status.md`
