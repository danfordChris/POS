# T-0609 Invoicing — Isolation + RLS Backstop + Acceptance Walk-through

## Status

- `pending`
- Last updated: 2026-09-07

## Linked Phase

- Phase 07 — Invoicing and Credit Sales

## Agent Context

- Skills: backend, workflow-contract
- Design docs: `docs/design/product/invoicing-and-credit.md` (Acceptance
  Criteria), `docs/implementation/status/acceptance-map.md`,
  `docs/implementation/status/rls-policy-matrix.md`, Phase 06 tasks T-0503 /
  T-0504 (isolation + RLS-backstop patterns), T-0509 (`acceptance-smoke.sh`)
- Constraints: extend the existing suites, do not re-implement them; the new
  routes/tables slot into the same enumerations; `invoice` is relaxed-read
  (public `/i/{token}`) so it is classified `RELAXED` in the RLS matrix like
  `receipt`; the acceptance walk-through runs through the local Kong edge and
  the new `media` service.
- Do not touch: feature behaviour (fixes for anything this surfaces are separate
  follow-ups unless trivial).

## Objective

Prove tenant isolation and the RLS backstop for every new invoicing table and
route, and add a credit-sale → invoice → PDF → payment → `paid` walk-through
(U14/U15) to the acceptance smoke and CI.

## Scope Boundary

**In scope:**
- `services/sales/test/isolation.e2e-spec.ts` — add
  `/v1/businesses/{id}/customers*` and `/v1/businesses/{id}/invoices*` (+
  `/payments`, `/void`, `/pdf`) to the enumerated routes: wrong-business /
  operator / roleless → `403`, positive control not-`403`.
- `services/sales/test/rls-backstop.e2e-spec.ts` — add `customer`, `invoice`
  (RELAXED), `invoice_line`, `payment` with INSERT SQL; assert strict tables read
  0 unscoped / 0 foreign, relaxed reads visible-unscoped / 0 foreign, every
  cross-tenant INSERT rejected.
- `services/media/test/isolation.e2e-spec.ts` + `rls-backstop.e2e-spec.ts` — the
  `/pdf` routes and the `document` table (strict).
- `infra/acceptance-smoke.sh` — after U13: **U14** create a customer + credit
  sale → assert one `issued` invoice, `balance_due == total`, `GET /v1/i/{token}`
  `200` logged-out; poll `/v1/i/{token}/pdf` to `200`; **U15** record a payment
  for the full balance → invoice `paid`, customer balance `0`; a cross-business
  `GET /v1/businesses/{other}/invoices/{id}` → `403`.
- `.github/workflows/ci.yml` — ensure `media` is in the `service` matrix and the
  acceptance job (from T-0605); no further change if already done.
- `docs/implementation/status/acceptance-map.md` — U14/U15 rows + the new specs.
- `docs/implementation/status/rls-policy-matrix.md` — the new tables.
- `docs/implementation/phases/phase-07-invoicing-and-credit.md` — tick Tasks +
  Acceptance Criteria; set Status `done`.
- `docs/implementation/status/weekly-status.md` — Phase 07 outcome entry.
- `docs/implementation/project.md` — Phase 07 line under Active Phases.

**Out of scope:**
- New product behaviour.
- The full acceptance re-verification pass (that is the user-triggered
  Phase-07-acceptance step, mirroring Phase 06).

## Acceptance Criteria

- `services/sales` and `services/media` isolation specs enumerate every new
  route and assert `403` for wrong-business / operator / roleless plus a
  positive control.
- The RLS-backstop specs cover `customer`, `invoice`, `invoice_line`, `payment`,
  `document`; a no-context query returns 0 rows for strict tables and only
  unscoped-own rows for `invoice`; every cross-tenant INSERT is rejected.
- `bash infra/acceptance-smoke.sh` against the local stack passes including the
  new U14/U15 steps.
- `.github/workflows/ci.yml` runs `service (media)` and the acceptance job
  green; `check-contracts-compat.mjs HEAD` OK.
- `acceptance-map.md` maps U14/U15 to the asserting spec/job; `rls-policy-matrix.md`
  lists the new tables with their classification.
- The Phase 07 doc is `done` with all boxes ticked; `weekly-status.md` and
  `project.md` record the outcome.
- `python3 .agents/workflows/workflow-contract/scripts/validate_workflow.py` →
  `WORKFLOW:ok`.

## Dependencies

- T-0601 … T-0606 (behaviour + `media`); T-0607 / T-0608 may land in parallel
  (not required for this task's assertions).

## Implementation Checklist

1. Extend `services/sales` isolation + rls-backstop specs.
2. Add `services/media` isolation + rls-backstop specs.
3. Add U14/U15 to `infra/acceptance-smoke.sh`; run it locally.
4. Confirm CI `media` matrix + acceptance wiring.
5. Update `acceptance-map.md`, `rls-policy-matrix.md`.
6. Close the phase doc; update `weekly-status.md` + `project.md`.
7. `check-contracts-compat.mjs`; validator.

## Verification

_Planned — to be filled on completion:_

- `pnpm --filter @pos/sales --filter @pos/media test` (isolation + rls-backstop).
- `bash infra/acceptance-smoke.sh` → all stories incl. U14/U15.
- CI run green (`service (media)` + `acceptance`).
- `node scripts/check-contracts-compat.mjs HEAD`; `validate_workflow.py` →
  `WORKFLOW:ok`.
