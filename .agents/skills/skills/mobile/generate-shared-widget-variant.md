# Generate Shared Widget Variant

Use this skill when creating or extending reusable UI components in `lib/shared/widgets` using enum-driven variants.

## Arguments

`$ARGUMENTS` — component intent and variant set, for example:

- `AppButton variants: primary, secondary, danger, ghost`
- `AppTile add size variants compact, regular`

## Objective

Build global widgets that are:

- reusable across features
- style-consistent
- enum-variant driven
- free of business logic

## When to Use

- A new UI pattern appears in more than one feature.
- Existing shared widget is close but needs more variants.
- A feature widget duplicates layout/style already used elsewhere.

## Do Not Use

- For one-off, feature-local UI that has no reuse potential.
- To move provider/network/business logic into shared widgets.

## Required Design Rules

1. Keep component in `lib/shared/widgets/`.
2. Keep logic presentation-only.
3. Represent visual modes with enums (not boolean explosion).
4. Keep defaults backward compatible unless task explicitly allows breaking changes.
5. Reuse existing theme/tokens/extensions.

## Implementation Workflow

### 1. Check for an existing shared widget

- Search `lib/shared/widgets/` before creating a new component.
- If an existing widget covers at least 70% of the need, extend it with variants.

### 2. Define variant enums

- Add or update enum(s) for style dimensions, for example:
  - `AppButtonVariant`
  - `AppButtonSize`
  - `AppTileDensity`
- Prefer one enum per styling axis.

### 3. Map enum -> style tokens

Use extension methods or a private mapper in the same widget file (or a colocated style file when large):

- color
- textStyle
- border
- radius
- padding/height
- icon size/spacing

Keep mapping deterministic and side-effect free.

### 4. Build clean widget API

Typical public API shape:

- `variant` enum with safe default
- optional `size` enum
- semantic flags only when truly orthogonal (for example `isLoading`)
- `onTap`/callbacks
- content slots (`title`, `subtitle`, `leading`, `trailing`, `child`)

Avoid multiple overlapping booleans that express style (`isPrimary`, `isDanger`, `isGhost`).

### 5. Keep feature code thin

In feature screens/widgets:

- replace duplicated style blocks with shared widget usage
- keep feature-specific behavior outside the shared component

### 6. Add usage examples

Add a minimal example in a relevant feature screen or preview/demo area if available.

### 7. Validate

- run `flutter analyze`
- run targeted tests if present
- verify no regressions in existing usages

## Suggested File Patterns

- `lib/shared/widgets/app_button.dart`
- `lib/shared/widgets/app_tile.dart`
- `lib/shared/widgets/<component>.dart`

If needed for readability in larger components:

- `lib/shared/widgets/<component>/<component>.dart`
- `lib/shared/widgets/<component>/<component>_styles.dart`
- `lib/shared/widgets/<component>/<component>_enums.dart`

Use the existing project pattern first before introducing subfolders.

## Example Pattern

```dart
enum AppButtonVariant { primary, secondary, danger, ghost }
enum AppButtonSize { sm, md, lg }

extension on AppButtonVariant {
  Color background(BuildContext context) {
    switch (this) {
      case AppButtonVariant.primary:
        return context.colorScheme.primary;
      case AppButtonVariant.secondary:
        return context.colorScheme.surface;
      case AppButtonVariant.danger:
        return Colors.red;
      case AppButtonVariant.ghost:
        return Colors.transparent;
    }
  }
}
```

## Acceptance Checklist

- [ ] Existing shared widget evaluated before creating new one.
- [ ] Visual modes represented with enum variants.
- [ ] Backward compatibility preserved or explicitly documented.
- [ ] No provider/network/business logic inside shared widget.
- [ ] At least one real usage integrated.
- [ ] `flutter analyze` passes.

## Common Mistakes to Avoid

- Adding style through many booleans instead of enums.
- Hardcoding colors/spacing instead of theme-driven values.
- Creating a new shared widget when extending existing one is enough.
- Putting screen-specific conditionals inside global component.

## Related Skills

- `ai/skills/add-widget.md`
- `ai/skills/add-enum.md`
- `ai/skills/theming.md`
- `ai/skills/ipf-widgets.md`
