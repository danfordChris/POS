# T-0119 Mobile — Neumorphic Design System Foundation

## Status

- `done`
- Last updated: 2026-09-02

## Linked Phase

- Phase 02 — Inventory Core (client foundation; unblocks T-0106–T-0108 mobile work)

## Agent Context

- Skills: mobile, workflow-contract
- Design docs: `docs/design/interfaces/ui-design-system.md`, `docs/design/interfaces/mobile-app-spec.md`, `docs/design/interfaces/design_handoff_neumorphic_system/` (tokens only)
- Constraints: adopt the handoff **tokens + component/accessibility rules only** — do NOT reproduce the handoff Home/Sell/Catalog mockups; Nunito via `google_fonts`; inset wells via a `CustomPainter` (no third-party inset-shadow package); no hard-coded colors/radii/shadows in widget code; touch targets ≥ 48; body ≥ 16.
- Do not touch: `services/*`, `web/`.

## Objective

Wire `mobile/` with the neumorphic token classes, light/dark `ThemeData`, and a principle-driven base widget kit, so later mobile screens are built from tokens with a consistent soft-UI language.

## Scope Boundary

**In scope:**
- `mobile/pubspec.yaml` — add `google_fonts`; (icons dep optional).
- `mobile/lib/theme/duka_colors.dart`, `duka_tokens.dart` — from the handoff `tokens/flutter_theme.dart` (`DukaColors` / `DukaRadius` / `DukaSpacing` / `DukaElevation`).
- `mobile/lib/theme/duka_theme.dart` — `buildDukaTheme(Brightness)` → `ThemeData` with a Nunito `TextTheme` and component themes from tokens.
- `mobile/lib/theme/neu.dart` — `NeuBox` (raised), `NeuWell` (inset via `CustomPainter`), elevation helpers.
- `mobile/lib/widgets/` — `NeuButton` (primary/secondary/ghost/destructive), `NeuTextField`, `NeuToggle`, `SegmentedNeu`, `ErrorByCodeCard`.
- `mobile/lib/main.dart` — `MaterialApp` with light/dark themes + a component gallery home (not the product Home screen).
- `mobile/test/` — widget smoke tests for the kit.

**Out of scope:**
- Bottom nav / routing / auth (later task).
- Any real product screen (Home, Catalog, Sell, …).

## Acceptance Criteria

- `duka_colors.dart` / `duka_tokens.dart` carry the exact values from the handoff `tokens/flutter_theme.dart` for both themes.
- `buildDukaTheme(Brightness.light|dark)` returns a `ThemeData` whose `scaffoldBackgroundColor` is the token `surface`, text theme is Nunito, and no widget theme hard-codes a color outside the token classes.
- `NeuWell` renders an inset (sunken) appearance; `NeuBox` renders a raised dual-shadow; both read shadows from `DukaElevation`.
- `NeuButton` supports `primary` (solid accent pill), `secondary` (raised), `ghost`, `destructive`; pressed state visibly sinks.
- `ErrorByCodeCard` takes `code` + `title` + one action; renders no raw error text.
- `flutter analyze` reports no issues; `flutter test` passes.
- `grep -RInE "Color\(0x|Colors\.|'Nunito'" mobile/lib/widgets mobile/lib/main.dart` returns nothing (widgets/screens reference token classes only).

## Dependencies

- none (mobile scaffold from Phase 00 exists)

## Implementation Checklist

1. `pubspec.yaml` — add `google_fonts`; `flutter pub get`.
2. `theme/duka_colors.dart` + `theme/duka_tokens.dart` from the handoff Dart export.
3. `theme/neu.dart` — `NeuBox`, `NeuWell` (`CustomPainter`), helpers.
4. `theme/duka_theme.dart` — `buildDukaTheme`.
5. `widgets/*` — the kit, token classes only.
6. `main.dart` — themed `MaterialApp` + gallery.
7. widget tests; `flutter analyze`; `flutter test`.

## Verification

- `flutter analyze` → "No issues found!"; `flutter test` → all pass.
- `mobile/lib/main.dart` shows the gallery under both `buildDukaTheme` brightnesses via the system theme.
- `grep -RInE "Color\(0x|Colors\.|'Nunito'" mobile/lib/widgets mobile/lib/main.dart` returns nothing.
