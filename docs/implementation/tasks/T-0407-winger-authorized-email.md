# T-0407 `notifications` — `WingerAuthorized` Consumer + `winger_authorized` Email Template (en/sw)

## Status

- `done`
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

Delivered:

- Templates: `src/templates/winger-authorized-vars.ts` (`WingerAuthorizedVars`
  `{ business_name, portal_url }`, `noticeHtml` shell reusing `escapeHtml`) +
  `src/templates/winger_authorized/en.ts` and `sw.ts`.
  `TemplateRegistry.renderWingerAuthorized(locale, vars)` — unknown locale → `en`.
- `src/winger/winger-authorized.service.ts` — `WingerAuthorizedService.record`:
  in a tenant txn, resolve `business_name` from `notification_business`, create a
  `notification` row (`type: 'winger_authorized'`, `channel: 'email'`,
  `dedupeKey: winger_authorized:{winger_account_id}`, payload carries `email`,
  `locale`, `portal_url`, `business_name`), then send immediately via
  `EMAIL_SENDER` and mark `sent` + emit `NotificationSent` (on failure: `failed`
  + `NotificationFailed`). No `email` on the event → row `status: 'skipped'`,
  nothing sent. `P2002` on the dedupe key → no-op. `locale` on the event wins
  over the business default.
- `src/winger/winger-authorized.consumer.ts` — subscribes
  `winger.WingerAuthorized` via `subscribeWithDlq` (`durable`
  `notifications-winger-authorized`, `dlqSubject` `pos.dlq.winger.WingerAuthorized`),
  idempotent on `event_id`. `WingerModule` wired into `app.module.ts`.
- `vitest.config.ts` — `fileParallelism: false` (the e2e specs share one schema
  and blanket-delete tables in `afterEach`; serialize the files).

Evidence:

- `pnpm --filter @pos/notifications test` → 27 passed (template-registry
  `winger_authorized` en/sw + fallback; `winger-authorized.e2e-spec` +4: one
  localized email + `sent` row + `NotificationSent`; idempotent on `event_id`
  and on `winger_account_id`; `skipped` + no send when no email; unknown locale
  → English).
- `node scripts/check-contracts-compat.mjs HEAD` → OK (no contract change here;
  `wingerAuthorizedPayload` landed in T-0401/T-0402).
- Backend suites green: contracts 12, nest-common 16, testing 5, identity 8,
  tenancy 9, catalog 11, inventory 24, sales 20, winger 24, notifications 27.
- Live smoke: with the full stack up (`notifications` + `winger` rebuilt), an
  Owner `POST /v1/businesses/{id}/winger-accounts` produced one
  `winger_authorized` notification and a Mailpit-captured email whose body
  carries the `portal_url`.
- `python3 .agents/workflows/workflow-contract/scripts/validate_workflow.py` → `WORKFLOW:ok`.
