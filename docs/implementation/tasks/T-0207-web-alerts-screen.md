# T-0207 Web — `/alerts` Screen

## Status

- `pending`
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

- Manual: Owner load → edit → save → reload shows persisted values; Staff → `Forbidden`. Capture in the task PR notes.
- `pnpm --filter web lint` + `pnpm --filter web build` green.
- `python3 .agents/workflows/workflow-contract/scripts/validate_workflow.py` → `WORKFLOW:ok`.
