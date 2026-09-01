# Decision 0001 — Foundational Choices

## Date

2026-09-01

## Decision

- Frontend: Flutter for mobile (Android + iOS). Next.js for the web admin. Both consume one shared backend API.
- Backend: NestJS (TypeScript) + PostgreSQL + Prisma. REST API described by OpenAPI. Confirmed 2026-09-01.
- Multi-tenancy: shared database, `business_id` discriminator on every tenant-owned table, enforced by a mandatory query scope in the data layer plus PostgreSQL Row-Level Security as defense in depth.
- Platform operator: separate control-plane. No standing access to tenant business data. Support access is break-glass — time-boxed, owner-approved, audit-logged.
- Market: Tanzania. Currency TZS. Locales English (`en`) and Swahili (`sw`). No tax-authority / EFD / VFD fiscal receipt integration in MVP.
- Notifications: transactional email only in MVP. SMS deferred; provider chosen for that phase is NextSMS (nextsms.co.tz, Tanzania).
- Hosting: containerized. All services ship as Docker images; deploy to any container platform + managed PostgreSQL + managed Redis. Specific provider deferred to first deploy; not a code concern. Confirmed 2026-09-01.
- Version control: git initialized 2026-09-01. Commit messages carry no author/tool attribution.
- Connectivity: online required for v1. Mobile keeps a read cache; writes require a network connection. No write queue / offline sync in MVP.
- Winger portal: view-only in MVP. No winger ordering.
- Billing: handled off-platform in MVP. Control-plane stores a manual `subscription_status` per business.

## Reason

- Stock movements, sales, and audit trails are relational and must be verifiable → PostgreSQL over a document store.
- Owner-holds-data-control requirement → operator has no data-plane access by default.
- MVP speed → defer SMS, payments, invoicing, offline sync, fiscal compliance.

## Impacted Docs

- `docs/design/product/*`
- `docs/design/architecture/*`
- `docs/design/data/data-model.md`
- `docs/design/interfaces/*`
- `docs/design/integrations/*`
- `docs/implementation/project.md`

## Open (non-blocking)

- Specific container hosting provider + managed Postgres/Redis vendor — decided at first deploy.
- Payments / mobile money provider shortlist (M-Pesa, Tigo Pesa, Airtel Money) — captured when that post-MVP phase is scoped.
