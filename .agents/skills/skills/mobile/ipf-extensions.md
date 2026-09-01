# iPF Flutter Starter Pack — Extensions

## String

```dart
"hello_world".toCamelCase()    // "helloWorld"
"hello_world".toPascalCase()   // "HelloWorld"
"helloWorld".toSnakeCase()     // "hello_world"
"2024-01-15".toDateTime()
"2024-01-15".isToday / .isBeforeToday / .isAfterToday
"2024-01-15".daysFromNow       // int
```

## DateTime

```dart
DateTime.now().toFormat("dd MMM yyyy")   // "17 Apr 2026"
DateTime.now().toFormat("HH:mm")
date.daysInMonth / .startOfMonth / .endOfMonth
date.startOfDay / .endOfDay
date.onDay(DateTime(2024, 1, 15))       // bool
```

## num

```dart
1500000.commaSeparated    // "1,500,000"
1500000.shorten           // "1.5M"
10.divide(0)              // 0 (safe)
int?.validateZero         // 0 if null
int?.validateOne          // 1 if null
```

## bool

```dart
bool?.validateFalse       // false if null
```

## TextStyle

```dart
style.thin / .light / .regular / .medium / .semiBold / .bold / .extraBold / .black
style.w100 ... style.w900
```

## BuildContext

```dart
context.themeData
context.colorScheme
context.textTheme
context.stateRead<T>()     // Provider.of<T>(listen: false)
context.stateWatch<T>()    // Provider.of<T>(listen: true)
context.statePair<T>()     // (watching, nonListening)
```

## TextEditingController

```dart
_ctrl.isEmpty / .isNotEmpty
_ctrl.parseDouble / .parseInt
```

## Color

```dart
color.toMaterial    // MaterialColor from any Color
```

## List

```dart
list.containsWhere((item) => item.active)   // bool
```
