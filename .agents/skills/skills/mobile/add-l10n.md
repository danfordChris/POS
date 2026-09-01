# Add L10n — Add Localized Strings

Use this skill to add new localized strings to the app (English + Swahili).

## Arguments
`$ARGUMENTS` — feature prefix and key/value pairs to add, e.g. `<feature>: title=My <Feature>, emptyState=No <feature>s yet, createButton=Create <Feature>`

---

## Overview

The app uses `flutter_intl` (intl_utils). Source-of-truth ARB files live in `lib/l10n/`. Generated code lives in `lib/generated/`.

| File | Purpose |
|---|---|
| `lib/l10n/intl_en.arb` | English strings (edit this first) |
| `lib/l10n/intl_sw.arb` | Swahili strings (edit in parallel) |
| `lib/generated/l10n.dart` | Auto-generated `S` class (do not edit) |
| `lib/generated/intl/messages_en.dart` | Auto-generated (do not edit) |

---

## Step 1 — Add Keys to `intl_en.arb`

Open `lib/l10n/intl_en.arb`. Keys are **camelCase** prefixed with the feature name.

```json
{
  "@@locale": "en",

  "<feature>Title": "My <Feature>",
  "@<feature>Title": {},

  "<feature>EmptyState": "No <feature>s yet",
  "@<feature>EmptyState": {},

  "<feature>CreateButton": "Create <Feature>",
  "@<feature>CreateButton": {},

  "<feature>DeleteConfirm": "Delete {name}?",
  "@<feature>DeleteConfirm": {
    "placeholders": {
      "name": { "type": "String" }
    }
  }
}
```

**Key naming rules:**
- Prefix by feature: `auth`, `profile`, `market`, `order`, `<feature>`, `home`, `common`
- camelCase throughout
- `common` prefix for app-wide strings (e.g., `commonNext`, `commonCancel`, `commonError`)

---

## Step 2 — Add Keys to `intl_sw.arb`

Open `lib/l10n/intl_sw.arb` and add the same keys with Swahili translations:

```json
{
  "@@locale": "sw",

  "<feature>Title": "Mkoba Wangu",
  "@<feature>Title": {},

  "<feature>EmptyState": "Hakuna mikoba bado",
  "@<feature>EmptyState": {},

  "<feature>CreateButton": "Unda Mkoba",
  "@<feature>CreateButton": {},

  "<feature>DeleteConfirm": "Futa {name}?",
  "@<feature>DeleteConfirm": {
    "placeholders": {
      "name": { "type": "String" }
    }
  }
}
```

---

## Step 3 — Run the Generator

```bash
flutter pub global run intl_utils:generate
```

This updates `lib/generated/l10n.dart` and `lib/generated/intl/messages_*.dart`.

---

## Step 4 — Use the Strings

**In widgets (no context needed):**
```dart
import 'package:<your_app>/services/strings.dart';

Text(<AppStrings>.instance.<feature>Title)
Text(<AppStrings>.instance.<feature>DeleteConfirm(<feature>.name))
```

**In widgets (with context, for locale-sensitive render):**
```dart
Text(Strings.of(context).<feature>Title)
```

**In providers / services (no context available):**
```dart
import 'package:<your_app>/services/strings.dart';

logInfo(<AppStrings>.instance.<feature>EmptyState);
```

---

## Parameterized Strings

ARB supports placeholders for dynamic values:

```json
"<feature>Value": "Value: {amount} TZS",
"@<feature>Value": {
  "placeholders": {
    "amount": { "type": "String" }
  }
}
```

Usage:
```dart
<AppStrings>.instance.<feature>Value(AppFormatter.formatCurrency(<feature>.value))
```

For plural forms:
```json
"<feature>Count": "{count, plural, =0{No <feature>s} =1{1 <feature>} other{{count} <feature>s}}",
"@<feature>Count": {
  "placeholders": {
    "count": { "type": "int" }
  }
}
```

---

## Do's and Don'ts

- **Do** always add both `en` and `sw` translations — an untranslated string will fall back to the key name at runtime.
- **Do** use the feature prefix on all keys to avoid collisions.
- **Do not** hardcode user-facing strings anywhere in Dart code — always go through `<AppStrings>.instance`.
- **Do not** edit files under `lib/generated/` manually — they are regenerated on every run.
- **Do** keep the `@keyName` metadata entry (even if empty `{}`) directly after each string key — the generator requires it.
