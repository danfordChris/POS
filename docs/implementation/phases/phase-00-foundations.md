# Phase 00 — Foundations

## Status

- `in-progress`
- Last updated: 2026-09-01

## Objective

Stand up the repo, app skeletons, authentication, and tenant scoping as a verified baseline.

> Architecture pivot (2026-09-01, decision 0002): the project moves to microservices. The
> monolith `api` built here (T-0002..T-0004) is a working baseline; **Phase 01 decomposes it**
> into `gateway` / `identity` / `tenancy` and adds the platform. T-0005–T-0009 below are
> superseded — see the mapping in Tasks.

## Scope

- Monorepo structure; shared tooling; environment config.
- API: NestJS app, PostgreSQL + Prisma, migrations, RLS scaffolding, health check.
- Auth: register/login/refresh/logout, `GET /auth/me`, JWT audiences (`user`, `operator`).
- Tenancy: `business`, `membership`; path-scoped guard; `SET app.business_id` per transaction; RLS deny-by-default.
- Web: Next.js app shell, login, auth guard, business switcher.
- Mobile: Flutter app shell, login, session storage, business switcher.
- CI: lint, test, build, OpenAPI generation + drift check.
- Local stack: docker-compose (Postgres, Redis, MinIO, mail capture).

## Features

- Business signup → creator becomes Owner (`POST /v1/businesses`).
- Members: invite Staff, accept invitation.
- Control-plane skeleton (`/v1/admin`) with operator audience rejected on data routes.

## Tasks

- [x] T-0001 Repo scaffold and tooling
- [x] T-0002 API base: NestJS + Prisma + Postgres + health
- [x] T-0003 Auth module (register/login/refresh/logout/me, two audiences)
- [x] T-0004 Tenancy: business/membership, route guard, RLS + `app.business_id`
- [ ] ~~T-0005 Invitations~~ → moves into `services/tenancy` (Phase 01 T-0113 / early Phase 02)
- [ ] ~~T-0006 Web app shell~~ → Phase 01 (targets the gateway); tracked in backlog
- [ ] ~~T-0007 Mobile app shell~~ → Phase 01 (targets the gateway); tracked in backlog
- [ ] ~~T-0008 CI pipeline~~ → superseded by Phase 01 T-0116 (per-service CI)
- [ ] ~~T-0009 Local docker-compose stack~~ → superseded by Phase 01 T-0111 (NATS + shared Postgres, schema per service)

## Acceptance Criteria

- [ ] `docker compose up` yields a working API, web, and mobile-debug target against one database.
- [ ] Cross-tenant test: member of business A gets 403 on every business B route.
- [ ] RLS test: a query without `app.business_id` returns zero rows on every tenant table.
- [ ] Operator token gets 403 on `/v1/businesses/{id}/*`.
- [ ] CI fails on lint error, test failure, or OpenAPI drift.

## Blockers

- None. Backend, hosting model, git init, and SMS provider resolved 2026-09-01.

## Linked Tasks

- `docs/implementation/tasks/`
