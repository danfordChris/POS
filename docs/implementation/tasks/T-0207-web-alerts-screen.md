# T-0207 Web — `/alerts` Screen

## Status

- `done`
- Last updated: 2026-09-06

## Linked Phase

- Phase 03 — Reorder Alerts

## Agent Context

- Skills: workflow-contract
- Design docs: `docs/design/interfaces/web-app-spec.md` (`/alerts` row), `docs/design/interfaces/api-contract.md` (Alerts section), `docs/design/interfaces/ui-design-system.md`, `docs/design/integrations/notifications.md`
- Constraints: `/alerts` is Owner-only — Staff get the existing `Forbidden` view; browser never holds a token (httpOnly cookies + server actions / tenant-api client, as in T-0109/T-0120); all API failures surface via the error-by-code component; neumorphic kit only, no hard-coded colors/radii; form uses the existing `TextField` / `Button` / `SegmentedControl` primitives.
- Do not touch: `services/*`, `mobile/`, auth/proxy plumbing.

## Objective

Add the Owner-only `/alerts` page to `web/`: view and edit `alert-config` (recipients, min interval) against `GET`/`PUT /v1/businesses/{businessId}/alert-config`.

## Scope Boundary

**In scope:**
- Route `web/app/(shell)/alerts/page.tsx` + `loading.tsx` skeleton; sidebar "Manage" link (Owner-only, already hidden for Staff).
- Server read of `alert-config` via the tenant-scoped Kong client (`lib/tenant-api.ts`); server action for `PUT`.
- Form: `recipients` (list of emails; add/remove rows; empty = "all owners" helper text), `min_interval_hours` (number, min 1). Client-side validation mirrors the API (`400` still rendered via error-by-code).
- Success + error toasts/inline states using existing components.
- Staff hitting `/alerts` → `Forbidden` (server-side role guard, same pattern as other Owner-only routes).

**Out of scope:**
- A notifications history/list view (not in the spec row; `notification` has no public endpoint).
- Any mobile screen.
- Changes to `inventory` (T-0201 owns the endpoint).

## Acceptance Criteria

- As Owner, `/alerts` renders the current `recipients` and `min_interval_hours` from `GET /alert-config`; first visit shows the defaults (`[]`, `24`) with the "defaults to all owners" helper.
- Editing recipients + saving issues `PUT /alert-config` and, after reload, the page shows the saved values.
- `min_interval_hours` below 1 or a malformed email is blocked client-side; a server `400 validation_error` is shown via the error-by-code component.
- As Staff, `/alerts` renders `Forbidden` and issues no `PUT`.
- `pnpm --filter web lint` and `pnpm --filter web build` pass; no hard-coded color/radius/shadow literals in the new files.

## Dependencies

- T-0201

## Implementation Checklist

1. Route + `loading.tsx` + sidebar link (Owner-only).
2. `lib/tenant-api.ts` read + server action for `alert-config`.
3. Form UI with the neumorphic primitives + client validation.
4. Role guard → `Forbidden` for Staff.
5. Success/error states via existing components.
6. `pnpm --filter web lint` + `build`; validator.

## Verification

Delivered:

- `web/app/(shell)/alerts/page.tsx` — server component: `getSession()`,
  `role !== 'owner'` → `<Forbidden />` (same per-page pattern as
  `settings`/`members`); `tenantGet('/alert-config')` in try/catch → `<ErrorCard>`
  on failure; renders `<AlertConfigForm initial={config} />`.
- `web/app/(shell)/alerts/actions.ts` — `saveAlertConfig` server action: parses
  the repeated `recipients` fields + `min_interval_hours`, mirrors the API rules
  (int ≥ 1, email shape), `tenantSend('PUT', '/alert-config', …)`, `ApiError` →
  `{ error: { code, message } }`, success → `revalidatePath('/alerts')` +
  `{ ok, config }`.
- `web/components/alerts/AlertConfigForm.tsx` — client: dynamic recipient rows
  (add / remove, min one), `min_interval_hours` number field, `onSubmit`
  client-guard (blocks a bad interval / email before the round-trip, shows
  `<ErrorCard code="validation_error">`), "empty ⇒ all Owners" helper,
  `useActionState` for pending + server error / success. Neumorphic primitives
  only (`Card`, `TextField`, `Button`, `ErrorCard`); no color/radius/shadow
  literals.
- `web/app/(shell)/alerts/loading.tsx` skeleton. `AlertConfig` type added to
  `web/lib/models.ts`. Sidebar `/alerts` link already Owner-only in `lib/nav.ts`.

Evidence:

- `pnpm --filter web lint` clean; `pnpm --filter web build` → exit 0
  (`/alerts` listed as `ƒ` dynamic). `grep` for
  `#hex | rgb() | shadow-[ | rounded-[` in the new files → none.
- Live data-path smoke through Kong (`:8000`, local stack) — the exact calls the
  page + action make:
  - `GET /v1/businesses/{id}/alert-config` (fresh business) →
    `{"recipients":[],"min_interval_hours":24,"updated_at":…}` (default render).
  - `PUT {"recipients":["ops@shop.co.tz"],"min_interval_hours":6}` → echoes saved;
    a follow-up `GET` returns the persisted values (edit → save → reload).
  - `PUT {"min_interval_hours":0}` → `400 validation_error` (rendered via
    `ErrorCard`).
  - (Required a local `inventory` image rebuild + Kong reload — the running
    containers predated T-0201.)
- Staff path: `page.tsx` returns `<Forbidden />` for `role !== 'owner'` and the
  form (and its action) never mount — verified by the guard being identical to
  the shipped `settings` / `members` pages.
- `python3 .agents/workflows/workflow-contract/scripts/validate_workflow.py` → `WORKFLOW:ok`.
