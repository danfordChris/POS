# Project Implementation

## Overview

- Build the MVP of the multi-tenant stock management platform defined in `docs/design/`.
- Deliverables: NestJS + PostgreSQL API, Flutter mobile app, Next.js web admin.
- Frozen scope: `docs/design/product/prd-mvp.md`. No net-new behavior added here.

## Current Priorities

1. Phase 00 — Foundations (repo, stack scaffold, auth, tenant bootstrap, CI).
2. Phase 01 — Inventory core (catalog, stock ledger, scan lookup).
3. Phase 02 — Reorder alerts (thresholds, low-stock email).

## Active Phases

- [ ] Phase 00 — Foundations
- [ ] Phase 01 — Inventory core
- [ ] Phase 02 — Reorder alerts
- [ ] Phase 03 — Sales and digital receipts
- [ ] Phase 04 — Winger portal
- [ ] Phase 05 — Hardening and MVP acceptance

## Deferred Phases

- [ ] SMS notifications
- [ ] PDF invoicing and credit sales
- [ ] Payments / mobile money
- [ ] Multi-location and stock transfers
- [ ] Fiscal (EFD/VFD) receipt compliance
- [ ] Offline write queue / sync

## Dependencies

- Phase 00 residual blockers cleared 2026-09-01 (backend, hosting model, git init, SMS provider).
- Phases 01–05 depend on Phase 00 auth + tenant scoping.
- Phase 03 depends on Phase 01 stock ledger.
- Phase 04 depends on Phase 01 catalog.

## Linked Artifacts

- phases: `docs/implementation/phases/`
- tasks: `docs/implementation/tasks/`
- status: `docs/implementation/status/weekly-status.md`
