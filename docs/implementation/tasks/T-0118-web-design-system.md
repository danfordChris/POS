# T-0118 Web — Neumorphic Design System Foundation

## Status

- `done`
- Last updated: 2026-09-02

## Linked Phase

- Phase 02 — Inventory Core (client foundation; unblocks T-0106–T-0109 web work)

## Agent Context

- Skills: workflow-contract
- Design docs: `docs/design/interfaces/ui-design-system.md`, `docs/design/interfaces/web-app-spec.md`, `docs/design/interfaces/design_handoff_neumorphic_system/` (tokens only)
- Constraints: adopt the handoff **tokens + component/accessibility rules only** — do NOT reproduce the handoff screen mockups; keep Tailwind v4; Nunito via `next/font`; no hard-coded colors/radii/shadows in components; theme applied before first paint (no flash); wrap fallible browser calls (`localStorage`) in try/catch.
- Do not touch: `services/*`, `mobile/`.

## Objective

Wire `web/` with the neumorphic token layers, a persisted light/dark `ThemeProvider`, and a principle-driven base component kit, so later web screens are built from tokens with a consistent soft-UI language.

## Scope Boundary

**In scope:**
- `web/app/tokens.css` — custom properties from `tokens.json` (`:root`/`[data-theme]`), elevation/radius/spacing/type vars.
- `web/app/globals.css` — Tailwind v4 `@theme` mapping tokens to utilities (`bg-surface`, `shadow-elev-md`, `rounded-card`, `text-*`), Nunito, focus-ring, reduced-motion.
- `web/lib/tokens.ts` — typed tokens + `raisedShadow()` / `insetShadow()` helpers.
- `web/lib/theme.tsx` — `ThemeProvider`, `useTheme`, no-flash inline script.
- `web/app/layout.tsx` — Nunito font, `ThemeProvider`, `data-theme` on `<html>`.
- `web/components/ui/` — `Surface`/`Card`, `Panel`, `Button`, `TextField`, `Toggle`, `SegmentedControl`, `ErrorCard`, `ThemeToggle`.
- `web/app/page.tsx` — a living style reference (component gallery), not a product screen.

**Out of scope:**
- App shell nav / routing / auth (later task).
- Any real admin screen (dashboard, catalog, …).

## Acceptance Criteria

- `web/app/tokens.css` and `web/lib/tokens.ts` carry the exact values from `tokens.json` for both themes.
- `<ThemeProvider>` sets `data-theme` on `<html>`, persists to `localStorage` (guarded), defaults to `prefers-color-scheme`, and a blocking inline script applies the stored theme before first paint.
- `Button` renders `primary` (solid accent pill), `secondary` (raised neu), `ghost`, `icon`, `destructive` variants; press state sinks to inset; focus shows a 2px accent ring.
- `TextField`, `Toggle` track, and `SegmentedControl` inactive track are inset wells on `surface-sunken`.
- `ErrorCard` takes `{ code, title, action }` and never renders a stack trace.
- No component file contains a literal hex/oklch color, px shadow, or `'Nunito'` string outside `tokens.css` / `tokens.ts` / `layout.tsx`.
- `pnpm --filter web lint` and `pnpm --filter web build` pass.

## Dependencies

- none (web scaffold from Phase 00 exists)

## Implementation Checklist

1. `tokens.css` from the handoff `tokens/nextjs_tokens.css`; import into `globals.css`; add `@theme` utility mapping + Nunito + focus/reduced-motion.
2. `lib/tokens.ts` from `tokens/nextjs_tokens.ts`.
3. `lib/theme.tsx` — provider + hook + no-flash script.
4. `layout.tsx` — Nunito, provider, metadata.
5. `components/ui/*` — the kit, tokens-only.
6. `app/page.tsx` — component gallery.
7. `pnpm --filter web lint && pnpm --filter web build`.

## Verification

- `pnpm --filter web lint` → clean; `pnpm --filter web build` → succeeds.
- `web/app/page.tsx` renders the gallery with a working light/dark toggle (theme persists across reload; no flash).
- `grep -RInE "#[0-9a-fA-F]{3,8}|oklch\(|Nunito" web/components web/app/page.tsx` returns nothing.
