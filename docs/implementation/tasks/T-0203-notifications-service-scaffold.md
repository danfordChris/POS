# T-0203 Notifications Service — Scaffold + Contact Projection

## Status

- `done`
- Last updated: 2026-09-06

## Linked Phase

- Phase 03 — Reorder Alerts

## Agent Context

- Skills: backend, workflow-contract
- Design docs: `docs/design/architecture/service-decomposition.md` (`notifications` row, transport rules, deployment), `docs/design/data/data-model.md` (`notification`, `notification_contact`), `docs/design/integrations/notifications.md` (Recipient resolution), `docs/design/interfaces/events-catalog.md` (`BusinessCreated`, `MembershipCreated`, `MembershipSuspended`)
- Constraints: new service `services/notifications` in the `notifications` schema, non-superuser role `notifications_app`; follows the existing service layout (`identity`/`tenancy`/`catalog`/`inventory`) — `@pos/nest-common` bootstrap, outbox + `processed_events`, `/healthz` + `/readyz`, Dockerfile; it is a **worker** (no public HTTP surface beyond health); idempotent consumers keyed on `event_id`; `notification_contact` is a read-only projection — never written from anything but its three source events; no sync calls to `tenancy`.
- Do not touch: `services/inventory` domain logic, `catalog`, `tenancy`, `identity`, `web/`, `mobile/`.

## Objective

Stand up `services/notifications` with the `notification` + `notification_contact` schema and the contact-projection consumers for `BusinessCreated` / `MembershipCreated` / `MembershipSuspended`.

## Scope Boundary

**In scope:**
- `services/notifications/` scaffold: `package.json` (`@pos/notifications`), Nest app, `@pos/nest-common` wiring, config/env (`NOTIFICATIONS_DATABASE_URL`, NATS), `main.ts`, `HealthModule`, multi-stage `Dockerfile`, `vitest.config.ts`.
- Prisma schema + init migration: `notification` (per data-model, incl. `attempts`, `last_error`), `notification_contact` (`business_id`, `user_id`, `role`, `email`, `locale`, `active`, unique `(business_id, user_id)`), `outbox`, `processed_events`. RLS on tenant tables.
- `ContactProjectionConsumer`: `BusinessCreated` → upsert owner contact (`role='owner'`, `active=true`); `MembershipCreated` → upsert contact; `MembershipSuspended` → set `active=false`. Idempotent on `event_id`.
- `infra/docker-compose.yml` + `infra/postgres/initdb` role/schema + `infra/k8s/base` worker manifest (Service/HPA-on-CPU dropped per the template) + Kong: no route (worker).
- `.github/workflows/ci.yml` per-service job for `notifications`.
- Unit/e2e: projection consumer with `@pos/testing` in-memory bus.

**Out of scope:**
- Low-stock consumer + `EmailSender` — T-0204.
- Digest flush — T-0205.
- Templates — T-0206.
- `invitation` / `winger_authorized` delivery (wired by their own phases).

## Acceptance Criteria

- `pnpm --filter @pos/notifications build` and `test` pass; `docker compose config` stays valid with the `notifications` service + `notifications` DB role.
- `kubectl kustomize infra/k8s/base` renders including the `notifications` worker; `kong config parse` unchanged (no new route).
- Consuming `BusinessCreated` then `MembershipCreated` for the same `(business_id, user_id)` yields exactly one `notification_contact` row with the latest `role`/`email`/`locale`.
- Re-delivering any of the three events with the same `event_id` produces no additional state change.
- `MembershipSuspended` sets `active=false`; a later `MembershipCreated` for that pair sets it back to `active=true`.
- `notifications` Prisma schema references no other service's tables (static check in CI).

## Dependencies

- None for the scaffold; the projection payload fields land in T-0202-adjacent contract work — this task consumes `MembershipCreated`/`BusinessCreated` with `email`/`locale`, so land the `@pos/contracts` additions for those two events here if not already present.

