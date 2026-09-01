### State Management Documentation

The `notify` app uses the `provider` package (`^6.1.5+1`) for state management — no Riverpod, no Bloc, no `get_it`. Canonical source: `docs/design/architecture/state-management.md`.

#### Base Classes

Feature providers extend `BaseProvider` (`lib/shared/providers/base_provider.dart`), which extends `StarterChangeNotifier` from `ipf_flutter_starter_pack`. This provides built-in loading-state plumbing and a `loadingWidget` override (`BaseProvider` wires it to the app's `NotifyLoader`).

`notify` does **not** use `OffsetPaginationController`/`easy_scroll_pagination` — that package is not a dependency. Lists are managed as plain state (`List<Model>` + `notifyListeners()`) inside feature providers; if you need paginated fetching, follow the plain-list pattern already used by existing feature providers (e.g. `ContactsProvider`, `WabaConversationsProvider`) rather than introducing a new pagination package.

#### Structure of a Provider

```dart
class ExampleProvider extends BaseProvider {
  // 1. Internal state (private variables)
  bool _isLoading = false;
  List<ExampleModel> _items = [];

  // 2. Public getters
  bool get isLoading => _isLoading;
  List<ExampleModel> get items => _items;

  // 3. Methods for updating state (mutators)
  Future<void> fetch() async {
    _isLoading = true;
    notifyListeners();
    try {
      _items = await ExampleService.fetchItems();
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }
}
```

#### Two-Tier State: App-Wide vs Local

- **App-wide**: register a `ChangeNotifierProvider(create: (_) => <Feature>Provider())` in `appProviders` (`lib/shared/providers/providers.dart`), mounted once above the router. Use this when state must survive route/tab changes (auth/session, feature list/detail state, multi-step drafts like `AiAgentProvider`/`QuickSendProvider`).
- **Local/ephemeral**: a plain `StatefulWidget`'s `State` class colocated in `widgets/` or `screens/` (e.g. `CustomizationSheetState` in `lib/features/ai_agent/widgets/customization_sheet_state.dart`) for form controllers and transient sheet/dialog state. Don't promote local state to a provider unless another screen actually needs to read it.
- One provider uses `ChangeNotifierProxyProvider` because it depends on another provider's live value:
  ```dart
  ChangeNotifierProxyProvider<UserProvider, DashboardProvider>(
    create: (_) => DashboardProvider(),
    update: (_, userProvider, dashboardProvider) =>
        (dashboardProvider ?? DashboardProvider())..bindUserProvider(userProvider),
  ),
  ```
  Use this pattern only for a genuine live dependency between providers — not for a one-off initialization read (use `context.read` in an init method for that).

#### Consumption in the UI

1. **`context.read<T>()`**: one-off action calls (button handlers, init calls).
2. **`context.watch<T>()` / `Consumer<T>`**: rebuild on any change.
3. **`context.select<T, R>((p) => p.field)`**: rebuild only when the selected field changes — prefer this in widgets nested deep in a large screen.

```dart
final exampleProvider = context.read<ExampleProvider>();
exampleProvider.fetch();

final isLoading = context.select<ExampleProvider, bool>((p) => p.isLoading);
```

#### Guidelines for State Management

- **Encapsulate state**: keep internal state private, expose read-only getters.
- **Minimize rebuilds**: use `Selector`/`context.select` for widgets that only need part of a provider's state.
- **Handle errors**: wrap service calls in `try/catch`/`finally`, reset loading flags in `finally`.
- **Initial loads**: trigger fetches from screen `initState`/post-frame callbacks via `context.read<...>().fetch()`, not from the provider's constructor (constructors run at app start for app-wide providers).
- **Register new providers** in `appProviders` only if state must outlive the widget — see `add-provider.md`.
