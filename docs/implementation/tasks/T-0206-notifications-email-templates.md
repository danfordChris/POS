# T-0206 Notifications — Localized Low-Stock Templates + Capture Test

## Status

- `pending`
- Last updated: 2026-09-06

## Linked Phase

- Phase 03 — Reorder Alerts

## Agent Context

- Skills: backend, workflow-contract
- Design docs: `docs/design/integrations/notifications.md` (Events → templates, Localization), `docs/design/product/roles-and-permissions.md`, `docs/design/interfaces/web-app-spec.md` (`/catalog` deep link target)
- Constraints: template rendered in the business `locale` (`en` / `sw`) resolved from `notification_contact` / event; body carries business name, product name(s), on-hand, threshold, and a catalog deep link; both a plaintext and minimal HTML part; no secrets or tokens in the body; `EmailSender` local (Mailpit) capture is the test oracle — assert on the captured message, not a live inbox; templates are data/files, not code branches per locale.
- Do not touch: `services/inventory`, digest scheduling logic (T-0205), send/retry logic (T-0204), `web/`, `mobile/`.

## Objective

Provide `en` and `sw` low-stock templates (single-product and digest) and a Mailpit capture test proving locale-correct rendering.

## Scope Boundary

**In scope:**
- `services/notifications/src/templates/low_stock/{en,sw}.{txt,html}` (or a single localized template module) + a `TemplateRegistry.render(type, locale, vars)` used by the send worker and the digest job.
- `vars` contract: `{ business_name, catalog_url, items: [{ product_name, on_hand, threshold }] }` (one item = single-product copy, many = digest copy).
- Locale fallback: unknown/missing locale → `en`.
- Wire the registry into T-0204's `SendWorker` and T-0205's `DigestFlushJob` (replace their placeholder strings).
- `EmailSender` capture test asserting subject + body substrings for `en` and `sw`, single and digest.
- `infra` Mailpit already present — an integration test that actually sends to Mailpit `:1025` and reads `:8025` is optional; the capture-impl assertion is required.

**Out of scope:**
- `invitation` / `winger_authorized` templates (their phases).
- Rich HTML design / branding polish.
- New string extraction tooling — inline localized strings are acceptable for two locales.

## Acceptance Criteria

- `TemplateRegistry.render('low_stock', 'sw', vars)` returns a body containing the Swahili copy and the `catalog_url`; `'en'` returns the English copy; an unknown locale returns the English copy.
- Single-item `vars` renders single-product subject/body; multi-item `vars` renders the digest subject/body listing every product with its `on_hand` / `threshold`.
- The send worker and digest job use `TemplateRegistry` (no inline body strings remain in either).
- A capture-`EmailSender` test asserts the rendered `en` and `sw` bodies for both single and digest cases.
- No template contains a token, password, or internal URL.

## Dependencies

- T-0204, T-0205

## Implementation Checklist

1. `TemplateRegistry` + `en`/`sw` low-stock single + digest templates.
2. Locale resolution + `en` fallback.
3. Replace placeholder strings in `SendWorker` and `DigestFlushJob`.
4. Capture-`EmailSender` tests for the four (locale × shape) combinations.
5. Optional Mailpit round-trip test.
6. `pnpm --filter @pos/notifications test`, `pnpm -r build/lint`; validator.

## Verification

- `services/notifications/test/*` asserts locale-correct single and digest bodies via the capture `EmailSender`.
- `pnpm --filter @pos/notifications test` green; `pnpm -r build` green.
- `python3 .agents/workflows/workflow-contract/scripts/validate_workflow.py` → `WORKFLOW:ok`.
