# T-0407 `notifications` — `WingerAuthorized` Consumer + `winger_authorized` Email Template (en/sw)

## Status

- `pending`
- Last updated: 2026-09-07

## Linked Phase

- Phase 05 — Winger Portal

## Agent Context

- Skills: backend, workflow-contract
- Design docs: `docs/design/interfaces/events-catalog.md` (`WingerAuthorized` payload: `business_id`, `winger_account_id`, `user_id`, `portal_url`, `email`, `locale`), `docs/design/architecture/service-decomposition.md` (`notifications` consumes `WingerAuthorized`), `docs/design/data/data-model.md` (`notification` type `winger_authorized`)
- Constraints: `services/notifications` only; reuse the Phase 03 pattern — `subscribeWithDlq` consumer, idempotent on `event_id`, write a `notification` row (`type: 'winger_authorized'`, `channel: 'email'`, `dedupe_key = winger_account_id`), then the existing send path picks it up; templates live beside the low-stock templates with a registry entry per locale; template unit test runs under `src/**/*.spec.ts`; recipient is the `email` on the event (fall back to a `notification_contact` lookup only if `email` is absent); `locale` on the event selects `en` / `sw`, default `en`.
- Do not touch: `services/winger` (it emits the event — T-0402); other services; `web/`, `mobile/`.

## Objective

When `WingerAuthorized` is published, `notifications` sends the newly authorized reseller a localized "you've been authorized" email with the portal link.

## Scope Boundary

**In scope:**
- `services/notifications`: `WingerAuthorizedConsumer` — subscribe `pos.evt.winger.WingerAuthorized` with a durable + `dlqSubject`; idempotent on `event_id`; insert a `notification` row scoped to `business_id` with the rendered payload and `dedupe_key = winger_account_id`.
- `src/templates/winger-authorized.en.*` and `winger-authorized.sw.*` (subject + body) + registry entries; variables: `portal_url`, `business_name` (from the `notification_business` projection), reseller name.
- Wire the consumer into the notifications app module.
- Tests: consumer e2e (event → one `notification` row; duplicate `event_id` → still one; missing `email` path), template-registry spec asserting both locales resolve and render with the expected variables.

**Out of scope:**
- `WingerSuspended` notification (design routes it to the edge cache-bust, not email).
- SMS (deferred phase).
- Any change to the shared send/retry loop.

## Acceptance Criteria

- Publishing `WingerAuthorized` with `locale: "sw"` creates exactly one `notification` row (`type: 'winger_authorized'`, `channel: 'email'`) rendered from the `sw` template.
- Re-publishing the same event (`event_id`) creates no second row.
- `locale` absent or unknown renders the `en` template.
- The rendered body contains the `portal_url` from the event.
- `template-registry` spec passes for `winger-authorized` in `en` and `sw`.
- `pnpm --filter @pos/notifications test` green; `node scripts/check-contracts-compat.mjs HEAD` → OK (no contract change here — payload landed in T-0401).

## Dependencies

- T-0401 (`wingerAuthorizedPayload` + `SUBJECTS.winger` in `@pos/contracts`).
- T-0402 (emits `WingerAuthorized`) — needed for the live smoke, not for unit tests.

## Implementation Checklist

1. `WingerAuthorizedConsumer` + module registration.
2. `winger-authorized` en/sw templates + registry entries.
3. Consumer e2e specs + template-registry spec.
4. `pnpm --filter @pos/notifications test`; `check-contracts-compat.mjs`; validator.

## Verification

Run and capture:

- `pnpm --filter @pos/notifications test` — consumer idempotency + locale selection + template-registry specs green.
- Live smoke: authorize a winger via `POST /v1/businesses/{id}/winger-accounts` (T-0402) with the notifications container running; confirm one `winger_authorized` `notification` row and a captured/sent email containing the portal URL.
- `python3 .agents/workflows/workflow-contract/scripts/validate_workflow.py` → `WORKFLOW:ok`.
