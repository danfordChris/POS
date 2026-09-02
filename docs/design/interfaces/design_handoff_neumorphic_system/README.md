# Handoff: Duka Stock — Neumorphic Design System

## Overview
Design system and priority screens for Duka Stock, a multi-tenant retail stock-management
platform for small Tanzanian retailers. Covers foundations (color/elevation/radius/spacing/
type tokens), a component library, and the highest-traffic screens for the Next.js web admin
and the Flutter mobile app, in a neumorphic ("soft UI") visual language, light + dark themes.

## About the Design Files
The bundled file `Duka Stock Neumorphic System.dc.html` is a **design reference built in HTML**
— a live, interactive prototype showing intended look, states, and behavior, not production
code to copy directly. It has in-page controls (top bar) to flip theme (light/dark), role
(Owner/Staff), and connectivity (online/offline) — use these to see every state combination
before implementing. The task is to **recreate this design in each target codebase** — Next.js/
React for web, Flutter for mobile — using each platform's own component patterns, not by
embedding the HTML.

## Fidelity
**High-fidelity.** Colors, spacing, radius, and shadow values are final and specified precisely
in `tokens.json` and the platform-specific token files in `tokens/`. Typography is Nunito
(400/500/600/700/800). Recreate pixel-close to the reference; minor engine-specific rendering
differences (e.g. Flutter's lack of native inset shadows) are called out below.

## Design tokens
Canonical values: `tokens.json` (OKLCH, source of truth).
Platform-ready exports:
- `tokens/nextjs_tokens.css` — CSS custom properties, light/dark via `[data-theme]`.
- `tokens/nextjs_tokens.ts` — same values as a typed TS object + shadow-string helpers.
- `tokens/flutter_theme.dart` — `DukaColors`/`DukaRadius`/`DukaSpacing`/`DukaElevation` classes,
  hex-converted from the OKLCH source (OKLCH has no native Flutter equivalent).

**Color roles** (light / dark): surface, surface-sunken, text-primary, text-secondary,
text-disabled, accent (teal), accent-hover, accent-contrast, success, warning, danger, info,
shadow-light, shadow-dark. Same hue family for surface/sunken/raised — differentiate elevation
via shadow only, never a second background color.

**Elevation** — dual shadow, light offset top-left / dark offset bottom-right, equal blur:
- `sm`: 3,3,6 · `md`: 6,6,10 · `lg`: 10,10,18 · `inset` (pressed/wells): 3,3,6, both shadows inset.

**Radius**: control 16 · card 22 · sheet 28 · pill 999 (fully round).
**Spacing scale (px)**: 4, 8, 12, 16, 20, 24, 32, 40, 48.
**Type scale**: display 40/700, h1 32/700, h2 24/600, h3 20/600, body-lg 18/400, body 16/400,
caption 13/400, overline 12/600 uppercase. Numbers (money, quantities) use tabular figures.
Mobile base body ≥16px; touch targets ≥48×48dp.

## Flutter-specific note: inset shadows
Flutter has no native inset `BoxShadow`. Recommended: the `inner_shadow`/`flutter_inset_box_shadow`
package (widget: `InnerShadow` wrapping the pressed/well container), or a `CustomPainter` well
using two overlaid soft radial gradients (dark edge top-left, light edge bottom-right) inside
a `ClipRRect`. Raised shadows use Flutter's native `BoxShadow` list directly — see
`DukaElevation.raised/sm/md/lg` in `flutter_theme.dart`.

## Screens included in this pass
**Web (Next.js)** — Dashboard, Catalog (Owner/Staff column variants), Sale detail (with void).
Each uses an app-shell layout: fixed 232px icon sidebar (sections: Overview / Manage, Owner-only
items hidden for Staff), header bar (breadcrumb, business switcher, locale/theme icon buttons,
avatar), and a content column with a page-header row (title + subtitle + actions), KPI tiles
with 7-bar sparklines, and panel cards holding tables/lists.

**Mobile (Flutter)** — Home, Catalog list, Sell (inline `insufficient_stock` error state),
Winger catalog (read-only, no bottom nav). Fixed 320×640 phone frame in the reference maps to
full-screen routes in the real app; bottom nav is Home / Catalog / Scan (emphasized, raised
above the bar) / Sell / More.

Remaining routes from the product brief (Stock, Stock movements, Sales list, Wingers, Members,
Alerts, Reports, Settings, Support, plus mobile Scan/Stock-in/Adjustment/Receipt/More/
Login/Accept-invite) are **not yet built** — they should follow the same tokens and component
patterns established here.

## Components (see the "Components" section of the HTML reference for all states)
Buttons (primary solid-accent pill, secondary neumorphic, ghost, icon, destructive), inputs
(text field, search, currency, numeric stepper, segmented control, toggle — all inset wells),
containers (card, KPI tile, list well, table), navigation (top bar, left nav, bottom nav),
feedback (empty state, toast, error-by-code card — pairs a plain-language title with the error
code and one action, never a raw stack trace).

**Accessibility rules baked into every component** (do not deviate when re-implementing):
- Primary CTA is always a solid accent-filled pill with AA-contrast label — never shadow-only.
- Body/icon/table text always meets 4.5:1 / 3:1 against its surface.
- Every focusable element gets a 2px accent focus ring with offset.
- Destructive actions (Void/Suspend/Remove) are danger-colored with a required confirm step.
- No pure white/black surfaces (shadows disappear) — the given off-white/charcoal bases are load-bearing, not decorative choices.

## Interactions & behavior
- Pressing a button/tab/toggle visibly sinks it (raised → inset) over ~120ms ease-out; releasing restores.
- Toggles slide their knob; segmented controls and tabs show the active option as an inset well.
- Offline (mobile): persistent top banner, all write buttons disabled (styled but non-interactive), cached data shows a "last updated" line.
- Role changes (Owner ↔ Staff): Catalog and Sale detail conditionally render whole columns/actions (Cost, Margin, Void) — hide them from the DOM/widget tree, not just visually.

## State management
- `theme`: 'light' | 'dark' — persists per user preference.
- `role`: 'owner' | 'staff' | 'winger' — drives conditional rendering, not just styling.
- `connectivity`: 'online' | 'offline' — mobile only; disables all write actions when offline.
- Per-list loading/empty/error states — see the error-by-code component for the error contract (`error.code` → title + body + action).

## Assets
No external imagery used — thumbnails are diagonal-stripe placeholders (drop in real product
photos later). Icons in the reference are text/unicode placeholders (⌕, ＋, ▾, ⋯) standing in for
a 24px-grid, 2px-stroke outline icon set — swap in a real icon set (e.g. Lucide/Phosphor) at
build time, keeping the same 24px sizing and stroke weight.

## Files in this bundle
- `Duka Stock Neumorphic System.dc.html` — the interactive design reference (open in any browser).
- `tokens.json` — canonical OKLCH token values.
- `tokens/nextjs_tokens.css` — CSS variables for the Next.js app.
- `tokens/nextjs_tokens.ts` — typed token object + shadow-string helpers for Next.js/React.
- `tokens/flutter_theme.dart` — Dart token classes for the Flutter app.
