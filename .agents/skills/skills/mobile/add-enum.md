# Add Enum — Create a Project-Standard Enum

Use this skill to create a new enum following the project's conventions.

## Arguments
`$ARGUMENTS` — enum name, values, label source (hardcoded/localized), and whether it needs an API id, e.g. `<Feature>Type: growth(1), income(2), balanced(3), with localized labels and fromId`

---

## Enum Patterns in This Project

There are three standard patterns. Pick the one that fits:

---

### Pattern A — Label + API ID (most common for API-driven enums)

Use when the enum value maps to a backend integer and needs a human-readable label.

```dart
// lib/features/<feature>/enums/<feature>_enums.dart  (or lib/features/auth/enums/ for auth-related)

enum <Feature>Type {
  growth('Growth', 1),
  income('Income', 2),
  balanced('Balanced', 3);

  final String label;
  final int id;
  const <Feature>Type(this.label, this.id);

  static <Feature>Type fromId(int id) => <Feature>Type.values.firstWhere(
        (e) => e.id == id,
        orElse: () => throw ArgumentError('Unknown <Feature>Type id: $id'),
      );

  static <Feature>Type? fromIdOrNull(int? id) {
    if (id == null) return null;
    return <Feature>Type.values.firstWhereOrNull((e) => e.id == id);
  }
}
```

**Usage:**
```dart
// Serialize to int for API:
final body = {'type': <feature>Type.id};

// Deserialize from API response:
final type = <Feature>Type.fromId(json['type'] as int);

// Display in UI:
Text(<feature>Type.label)
```

---

### Pattern B — Localized Labels

Use when the label must change with the app's language.

```dart
import 'package:<your_app>/services/strings.dart';

enum <Feature>Type {
  growth,
  income,
  balanced;

  String get label => switch (this) {
    <Feature>Type.growth   => <AppStrings>.instance.<feature>TypeGrowth,
    <Feature>Type.income   => <AppStrings>.instance.<feature>TypeIncome,
    <Feature>Type.balanced => <AppStrings>.instance.<feature>TypeBalanced,
  };
}
```

**Remember:** Add the localization keys to both `lib/l10n/intl_en.arb` and `lib/l10n/intl_sw.arb`, then run:
```bash
flutter pub global run intl_utils:generate
```

---

### Pattern C — Enum with Computed Properties (color, icon, image)

Use when the enum drives UI appearance.

```dart
import 'package:flutter/material.dart';
import 'package:<your_app>/core/resources/resources.dart';

enum <Feature>Status {
  active,
  suspended,
  closed;

  Color get color => switch (this) {
    <Feature>Status.active    => Colors.green,
    <Feature>Status.suspended => Colors.orange,
    <Feature>Status.closed    => Colors.red,
  };

  String get imagePath => switch (this) {
    <Feature>Status.active    => AppImages.<feature>Active,
    <Feature>Status.suspended => AppImages.<feature>Suspended,
    <Feature>Status.closed    => AppImages.<feature>Closed,
  };

  bool get isActive => this == <Feature>Status.active;
}
```

---

### Combining Patterns (API ID + Localized Label + UI properties)

```dart
enum <Feature>Type {
  growth(1),
  income(2),
  balanced(3);

  final int id;
  const <Feature>Type(this.id);

  String get label => switch (this) {
    <Feature>Type.growth   => <AppStrings>.instance.<feature>TypeGrowth,
    <Feature>Type.income   => <AppStrings>.instance.<feature>TypeIncome,
    <Feature>Type.balanced => <AppStrings>.instance.<feature>TypeBalanced,
  };

  Color get color => switch (this) {
    <Feature>Type.growth   => const Color(0xFF4CAF50),
    <Feature>Type.income   => const Color(0xFF2196F3),
    <Feature>Type.balanced => const Color(0xFF9C27B0),
  };

  static <Feature>Type fromId(int id) => <Feature>Type.values.firstWhere(
        (e) => e.id == id,
        orElse: () => throw ArgumentError('Unknown <Feature>Type id: $id'),
      );
}
```

---

## File Location Rules

| Enum scope | File location |
|---|---|
| Auth / onboarding | `lib/features/auth/enums/<name>_enum.dart` |
| Feature-specific | `lib/features/<feature>/enum/<name>_enum.dart` |
| App-wide / shared | `lib/shared/enums/<name>_enum.dart` |
| Market / trading | `lib/features/markets/enum/<name>_enum.dart` |

---

## Using Enums in Models

In the IPF generator, store the enum as `int`. In the concrete model, expose it as the enum type:

```dart
// In ipf_generator.dart:
'<feature>Type': int,

// In lib/models/<feature>_model.dart:
<Feature>Type get <feature>TypeEnum => <Feature>Type.fromId(<feature>Type ?? 0);
```

---

## Rules

- Always use `switch` expressions (not `if/else`) for `label`, `color`, and other computed properties — the compiler enforces exhaustiveness.
- Always provide `fromId` for enums that map to API integers.
- Prefer `fromIdOrNull(int?)` over `fromId` in contexts where the value might be absent.
- Do not add a generic `unknown` / `none` fallback value to enums unless the API actually sends it — it hides bugs.
