# iPF Flutter Starter Pack — Extensions

Use this skill when using or generating code that touches any of the extension helpers
provided by `ipf_flutter_starter_pack`. All extensions are null-safe and live in
`lib/src/extensions/`.

---

## String (`lib/src/extensions/string_extensions.dart`)

Extension on `String?`. All members are safe to call on a nullable string.

### Case conversion (getters)

```dart
"hello_world".toCamelCase   // "helloWorld"
"hello_world".toPascalCase  // "Hello World"
"helloWorld".toSnakeCase    // "hello_world"
```

### Date parsing

```dart
DateTime? dt = "2024-01-15".toDateTime;                          // getter
String? s    = "2024-01-15".toFormattedDateTime("dd MMM yyyy"); // "15 Jan 2024"
```

### Date comparison (throw Exception if null/empty/unparseable)

```dart
bool today   = "2024-01-15".isToday;
bool past    = "2024-01-15".isBeforeToday;
bool future  = "2024-01-15".isAfterToday;
bool same    = "2024-01-15T10:00".isInDate("2024-01-15T14:30"); // same calendar day
bool inRange = "2024-01-10".dateBetween("2024-01-01", "2024-01-31");
```

### Days remaining

```dart
int days = "2024-12-31".daysFromNow;  // 0 if date has already passed
```

---

## DateTime (`lib/src/extensions/date_extensions.dart`)

Extension on `DateTime?`.

```dart
String s    = DateTime.now().toFormat("dd MMM yyyy");  // "24 Apr 2026"
String t    = DateTime.now().toFormat("HH:mm");

int n       = date.daysInMonth;
DateTime? s = date.startOfMonth;     // 1st of month at 00:00:00
DateTime? e = date.endOfMonth;       // last day at 23:59:59
DateTime? f = date.firstOfMonth(3);  // 1 Mar of date's year
DateTime? l = date.lastOfMonth(3);   // 31 Mar of date's year

DateTime? sod = date.startOfDay;     // 00:00:00.000
DateTime? eod = date.endOfDay;       // 23:59:59.999
DateTime? d   = date.onDay(15);      // same year/month, day = 15 (takes int, not DateTime)
```

---

## num / int / double (`lib/src/extensions/number_extensions.dart`)

Extension on `T? extends num`.

```dart
1500000.commaSeparated    // "1,500,000"    (int — no decimals)
1234.56.commaSeparated    // "1,234.56"     (double with fraction — 2 dp)
1500000.shorten           // "1.5M"

double result = 10.divide(0);  // 0 (safe — no Infinity/NaN)

int?    n = null;
n.validateZero   // 0    (null/NaN/Infinite → 0)
n.validateOne    // 1    (null/NaN/Infinite → 1, safe denominator)
```

---

## bool (`lib/src/extensions/boolean_extensions.dart`)

Extension on `bool?`.

```dart
null.validateFalse  // false
null.validateTrue   // true
false.validateTrue  // false  (preserves actual value when not null)
```

---

## TextStyle (`lib/src/extensions/text_style_extensions.dart`)

Extension on `TextStyle`. Each getter returns `copyWith(fontWeight: ...)`.

```dart
style.thin        // w100
style.extraLight  // w200
style.light       // w300
style.regular     // w400
style.medium      // w500
style.semiBold    // w600
style.bold        // w700
style.extraBold   // w800
style.black       // w900

// Numeric aliases: style.w100 … style.w900 (same result)
```

Example:

```dart
Text("Hello", style: context.bodyMedium.semiBold.copyWith(color: Colors.blue))
```

---

## BuildContext — theme & TextTheme shortcuts

### `BuildContextExtensions` (`lib/src/extensions/build_context_extensions.dart`)

```dart
context.themeData                 // Theme.of(context)
context.colorScheme               // theme.colorScheme
context.stateRead<T>()            // Provider.of<T>(listen: false)
context.stateWatch<T>()           // Provider.of<T>(listen: true)
(T, T) pair = context.statePair<T>()  // (watching, nonListening) record
```

### `TextThemeExtension` (`lib/src/extensions/text_theme_extensions.dart`)

```dart
context.textTheme        // context

// Material 3 text roles — all return TextStyle (non-nullable)
context.displayLarge   context.displayMedium   context.displaySmall
context.headlineLarge  context.headlineMedium  context.headlineSmall
context.titleLarge     context.titleMedium     context.titleSmall
context.bodyLarge      context.bodyMedium      context.bodySmall
context.labelLarge     context.labelMedium     context.labelSmall
```

Combined usage:

```dart
Text("Amount", style: context.titleMedium.semiBold)
Text("Hint",   style: context.bodySmall.light.copyWith(color: context.colorScheme.outline))
```

---

## TextEditingController (`lib/src/extensions/text_editing_extensions.dart`)

Extension on `TextEditingController?`.

```dart
bool    empty  = _ctrl.nullOrEmpty;   // true if null or blank
double? amount = _ctrl.parseDouble;   // null if empty
int?    count  = _ctrl.parseInt;      // null if empty
String? text   = _ctrl.textOrNull;    // null if empty, else trimmed text
```

---

## Color (`lib/src/extensions/color_extensions.dart`)

Extension on `Color`.

```dart
MaterialColor mc = const Color(0xFF3D5AFE).toMaterial;
// All 50–900 shades point to the same ARGB value
```

---

## List (`lib/src/extensions/list_extensions.dart`)

Extension on `List<E>?`.

```dart
bool found   = users.containsWhere((u) => u.isActive);           // null-safe
List<User> s = users.sortByElement((a, b) => a.name.compareTo(b.name)); // sort in-place
```

---

## Import

All extensions are re-exported from the package barrel — no individual imports needed:

```dart
import 'package:ipf_flutter_starter_pack/ipf_flutter_starter_pack.dart';
```
