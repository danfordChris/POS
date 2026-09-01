# Project Guidelines

This document defines project-wide development, testing, and skill-routing guidance for a Flutter app built on this starter structure.

## 0. Placeholder Conventions

These skills are project-agnostic. Wherever you see a token in angle brackets,
substitute your project's real name before using the snippet:

| Token | Replace with | Example |
|---|---|---|
| `<your_app>` | your package name (`pubspec.yaml` → `name:`) | `package:<your_app>/...` → `package:acme_app/...` |
| `<Feature>` | the PascalCase feature name | `<Feature>Provider` → `OrderProvider` |
| `<feature>` | the snake/lowercase feature name | `lib/features/<feature>/` → `lib/features/order/` |
| `<AppStrings>` | your generated localization accessor class | `<AppStrings>.instance.title` → `Strings.instance.title` |
| `<Model>` | a DB-backed model name | `<Model>Repository` → `OrderRepository` |

Multi-feature examples use suffixed tokens (`<FeatureA>`, `<categoryB>`, …) to
keep distinct features distinguishable. Framework helpers shown verbatim
(`APIManager`, `BaseProvider`, `AppRoute`, `context.stateRead`, etc.) are part
of this starter toolkit — keep those names as-is.

## 1. Build and Configuration

The project is a Flutter app with helper commands in the root `Makefile`.

### Prerequisites

- Flutter SDK (stable channel).
- Dart SDK compatible with project constraints.
- Optional: `intl_utils` for localization generation flows.

### Common Commands

- Install/refresh dependencies:
  ```bash
  flutter pub get
  ```
- Clean build artifacts:
  ```bash
  make clean
  ```
- Generate localization files:
  ```bash
  flutter pub global run intl_utils:generate
  ```
- Generate DB-backed models/repositories from `ipf_generator.dart`:
  ```bash
  make ipf_gen
  ```
- Run static analysis:
  ```bash
  flutter analyze
  ```
- Run tests:
  ```bash
  flutter test
  ```

## 2. Testing Guidelines

Tests are under `test/`.

### Rules

- Use `flutter_test` for unit/widget tests.
- Wrap localization-dependent widgets with `MaterialApp` and localization delegates.
- Prefer focused tests around:
  - auth/session behavior
  - critical business calculations and money/quantity flows
  - provider loading/error state transitions

### Running Specific Tests

```bash
flutter test test/<path_to_test>.dart
```

## 3. Development and Code Style

### Architecture and State

- Use the existing feature-based structure in `lib/features/*`.
- Keep business logic in providers.
- Keep API/networking in services.
- Follow the provider-service pattern for feature implementation.
- Keep shared reusable UI in `lib/shared/widgets`.

### Localization

- Localization files live in `lib/l10n/`.
- Access strings via `<AppStrings>.instance.<key>`.
- Add new user-facing text through l10n; avoid hardcoded strings in widgets.

### API and Data

- Use `APIManager` for authenticated requests.
- Do not bypass existing auth/header/session flows.
- For DB-backed model updates, start from `ipf_generator.dart` and regenerate (`lib/starter_models/` doesn't exist yet — no DB-backed model has been generated in this repo so far; it's created on first `make ipf_gen` run).
- Do not hand-edit generated localization output in `lib/generated/`.

### UI Reuse Rules

- Prefer extending existing shared widgets over creating duplicates.
- For reusable style modes, use enum-driven variants.
- Standardize reusable components as shared widget variants.
- Keep shared widgets presentation-only; no provider or API logic.

## 4. Skill Routing Map

Use these skills first before ad hoc implementation.

- Routing/navigation updates:
  - [routing.md](routing.md)
  - [add-route.md](add-route.md)
- Provider/state work:
  - [state-management.md](state-management.md)
  - [add-provider.md](add-provider.md)
  - [ipf-state.md](ipf-state.md)
- Shared/global widgets:
  - [ui-components.md](ui-components.md)
  - [add-widget.md](add-widget.md)
  - [ipf-widgets.md](ipf-widgets.md)
  - [generate-shared-widget-variant.md](generate-shared-widget-variant.md)
- Theming and presentation:
  - [theming.md](theming.md)
  - [ipf-extensions.md](ipf-extensions.md)
- API/service integration:
  - [api-service.md](api-service.md)
  - [ipf-api.md](ipf-api.md)
- Persistence/code generation:
  - [ipf-gen.md](ipf-gen.md)
  - [ipf-codegen.md](ipf-codegen.md)
  - [ipf-database.md](ipf-database.md)
- Notifications/security:
  - [add-notification.md](add-notification.md)
  - [ipf-notifications.md](ipf-notifications.md)
  - [ipf-security.md](ipf-security.md)
- Preferences/app lifecycle:
  - [add-preference.md](add-preference.md)
  - [ipf-preferences.md](ipf-preferences.md)
  - [app-lifecycle.md](app-lifecycle.md)

## 5. Sensitive Areas

Changes touching the following need extra care, explicit review, and tests where
feasible. Tailor this list to your app's domain:

- authentication and session management
- personal / identity data (PII)
- money, balances, and transactions (deposits, withdrawals, payments)
- order/transaction state and any financial calculations
- pricing and other figures users rely on
- notification payload-driven navigation
