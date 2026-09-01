# iPF Flutter Starter Pack — Base Widgets

Extend these abstract widgets with your app's design system.

## Key base widgets

| Widget | Extends | Purpose |
|--------|---------|---------|
| `BaseTextField` | Abstract | Text input with validator, formatters, prefix/suffix |
| `BaseButton` | Abstract | Button with `loading`, `enabled`, `outlined` states |
| `BaseImage` | - | `.network()`, `.asset()`, `.file()`, `.memory()` constructors |
| `BaseDropdown<T>` | - | Dropdown with `DropdownController<T>` |
| `BaseEmptyView` | - | Empty state with optional `onRefresh` |
| `BaseErrorView` | - | Error display with `onRetry` |
| `PinInputField` | - | PIN entry with `length`, `onCompleted`, `obscureText` |
| `DialogBuilder` | - | `.showConfirmation()`, `.show()` helpers |
| `NetworkCheck` | - | Wraps child, shows offline banner |
| `StateProvider<T>` | - | `.listen()` / `.read()` wrappers |
| `StateStream<T>` | - | StreamBuilder wrapper |
| `StarterWebView` | - | In-app WebView screen |
| `iPFSplashScreen` | - | Splash with `SplashInitialized` mixin |
| `TextWithIcon` | - | Icon + Text row |

## BaseImage usage

```dart
BaseImage.network(url: "https://...", width: 80, height: 80, fit: BoxFit.cover)
BaseImage.asset(path: "assets/logo.png", width: 120)
BaseImage.file(file: File("/path/img.jpg"))
```

## StateProvider usage

```dart
StateProvider<UserProvider>.listen(builder: (ctx, p) => Text("${p.data.length}"))
StateProvider<UserProvider>.read(builder: (ctx, p) => Button(onTap: p.fetchUsers))
```

## iPFSplashScreen usage

```dart
class SplashScreen extends iPFSplashScreen with SplashInitialized {
  @override
  Future<void> initialize(BuildContext context) async {
    await Future.delayed(const Duration(seconds: 1));
    Scenery.pushUntil(context, await AuthService.isLoggedIn ? HomeScreen() : LoginScreen());
  }
}
```