## Implementation Checklist

1. Scaffold `services/notifications` from the `catalog`/`inventory` shape.
2. `@pos/contracts`: add `email`/`locale` to `membershipCreatedPayload`; `owner_email`/`owner_locale` to `businessCreatedPayload` (additive, minor bump) + round-trip tests, if not delivered by T-0202.
3. Prisma schema + init migration + RLS.
4. `ContactProjectionConsumer` (3 handlers) + idempotency.
5. infra: compose, initdb role, k8s worker manifest, CI job.
6. Tests with in-memory bus; `pnpm -r build/test/lint`; `kustomize`; validator.

## Verification

Delivered:

- `services/notifications/` scaffold cloned from `catalog`/`inventory`: Nest app
  (`main.ts`, `app.module.ts`), `config/env.ts` (`NOTIFICATIONS_PORT` 3007,
  `NOTIFICATIONS_DATABASE_URL`, `NATS_URL`), `PlatformModule` (NATS `name:
  'notifications'`), `PrismaModule`/`PrismaService`, `HealthModule`
  (`/healthz` + `/readyz`), multi-stage `Dockerfile`, `vitest.config.ts`,
  `oxlint.json`.
- Prisma init migration `20260906140000_init`: `notification` (incl. `attempts`,
  `last_error`, unique `(business_id, dedupe_key)`), `notification_contact`
  (`role`, `email?`, `locale` default `en`, `active`, unique
  `(business_id, user_id)`), `outbox`, `processed_events`; forced tenant RLS on
  `notification` + `notification_contact`. Applied via `prisma migrate deploy`.
- `ContactProjectionConsumer` + `ContactService`: `BusinessCreated` → upsert
  owner contact (`role='owner'`, `active=true`, locale from `owner_locale ??
  business locale`); `MembershipCreated` → upsert; `MembershipSuspended` →
  `active=false`. Each `runIdempotent` on `event_id`, `subscribeWithDlq`
  (`maxDeliver: 5`, `pos.dlq.tenancy.*`).
- `@pos/contracts` (part of the v1.1 additive set): `membershipCreatedPayload`
  gains optional `email` + `locale`; `businessCreatedPayload` gains optional
  `owner_email` + `owner_locale`. Optional so `tenancy`'s current emit still
  validates and `catalog`/`inventory` consumers keep parsing — `tenancy`
  enrichment is a backlog item.
- infra: `docker-compose.yml` `notifications` worker service;
  `infra/k8s/base/notifications.yaml` (Deployment + PDB only, no Service/HPA);
  added to `kustomization.yaml` + `secret.example.yaml`;
  `.github/workflows/ci.yml` matrix entry + `NOTIFICATIONS_DATABASE_URL` in the
  migrate + lint/test/build steps. No Kong route (worker). `notifications` role
  + schema already in `infra/postgres/initdb/20-service-schemas.sql`.

Evidence:

- `pnpm --filter @pos/notifications test` → 5 passed
  (`test/contact-projection.e2e-spec.ts`): owner seed from `BusinessCreated`;
  `MembershipCreated` upsert keeps one row on role/email change; same
  `event_id` twice → one `processed_events` row; suspend→deactivate then
  re-create→reactivate; `BusinessCreated` without `owner_email` → `email: null`,
  locale falls back to the business locale.
- `pnpm --filter @pos/notifications build` + `lint` clean; `prettier` +
  `prisma format` clean.
- `docker compose -f infra/docker-compose.yml config` valid.
  `kubectl kustomize` / `kong config parse` covered by the `edge` CI job
  (kubectl not installed locally).
- Backend suites green: contracts 7, nest-common 16, testing 5, identity 7,
  tenancy 9, catalog 11, inventory 22, notifications 5.
- `node scripts/check-contracts-compat.mjs HEAD` → OK.
- `python3 .agents/workflows/workflow-contract/scripts/validate_workflow.py` → `WORKFLOW:ok`.
