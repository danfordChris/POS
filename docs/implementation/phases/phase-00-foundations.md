# Phase 00 — Foundations

## Status

- `pending`
- Last updated: 2026-09-01

## Objective

Stand up the repo, the three app skeletons, authentication, tenant scoping, and CI so feature phases can build on a verified base.

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

- [ ] T-0001 Repo scaffold and tooling
- [ ] T-0002 API base: NestJS + Prisma + Postgres + health
- [ ] T-0003 Auth module (register/login/refresh/logout/me, two audiences)
- [ ] T-0004 Tenancy: business/membership, route guard, RLS + `app.business_id`
- [ ] T-0005 Invitations: create/revoke/accept + email (local capture)
- [ ] T-0006 Web app shell + login + auth guard + business switcher
- [ ] T-0007 Mobile app shell + login + session + business switcher
- [ ] T-0008 CI pipeline + OpenAPI drift check
- [ ] T-0009 Local docker-compose stack

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
