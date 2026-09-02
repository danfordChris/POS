# Mobile Architecture

## Context

- `mobile/` is a Flutter app (Android + iOS). This document is the approved
  structural truth the `.agents/skills/skills/mobile/` skill files must stay
  consistent with, adapted to what this repo actually uses (no
  `ipf_flutter_starter_pack`, no `flex_color_scheme`, no l10n codegen yet).
- Visual language: the neumorphic design system in
  `docs/design/interfaces/ui-design-system.md` (`DukaColors` / `Neu*` kit).

## Requirements

### Layer map

```
mobile/lib/
  main.dart                     # MultiProvider(appProviders) > MaterialApp.router
  core/
    router/router.dart          # AppRoute enum + the single GoRouter
    router/navigation_keys.dart  # GlobalKey<NavigatorState> registry
    network/api_client.dart      # Dio wrapper for the Kong edge (bearer, 401 refresh)
    network/api_exception.dart   # typed { error: { code, message, devMessage } }
    theme/                       # DukaColors, DukaTokens, neu.dart, DukaTheme
    extensions/                  # BuildContext nav/size helpers
  data/
    token_store.dart            # flutter_secure_storage
    services/<feature>_service.dart   # static-method API wrappers, private _Endpoints
  models/                       # shared request/response/domain models
  shared/
    providers/base_provider.dart     # BaseProvider extends ChangeNotifier (loading/error)
    providers/app_provider.dart      # owns ThemeMode
    providers/providers.dart         # flat List<SingleChildWidget> appProviders
    widgets/                          # Neu* kit + ErrorByCodeCard (presentation-only)
  features/<feature>/
    providers/<feature>_provider.dart # extends BaseProvider; registered in providers.dart
    screens/                          # full routed screens (Scaffold)
    widgets/                          # feature-local widgets
```

### Imports

- **Always package-absolute**: `package:pos_mobile/...`. Enforced by
  `always_use_package_imports` in `mobile/analysis_options.yaml`. No `../` or
  `./` imports.

### Routing (`go_router`)

- One `GoRouter` in `core/router/router.dart`.
- **`enum AppRoute` is the single source of truth** for paths:
  ```dart
  enum AppRoute {
    login('/login'),
    home('/home'),
    productDetail('/catalog/:id');
    const AppRoute(this.path);
    final String path;
  }
  ```
  Every `GoRoute` references `AppRoute.<name>.path` — never an inline string.
- The 5 authenticated tabs (`home`, `catalog`, `scan`, `sell`, `more`) are
  `StatefulShellRoute.indexedStack` branches under an `AppShell`; everything else
  (auth, onboarding, detail, form, sheet) is a top-level `GoRoute`.
- Data passes via `state.extra` (typed, with an `is` check) or path params.
- `redirect` is driven by `SessionProvider.status`
  (`loading → signedOut → needsBusiness → ready`); `refreshListenable` is the
  `SessionProvider`.

### State (`provider`)

- Package `provider`. No Riverpod / Bloc / get_it.
- `BaseProvider extends ChangeNotifier` (`shared/providers/base_provider.dart`)
  gives `isBusy` + `errorMessage` plumbing and a `guard()` helper that wraps a
  future in busy/try/catch/finally.
- Feature providers extend `BaseProvider`: private fields, read-only getters,
  mutator methods that call a service then `notifyListeners()`.
- App-wide providers (survive route/tab changes: session, feature list/detail
  state) are registered once in `appProviders` and mounted above the router.
  Ephemeral form state stays in a `StatefulWidget`'s `State`.
- Consume with `context.read<T>()` (actions), `context.watch<T>()` /
  `Consumer` (full rebuild), `context.select<T,R>()` (scoped rebuild — preferred
  deep in a screen). Trigger initial loads from `initState` /
  `addPostFrameCallback`, never a provider constructor.

### Services + models

- `data/services/<feature>_service.dart`: static methods only, private
  constructor, private `_Endpoints`. They take the shared `ApiClient` (from the
  `SessionProvider`) and a `businessId`, and build tenant-scoped paths
  (`/v1/businesses/{businessId}/...`).
- Providers call services; screens never call a service or `ApiClient` directly.
- Models in `models/` (shared) or `features/<f>/models/` (feature-local), with
  `fromJson` factories. Money is integer minor units + a currency string.

### Theming

- `core/theme/` holds `DukaColors` (`ThemeExtension`), `DukaRadius` /
  `DukaSpacing` / `DukaElevation`, the `Neu*` primitives, and
  `buildDukaTheme(Brightness)`.
- `AppProvider` owns `ThemeMode` (persisted later); `MaterialApp.router` reads it.
- No hard-coded colors / radii / shadows in feature or screen code — token
  classes only. `DukaColors.of(context)` is the accessor.

## Decisions

- Mirror the `.agents/skills/skills/mobile/` architecture (enum routes,
  provider + `BaseProvider`, feature-first, absolute imports) but implement
  `BaseProvider` locally — the `ipf_flutter_starter_pack` is not a dependency of
  this repo.
- Keep the neumorphic kit in `shared/widgets/` rather than adopting `AppButton` /
  `InputField`; it is this product's design language
  (`docs/design/interfaces/ui-design-system.md`).
- l10n (`intl_utils`), `ipf_generator.dart` DB models, `flutter_foreground_task`
  notifications, and `spider` asset codegen are **not yet wired** — add them when
  their phase lands, following the corresponding skill.

## Contracts

- New screens are added via the routing checklist: `AppRoute` entry + `GoRoute`
  in `router.dart`, screen under `features/<f>/screens/`.
- New feature state is a `BaseProvider` subclass registered in `providers.dart`.
- Feature code imports only `package:pos_mobile/...`.

## Acceptance Criteria

- `mobile/analysis_options.yaml` enables `always_use_package_imports`;
  `flutter analyze` reports no issues.
- `mobile/lib` has `core/`, `data/`, `models/`, `shared/`, `features/` and no
  top-level `screens/` or `widgets/` directory.
- `main.dart` wraps the app in `MultiProvider(providers: appProviders)` and uses
  `MaterialApp.router` with the `AppRoute`-based `GoRouter`.
- Session state is a `SessionProvider extends BaseProvider` consumed via
  `context.read/select`, not an `InheritedNotifier`.
- `flutter test` passes.
