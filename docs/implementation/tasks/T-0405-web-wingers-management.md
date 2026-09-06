# T-0405 Web `/wingers` — Authorize, Suspend, Winger Price, Product Images

## Status

- `pending`
- Last updated: 2026-09-07

## Linked Phase

- Phase 05 — Winger Portal

## Agent Context

- Skills: mobile (n/a), workflow-contract
- Design docs: `docs/design/interfaces/api-contract.md` (Winger section; product write price fields), `docs/design/product/roles-and-permissions.md` (Owner authorizes wingers; Staff price fields dropped server-side)
- Constraints: Next.js App Router under `web/app/(shell)/wingers/`; server components + server actions calling `lib/tenant-api.ts` (`tenantGet` / `tenantSend`); Owner-only page — gate with `getSession()` and render `<Forbidden />` for non-owners; reuse `components/ui/*` (`Card`, `Button`, `Badge`, `EmptyState`, `ErrorCard`, `Input`); errors surface via `<ErrorCard code title body>`; no new API endpoints — consume T-0402/T-0404 and the existing catalog product endpoints.
- Do not touch: `services/*`; `mobile/`; the auth/session module.

## Objective

Give an Owner a `/wingers` screen to authorize a reseller by email/phone, see and toggle account status, set each product's winger price, and upload product images.

## Scope Boundary

**In scope:**
- `web/app/(shell)/wingers/page.tsx` — server component: `tenantGet('/winger-accounts')` list (email/name, status `<Badge>`, authorized date); `<EmptyState>` when none.
- `web/app/(shell)/wingers/actions.ts` — server actions: `authorizeWinger` (`POST /winger-accounts` with `{ email | phone }`; map `409` → "already a staff member", `503` → upstream), `setWingerStatus` (`PATCH .../winger-accounts/{id}` `{ status }`), `setWingerPrice` (`PATCH /products/{id}` with `winger_price` — minor units or `null` to clear), `uploadProductImage` (multipart to the catalog image endpoint). `revalidatePath` on success.
- `web/components/wingers/AuthorizeWingerForm.tsx` — client form (`useActionState`), one field with an email/phone toggle.
- `web/components/wingers/WingerStatusButton.tsx` — suspend/reactivate with a `confirm`.
- `web/app/(shell)/wingers/pricing/page.tsx` (or a tab on `/wingers`) — product list with an editable `winger_price` cell (blank = falls back to retail) and an image upload control; shows the resolved price hint.
- `web/lib/models.ts` — `WingerAccount` type; extend the product type with `winger_price` / `image_url` if missing.
- Nav entry for `/wingers` (Owner-only) in the shell sidebar.
- `web/app/(shell)/wingers/loading.tsx`.

**Out of scope:**
- The winger-facing catalog view (that is the mobile app, T-0406).
- Any server-side behavior change.

## Acceptance Criteria

- Visiting `/wingers` as a non-owner renders `<Forbidden />`; as an owner, the account list renders.
- Submitting the authorize form with an email calls `POST /winger-accounts`; a `409` response shows an inline "already a staff member in this business" error and the list is unchanged.
- The suspend button on an active account calls `PATCH .../winger-accounts/{id}` `{ status: "suspended" }` after a `confirm`, and the badge flips to `suspended` after revalidation.
- Editing a product's winger price to a value calls `PATCH /products/{id}` with `winger_price` in minor units; clearing it sends `null`.
- Selecting an image file for a product uploads it to the catalog image endpoint and the thumbnail updates after revalidation.
- `pnpm --filter web lint` + `pnpm --filter web build` pass.

## Dependencies

- T-0402 (winger-account endpoints). T-0404 not required for this screen. Catalog product + image endpoints exist from Phase 02.

## Implementation Checklist

1. `models.ts` types; nav entry.
2. `wingers/page.tsx` + `loading.tsx` + `actions.ts`.
3. `AuthorizeWingerForm` + `WingerStatusButton` client components.
4. Pricing/images view with editable `winger_price` cell + upload control.
5. `pnpm --filter web lint && build`; validator.

## Verification

Run and capture:

- `pnpm --filter web lint && pnpm --filter web build` — clean.
- Manual walkthrough against a local stack: authorize a winger, suspend/reactivate, set and clear a winger price, upload a product image; confirm each network call and the post-revalidation UI.
- `python3 .agents/workflows/workflow-contract/scripts/validate_workflow.py` → `WORKFLOW:ok`.
