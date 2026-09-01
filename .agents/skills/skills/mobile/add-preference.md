# Add Preference — Persist App Settings with SharedPreferences

Use this skill to add new persistent key-value data using the project's `BasePreferences` pattern.

## Arguments
`$ARGUMENTS` — preference class and keys to add, e.g. `<Feature>Preference: lastViewed<Feature>Id(int), showBalances(bool)`

---

## Architecture

- `BasePreferences` from `ipf_flutter_starter_pack` wraps `SharedPreferences`.
- Each feature or domain gets its own preference class extending `BasePreferences`.
- Preference keys are stored as `const String` in a companion `PrefKeys` class inside the same file.

## Existing Preference Classes

| Class | File | Keys |
|---|---|---|
| `Preferences` | `lib/services/preferences.dart` | `devicePin`, `allowBiometric` |
| `AuthPreference` | `lib/features/auth/preference/auth_preference.dart` | `phoneNumber`, `apiToken`, `apiRefreshToken`, `userPin`, `changeLdmPdf`, `changeLdmStatus`, `cdsNumber` |
| `SettingsPreference` | `lib/features/profile/preference/` | `language`, `darkMode` |

## Template — New Preference Class

```dart
// lib/features/<feature>/preference/<feature>_preference.dart
import 'package:ipf_flutter_starter_pack/ipf_flutter_starter_pack.dart';

class <Feature>Preference extends BasePreferences {
  <Feature>Preference._();
  static final <Feature>Preference instance = <Feature>Preference._();

  Future<int?> get lastViewed<Feature>Id async =>
      await fetch<int?>(PrefKeys.lastViewed<Feature>Id);

  Future<void> setLastViewed<Feature>Id(int id) async =>
      await save(PrefKeys.lastViewed<Feature>Id, id);

  Future<bool?> get showBalances async =>
      await fetch<bool?>(PrefKeys.showBalances);

  Future<void> setShowBalances(bool value) async =>
      await save(PrefKeys.showBalances, value);

  Future<void> clear<Feature>Prefs() async {
    await remove(PrefKeys.lastViewed<Feature>Id);
    await remove(PrefKeys.showBalances);
  }
}

class PrefKeys {
  PrefKeys._();
  static const String lastViewed<Feature>Id = '<feature>_last_viewed_id';
  static const String showBalances          = '<feature>_show_balances';
}
```

## Adding Keys to an Existing Class

Open the existing preference file and add a getter + setter pair:

```dart
// In AuthPreference:
Future<String?> get cdsNumber async => await fetch<String?>(PrefKeys.cdsNumber);
Future<void> setCdsNumber(String value) async => await save(PrefKeys.cdsNumber, value);

// In PrefKeys inside the same file:
static const String cdsNumber = 'cds_number';
```

## Supported Types

`BasePreferences.fetch<T>()` and `save()` support: `String`, `int`, `double`, `bool`, `List<String>`.

For complex objects, serialize to/from JSON string:
```dart
Future<<Feature>Model?> get cached<Feature> async {
  final raw = await fetch<String?>(PrefKeys.cached<Feature>);
  if (raw == null) return null;
  return <Feature>Model.fromJson(jsonDecode(raw) as Map<String, dynamic>);
}

Future<void> setCached<Feature>(<Feature>Model model) async =>
    await save(PrefKeys.cached<Feature>, jsonEncode(model.toJson));
```

## Usage in Provider or Service

```dart
// Read:
final id = await <Feature>Preference.instance.lastViewed<Feature>Id;

// Write:
await <Feature>Preference.instance.setLastViewed<Feature>Id(<feature>.id ?? 0);

// Clear on logout (add to JwtService.logout or AuthProvider.logout):
await <Feature>Preference.instance.clear<Feature>Prefs();
```

## Rules

- Always use a `static final instance` singleton — never instantiate directly in calling code.
- Keep preference key strings in a `PrefKeys` companion class **in the same file**.
- Key strings must be globally unique across the app — use a feature prefix (e.g., `<feature>_`).
- Add a `clear*Prefs()` method and call it from the logout flow in `JwtService` or `AuthProvider`.
- Do not use `BasePreferences` for sensitive data that should survive logout (e.g., device ID) — those go in `SessionManager`.
