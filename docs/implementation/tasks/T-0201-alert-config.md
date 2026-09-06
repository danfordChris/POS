# T-0201 Inventory — Alert Config Model + Endpoints

## Status

- `pending`
- Last updated: 2026-09-06

## Linked Phase

- Phase 03 — Reorder Alerts

## Agent Context

- Skills: backend, workflow-contract
- Design docs: `docs/design/interfaces/api-contract.md` (Alerts section), `docs/design/data/data-model.md` (`alert_config`), `docs/design/integrations/notifications.md` (Recipient resolution), `docs/design/architecture/service-decomposition.md` (`inventory` row)
- Constraints: `alert_config` lives in the `inventory` schema with forced tenant RLS; one row per business; endpoints behind `InternalContextGuard` + `TenantGuard` + `RolesGuard` (Owner only); `recipients` stored as JSON array of user-ids or emails; `min_interval_hours` integer ≥ 1, default 24; GET auto-creates the default row if absent; never return another tenant's config.
- Do not touch: `services/notifications` (T-0203), `catalog`, `tenancy`, `identity`, `mobile/`, `web/`.

## Objective

Add the `alert_config` table and `GET`/`PUT /v1/businesses/{businessId}/alert-config` (Owner) to `services/inventory`.

## Scope Boundary

**In scope:**
- Prisma model `AlertConfig` in `services/inventory/prisma/schema.prisma` (`id`, `business_id`, `recipients` Json default `[]`, `min_interval_hours` Int default 24), unique on `business_id`, RLS via `enable_tenant_rls()`.
- Migration in `services/inventory/prisma/migrations/`.
- `AlertConfigService` (get-or-create default; update with validation) + `AlertConfigController` (`GET`, `PUT`) in a new `services/inventory/src/alert-config/` module, registered in `app.module.ts`.
- DTO: `PutAlertConfigDto` (`recipients: (uuid|email)[]`, `min_interval_hours: int >= 1`).
- e2e coverage in `services/inventory/test/`.

**Out of scope:**
- Emitting `recipients` on events — T-0202.
- Any consumption of the config — T-0204 / T-0205.
- `BusinessCreated` seeding a default row (lazy get-or-create is sufficient for MVP).

## Acceptance Criteria

- `GET /v1/businesses/{businessId}/alert-config` as Owner returns `200 { recipients: [], min_interval_hours: 24 }` for a business that never set one, and persists that default row.
- `GET`/`PUT` as Staff return `403 role_forbidden`; with no membership return `403 not_a_member`.
- `PUT` with `{ recipients: ["a@b.com"], min_interval_hours: 6 }` returns `200` echoing the saved config; a follow-up `GET` returns the same.
- `PUT` with `min_interval_hours: 0` or a non-email / non-uuid entry in `recipients` returns `400 validation_error`.
- A second business's `GET` never returns the first business's `recipients`.

## Dependencies

- None (Phase 02 `inventory` is `done`).

## Implementation Checklist

1. Add `AlertConfig` model + migration; wire RLS.
2. `AlertConfigService.get` (get-or-create) and `.put` (validate + upsert).
3. `AlertConfigController` `GET` / `PUT` with Owner `RolesGuard`.
4. Register the module; add response view mapper.
5. e2e: default create, Owner/Staff/non-member matrix, validation, tenant isolation.
6. `pnpm --filter @pos/inventory test` + `pnpm -r build/lint`; validator.

## Verification

- `services/inventory/test/*` covers the criteria above (new `alert-config.e2e-spec.ts` or an added block).
- `pnpm --filter @pos/inventory test` green; `pnpm -r build` green.
- `python3 .agents/workflows/workflow-contract/scripts/validate_workflow.py` → `WORKFLOW:ok`.
