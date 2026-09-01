### Theming Documentation

The `notify` app builds its own `ThemeData` from Figma-extracted tokens under `lib/core/theme/` — it does **not** use `flex_color_scheme`. Canonical source: `docs/design/architecture/theming.md`.

#### Core Components

1. **AppColors** (`lib/core/theme/app_colors.dart`) — raw Figma color constants (`schemesPrimary`, `schemesSurfaceContainerLowest`, `statusWarning`, etc.) and `AppColors.specialColorScheme`, the hand-built Material 3 `ColorScheme` mapped from those constants only.
2. **AppTextTheme** (`lib/core/theme/app_text_theme.dart`) — the app's `TextTheme`, font family `HelveticaNeue`.
3. **ComponentThemes** (`lib/core/theme/component_themes.dart`) — per-component theme fragments: `filledButtonTheme`, `elevatedButtonTheme`, `inputDecorationTheme`, `chipTheme`, plus standalone decorations (`bottomActionBarDecoration`, `backButtonShadowDecoration`).
4. **AppSpacing / AppRadius / AppElevation** (`lib/core/theme/app_spacing.dart`) — token classes for spacing (`px2`…`px64`), corner radius (`r12`…`r999`), and shadow offset/blur/alpha. Use these instead of numeric literals.
5. **CustomColors** (`lib/core/theme/custom_colors.dart`) — semantic aliases (`successContainer`, `destructiveContainer`, `redContainer`, …) over a `ColorScheme`, for names Material 3 doesn't have.
6. **AppTheme** (`lib/core/theme/app_theme.dart`) — assembles all of the above into `ThemeData(useMaterial3: true)` as `AppTheme.specialTheme`.
7. **AppProvider** — owns the app's `ThemeMode` and persists it via `AppPreference`.

#### Single Theme, Not True Light/Dark

`AppTheme.lightTheme` and `AppTheme.darkTheme` both currently return the same `specialTheme` — there is only one visual theme today, even though `AppProvider` fully implements `ThemeMode` switching. Don't assume dark mode changes appearance; if you're asked to implement real dark mode, that means building a second `ThemeData` and branching `AppTheme.lightTheme`/`darkTheme`, not just flipping `ThemeMode`.

#### Using Theme in UI

Always use the current theme's `colorScheme`/`textTheme` instead of hardcoding colors.

**Accessing Colors**:
```dart
final colorScheme = Theme.of(context).colorScheme;
final primaryColor = colorScheme.primary;

// OR using ipf_flutter_starter_pack shortcuts
final colorScheme = context.colorScheme;
```

**Accessing Custom Colors**:
```dart
final customColors = context.customColors;
final successColor = customColors.onSuccessContainer;
```

**Accessing Tokens**:
```dart
Padding(
  padding: const EdgeInsets.all(AppSpacing.px16),
  child: Container(
    decoration: BoxDecoration(
      borderRadius: BorderRadius.circular(AppRadius.r16),
    ),
  ),
)
```

#### Switching Theme Mode

```dart
final appProvider = context.read<AppProvider>();

appProvider.toggleTheme();       // flips light/dark
appProvider.changeDarkMode();
appProvider.changeLightMode();
appProvider.changeSystemMode();
```

#### Best Practices

1. **Never hardcode** a color, spacing, or radius value that already has an `AppColors`/`AppSpacing`/`AppRadius`/`AppElevation` token — this is a hard project rule (see the top-level `CLAUDE.md`), not a style preference.
2. **Use CustomColors for semantic accents** (success/destructive/red) instead of reaching into `ColorScheme.error` directly.
3. **New tokens start in `AppColors`/`AppSpacing`**, extracted from Figma — don't inline hex/numeric values in widgets.
4. **Component styling belongs in `ComponentThemes`**, wired into `AppTheme`, not re-specified per widget instance.
