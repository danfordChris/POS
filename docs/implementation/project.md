# Project Implementation

## Overview

- Build the MVP of the multi-tenant stock management platform defined in `docs/design/`.
- Architecture: microservices (decision 0002) — `gateway` + `identity`, `tenancy`, `catalog`, `inventory`, `sales`, `winger`, `notifications`; NATS; database-per-service; Kubernetes in prod.
- Frozen product scope: `docs/design/product/prd-mvp.md`. No net-new behavior added here.

## Current Priorities

1. Phase 01 — Platform and Core Services (monorepo, `@pos/contracts` + `@pos/nest-common`, NATS, `gateway`, `identity`, `tenancy`; retire the monolith `api`).
2. Phase 02 — Inventory core (`catalog` + `inventory` services: catalog, stock ledger, scan lookup).
3. Phase 03 — Reorder alerts (`inventory` thresholds → `notifications` email).

## Active Phases

- [x] Phase 00 — Foundations (monolith baseline: T-0001–T-0004 done; T-0005–T-0009 superseded by Phase 01)
- [ ] Phase 01 — Platform and Core Services
- [ ] Phase 02 — Inventory core (`catalog`, `inventory`)
- [ ] Phase 03 — Reorder alerts (`inventory` → `notifications`)
- [ ] Phase 04 — Sales and digital receipts (`sales`; stock saga with `inventory`)
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

- Phase 01 blocked only on the decision 0002 defaults being confirmed or accepted (`docs/changes/proposed/0002-service-architecture.md`).
- Phases 02–06 depend on Phase 01 (`gateway` + `identity` + `tenancy` + `@pos/*` + NATS).
- Phase 04 (`sales`) depends on Phase 02 (`inventory` reservation RPC).
- Phase 05 (`winger`) depends on Phase 02 (`catalog` + `inventory` events).
- Web/mobile shells (ex T-0006/T-0007) target the `gateway`; scheduled within Phase 01.

## Linked Artifacts

- phases: `docs/implementation/phases/`
- tasks: `docs/implementation/tasks/`
- status: `docs/implementation/status/weekly-status.md`
