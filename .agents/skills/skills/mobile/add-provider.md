# Add Provider — Create a State Management Provider

Use this skill to create a new feature provider following the project's `BaseProvider` + `LoggerMixin` pattern.

## Arguments
`$ARGUMENTS` — feature name and state to manage, e.g. `<Feature>: list of <Feature>Model, selected item, isFetching`

---

## Architecture Overview

- **Package:** `provider: ^6.1.5+1`
- **Base chain:** `StarterChangeNotifier` (starter pack) → `BaseProvider` → feature provider
- **File:** `lib/features/<feature>/providers/<feature>_provider.dart`
- **Registration:** `lib/shared/providers/providers.dart` — flat list of `ChangeNotifierProvider`s

## Provider Template

```dart
import 'package:flutter/material.dart';
import 'package:<your_app>/core/mixins/logger_mixin.dart';
import 'package:<your_app>/features/<feature>/service/<feature>_services.dart';
import 'package:<your_app>/models/<feature>_model.dart';
import 'package:<your_app>/shared/providers/base_provider.dart';

class <Feature>Provider extends BaseProvider with LoggerMixin {
  // ── State ──────────────────────────────────────────────────────────────────
  bool? _isFetching;
  List<<Feature>Model> _<feature>s = [];
  <Feature>Model? _selected;

  // ── Getters ────────────────────────────────────────────────────────────────
  bool get isFetching => _isFetching ?? false;
  List<<Feature>Model> get <feature>s => _<feature>s;
  <Feature>Model? get selected => _selected;

  // ── Actions ────────────────────────────────────────────────────────────────
  Future<void> fetch<Feature>s() async {
    try {
      _setIsFetching(true);
      _<feature>s = await <Feature>Services.fetchAll();
    } catch (e) {
      logError('fetch<Feature>s: $e');
    } finally {
      _setIsFetching(false);
    }
  }

  void select(<Feature>Model <feature>) {
    _selected = <feature>;
    notifyListeners();
  }

  // ── Private setters ────────────────────────────────────────────────────────
  void _setIsFetching(bool value) {
    _isFetching = value;
    notifyListeners();
  }
}
```

## Registering the Provider

Open `lib/shared/providers/providers.dart` and add to the list:

```dart
ChangeNotifierProvider(create: (_) => <Feature>Provider()),
```

## Paginated Provider (with OffsetPaginationController)

Use `OffsetPaginationController<T>` from `easy_scroll_pagination` for lists with infinite scroll. **This package is not currently installed in `notify`** — add it to `pubspec.yaml` first, or follow the plain-list pattern used by `ContactsProvider`/`WabaConversationsProvider` if you don't need infinite scroll:

```dart
class <Feature>Provider extends BaseProvider with LoggerMixin {
  late final OffsetPaginationController<<Feature>Model> _controller;

  <Feature>Provider() {
    _controller = OffsetPaginationController<<Feature>Model>(
      fetcher: _fetch,
      limit: 20,
    );
  }

  OffsetPaginationController<<Feature>Model> get controller => _controller;

  Future<List<<Feature>Model>> _fetch(int page, int limit) async {
    return <Feature>Services.fetchAll(page: page, pageSize: limit);
  }
}
```

In the UI, pass `controller` to a `PaginatedListView` or equivalent widget.

## Consuming Providers in the UI

```dart
// Read once (actions, inside callbacks):
context.read<<Feature>Provider>().fetch<Feature>s();

// Watch entire provider (rebuilds on any notifyListeners):
final provider = context.watch<<Feature>Provider>();

// Select specific field (minimal rebuilds — preferred):
final isFetching = context.select<<Feature>Provider, bool>((p) => p.isFetching);

// Consumer widget:
Consumer<<Feature>Provider>(
  builder: (context, provider, _) => Text(provider.<feature>s.length.toString()),
)
```

## Init Pattern

For providers that need to load data as soon as a screen opens:

```dart
// In the screen's initState or didChangeDependencies:
@override
void didChangeDependencies() {
  super.didChangeDependencies();
  WidgetsBinding.instance.addPostFrameCallback((_) {
    context.read<<Feature>Provider>().fetch<Feature>s();
  });
}
```

## Rules

- Keep all state fields **private** (`_fieldName`). Expose via public getters only.
- Every private setter that mutates state **must** call `notifyListeners()`.
- Use `LoggerMixin` methods (`logInfo`, `logWarning`, `logError`) — never `print()`.
- Never call the service directly from the UI — always go through the provider.
- Keep business logic in the provider, not in service classes.
- `BaseProvider` exposes `loadingWidget` (returns `CircularProgressIndicator`); use it for full-screen loading states.
