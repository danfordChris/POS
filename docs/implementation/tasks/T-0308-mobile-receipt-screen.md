# T-0308 Mobile — Receipt Screen

## Status

- `pending`
- Last updated: 2026-09-07

## Linked Phase

- Phase 04 — Sales and Digital Receipts

## Agent Context

- Skills: mobile, workflow-contract
- Design docs: `docs/design/interfaces/mobile-app-spec.md` (Receipt screen: "Sale summary, shareable link, QR of link" / "Share sheet; new sale"), `docs/design/data/data-model.md` (`receipt.public_token`), `docs/design/interfaces/api-contract.md` (`GET /v1/r/{token}`)
- Constraints: repo Flutter architecture (`AppRoute` route, `provider`, static service, `Neu*` kit, `DukaColors.of(context)`, absolute imports); the shareable link is `${API_BASE_URL or web base}/v1/r/{public_token}` — a single source-of-truth builder, no string literals scattered; QR rendered locally from that link; share via the platform share sheet; the screen shows the sale summary from the `POST /sales` response (no extra fetch needed) but MAY re-fetch `GET /r/{token}` to confirm; "New sale" clears the cart and returns to Sell.
- Do not touch: `services/*`, `web/`.

## Objective

Add the Receipt screen reached after a completed sale: summary + shareable link + QR + share sheet.

## Scope Boundary

**In scope:**
- `lib/core/` — a `receiptUrl(String publicToken)` builder (reads the configured base URL once).
- `lib/features/sell/screens/receipt_screen.dart` — `AppRoute.receipt` (param: `saleId` or the sale object via `extra`): business name, line list (name × qty, line total), subtotal / discount / total, timestamp, sale number; a QR of `receiptUrl(token)` (add a QR package to `pubspec.yaml` — e.g. `qr_flutter`); "Share link" (platform share sheet — add `share_plus`) and "New sale" actions.
- Router: register `AppRoute.receipt`; wire T-0307's success navigation to it.
- Guard: if opened without a sale in `extra` and only a `saleId`, fetch via `SalesService.getSale`; show the error-by-code card on failure.

**Out of scope:**
- Printing / PDF (post-MVP).
- Editing a completed sale.

## Acceptance Criteria

- After completing a sale the Receipt screen shows the correct business name, lines, totals, timestamp, and sale number.
- The QR encodes exactly `receiptUrl(public_token)`; the "Share link" action opens the OS share sheet with that URL.
- "New sale" returns to an empty Sell screen.
- Opening the route with only a `saleId` fetches the sale; a fetch failure shows the `error.code` card, not a stack trace.
- `flutter analyze` clean; `flutter test` green (widget test: renders totals + a QR widget + a share button; `receiptUrl` builds the expected string).

## Dependencies

- T-0305 (public receipt endpoint + token), T-0307 (sell flow navigates here)

## Implementation Checklist

1. Add `qr_flutter` + `share_plus` to `mobile/pubspec.yaml`; `pub get`.
2. `receiptUrl` builder.
3. `receipt_screen.dart` (summary + QR + share + new-sale) + `AppRoute.receipt`.
4. Wire T-0307 success → receipt; `saleId`-only fetch fallback.
5. Widget test: totals render, QR + share present, `receiptUrl` output.
6. `flutter analyze` + `flutter test`; validator.

## Verification

- `mobile/test/*` — receipt widget test + `receiptUrl` unit test.
- `cd mobile && flutter analyze` → no issues; `flutter test` green.
- `python3 .agents/workflows/workflow-contract/scripts/validate_workflow.py` → `WORKFLOW:ok`.
