# UI Design System — Neumorphic

## Context

- Both clients — `web/` (Next.js admin) and `mobile/` (Flutter, Owner/Staff/Winger) — share
  one visual and interaction language: **neumorphic ("soft UI")**, light + dark.
- The source of truth for values is the design handoff bundle at
  `docs/design/interfaces/design_handoff_neumorphic_system/` — specifically `tokens.json`
  (canonical OKLCH) and its platform exports under `tokens/`.
- **Only the foundations and component styling from that bundle are adopted**: color roles,
  elevation/shadow model, radius, spacing, type scale, and the per-component styling +
  accessibility rules. The bundled screen mockups (`*.dc.html`, the dashboard / catalog /
  sale / home / sell layouts) are **reference only and are NOT adopted** — screens for this
  product are designed fresh from these tokens and component rules, not reproduced from the
  handoff. Where the handoff's screen composition and this repo's `web-app-spec.md` /
  `mobile-app-spec.md` disagree, the specs win.

## Requirements

### Token source and platform layers

| Layer | Path | Role |
|---|---|---|
| Canonical | `docs/design/interfaces/design_handoff_neumorphic_system/tokens.json` | OKLCH source of truth for all values |
| Web CSS | `web/app/tokens.css` | `:root` / `[data-theme]` custom properties + elevation/radius/spacing/type vars |
| Web TS | `web/lib/tokens.ts` | typed token object + `raisedShadow()` / `insetShadow()` helpers |
| Flutter | `mobile/lib/theme/duka_tokens.dart` + `duka_colors.dart` | `DukaColors` / `DukaRadius` / `DukaSpacing` / `DukaElevation` (hex, sRGB-converted) |

Regenerate the platform layers from `tokens.json` if the canonical values change; never edit a
platform layer as the primary source.

### Color roles (light / dark, per theme)

`surface`, `surface-sunken`, `text-primary`, `text-secondary`, `text-disabled`, `accent`
(teal), `accent-hover`, `accent-contrast`, `success`, `warning`, `danger`, `info`,
`shadow-light`, `shadow-dark`.

- Surface, sunken, and raised elements share **one hue family** — elevation is expressed with
  shadow only, never a second background color.
- **No pure white or pure black surfaces** — the off-white / charcoal bases are load-bearing
  (shadows vanish on `#fff` / `#000`).

### Elevation — dual shadow

Light shadow offset top-left, dark shadow offset bottom-right, equal blur:

| Token | offset | blur | Use |
|---|---|---|---|
| `sm` | 3 | 6 | buttons, small raised chips |
| `md` | 6 | 10 | cards, panels, KPI tiles |
| `lg` | 10 | 18 | popovers, sheets, dialogs |
| `inset` | 3 | 6 | pressed state, and every input / well (both shadows inset) |

### Radius / spacing / type

- Radius: control `16`, card `22`, sheet `28`, pill `999`.
- Spacing scale (px): `4 8 12 16 20 24 32 40 48`.
- Type: family **Nunito** (400/500/600/700/800). Scale — display 40/700, h1 32/700,
  h2 24/600, h3 20/600, body-lg 18/400, body 16/400, caption 13/400, overline 12/600 upper.
  Money and quantities use tabular figures. Mobile base body ≥ 16px; touch targets ≥ 48×48.

### Component styling rules

- **Card / panel / KPI tile**: `surface` bg, card radius, `md` elevation.
- **Input / search / currency / stepper / segmented / toggle track**: `surface-sunken` bg,
  control radius, `inset` elevation (a well).
- **Primary CTA**: always a solid `accent`-filled pill with an AA-contrast label — never
  shadow-only. `sm` elevation.
- **Secondary button**: neumorphic raised (`surface`, `sm`), sinks to `inset` while pressed.
- **Ghost / icon button**: no fill at rest; `inset` while pressed.
- **Destructive action** (Void / Suspend / Remove): `danger` color + a required confirm step.
- **Error-by-code card**: plain-language title + the `error.code` + exactly one action.
  Never render a raw stack trace or `devMessage` to end users.
- Segmented controls and tabs show the active option as an `inset` well.

### Accessibility (do not deviate)

- Body / icon / table text ≥ 4.5:1 (≥ 3:1 for large) against its surface.
- Every focusable element gets a 2px `accent` focus ring with offset.
- Primary CTA label meets AA contrast on `accent`.
- Destructive actions are `danger`-colored and confirmed.

### Interaction

- Press (button / tab / toggle): visibly sink raised → `inset` over ~120ms ease-out; release
  restores.
- Toggle knob slides; segmented / tab active state is an `inset` well.
- Motion respects `prefers-reduced-motion` (web) / `MediaQuery.disableAnimations` (Flutter).

### Client state that drives rendering

- `theme`: `light | dark` — persisted per user; falls back to the OS setting.
- `role`: `owner | staff | winger` — conditionally renders whole regions/actions
  (Cost, Margin, Void, Owner-only nav). Hidden from the DOM / widget tree, not just visually.
- `connectivity` (mobile): `online | offline` — offline disables every write control and
  shows a persistent banner + "last updated" on cached data.

## Decisions

- Adopt the handoff's **tokens and component/accessibility rules verbatim**; design our own
  screen layouts from `web-app-spec.md` / `mobile-app-spec.md` rather than copying the
  handoff mockups.
- Web keeps Tailwind (v4) — tokens are mapped into `@theme` so `bg-surface`,
  `shadow-elev-md`, `rounded-card`, `text-*` utilities resolve to the design tokens.
- Nunito is loaded via `next/font` (web) and `google_fonts` (mobile) — no vendored font
  binaries.
- Flutter has no native inset `BoxShadow`; wells are drawn with a `CustomPainter`
  (`NeuWell`) — no third-party inset-shadow package.
- Icons: a 24px-grid, 2px-stroke outline set (Lucide on web, `lucide_icons`/equivalent on
  mobile). The handoff's unicode placeholders are not shipped.

## Contracts

- Screen implementations consume only the token layers above — no hard-coded colors, radii,
  shadow strings, or font names in feature code.
- The error-by-code component is the only sanctioned surface for a failed request; it maps
  `error.code` → title + body + one action (see `api-contract.md` error model).
- A theme or role change never requires a full reload; role-gated regions unmount.

## Acceptance Criteria

- `web/app/tokens.css`, `web/lib/tokens.ts`, `mobile/lib/theme/duka_colors.dart`,
  `mobile/lib/theme/duka_tokens.dart` exist and carry the exact values from `tokens.json`.
- Web: a `ThemeProvider` sets `data-theme` on `<html>`, persists to `localStorage`, defaults
  to `prefers-color-scheme`, and applies before first paint (no flash).
- Web: a base component kit (`Button`, `Card`/`Surface`, `TextField`, `Toggle`,
  `SegmentedControl`, `ErrorCard`, `ThemeToggle`) renders from tokens; `pnpm --filter web
  lint && pnpm --filter web build` pass.
- Mobile: `light`/`dark` `ThemeData` built from the tokens with a Nunito text theme; a base
  widget kit (`NeuBox`, `NeuWell`, `NeuButton`, `NeuTextField`, `NeuToggle`,
  `ErrorByCodeCard`); `flutter analyze` and `flutter test` pass.
- No feature/screen code contains a literal color, shadow, or radius value — only token
  references.
