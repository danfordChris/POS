---
name: flutter
description: Complete guide to Flutter development skills for the iPF starter pack and feature-based architecture
role: mobile
version: 1.0.0
authors: [iPF Softwares]
---

## Trigger

Use this skill when working on Flutter development tasks. This is the master index for all Flutter-related skills spanning project setup, routing, state management, UI components, data models, API integration, persistence, pagination, security, notifications, localization, and utilities.

## Instructions

Refer to this guide to:
1. Understand the full landscape of Flutter development skills available
2. Navigate to the specific skill file (.md) for your current task
3. Follow the linked skill for detailed patterns, code examples, and best practices

Each skill file includes code examples, architectural patterns, and step-by-step guidance specific to that topic.

## Output format

This guide provides:
- Categorized skill index organized by domain (routing, state, UI, data, API, etc.)
- Quick start paths for common tasks
- Architecture overview showing folder structure and conventions
- Key conventions for naming, state management, and view composition
- Links to detailed skill files for each topic
- Best practices checklist and sensitive areas requiring review

## Notes

- All skills follow the iPF Flutter Starter Pack architecture, adapted to this repo's actual code.
- Skills are organized by feature/concern, not by file type.
- Refer to linked skills for implementation details and code examples.
- This is a navigation guide; detailed execution happens in individual skill files.

## Canonical Architecture Docs

For approved, current-state architecture truth (not how-to steps), read this first — it is the source these skill files must stay consistent with, adapted to what this repo actually uses (no `ipf_flutter_starter_pack`, neumorphic `Neu*` kit instead of `AppButton`, no l10n codegen yet):

- `docs/design/architecture/mobile-architecture.md` — layer map, `AppRoute` enum routing, `provider` + `BaseProvider` state, feature-first structure, absolute imports, theming pointer

The generic skill templates below still reference starter-pack helpers (`APIManager.instance`, `StarterChangeNotifier`, `Strings.instance`, `NotifyLoader`, `make ipf_gen`) — treat those as the pattern to adapt, not verbatim. In this repo: services are static classes over `ApiClient.instance`; `BaseProvider` is local (`lib/shared/providers/base_provider.dart`); theme access is `DukaColors.of(context)`.

# Flutter Development Skills Guide

A comprehensive collection of skills for building Flutter applications using the iPF Flutter Starter Pack architecture. Use this guide to navigate the right skill for your task.

## Quick Start

**New to the project?** Start here:
1. [ipf-setup](ipf-setup.md) — Initialize a new Flutter project with the starter pack
2. [guidelines](guidelines.md) — Understand project conventions and development patterns
3. [scaffold-feature](scaffold-feature.md) — Create your first feature module

---

## Skill Categories

### 🏗️ Project Setup & Architecture

- **[ipf-setup](ipf-setup.md)** — Initialize a new Flutter project with iPF starter pack, dependencies, and skill installation
- **[scaffold-feature](scaffold-feature.md)** — Create a complete feature module with folder structure, providers, services, screens, and routes
- **[guidelines](guidelines.md)** — Project-wide conventions, testing rules, code style, and skill routing map

### 🧭 Routing & Navigation

- **[routing](routing.md)** — GoRouter implementation guide: declarative routing, deep linking, bottom navigation with StatefulShellRoute
- **[add-route](add-route.md)** — Add a new route to the app: update AppRoute enum, create GoRoute entry, handle parameters and modals

### 🔄 State Management & Providers

- **[state-management](state-management.md)** — Provider pattern overview, BaseProvider usage, app-wide vs local state (see [add-pagination](add-pagination.md) if you need paginated lists — `easy_scroll_pagination` is not yet a dependency)
- **[add-provider](add-provider.md)** — Create a new provider class following project conventions: state encapsulation, error handling, listeners
- **[ipf-state](ipf-state.md)** — StarterChangeNotifier base class from iPF starter pack: loading states, error handling, derived providers

### 🎨 UI & Components

- **[ui-components](ui-components.md)** — Inventory of shared widgets: buttons, input fields, tiles, alerts, dialogs, loading, containers, layouts
- **[add-widget](add-widget.md)** — Create new shared or feature widgets: naming conventions, design rules, const constructors, null safety
- **[ipf-widgets](ipf-widgets.md)** — iPF starter pack base widgets: BaseTextField, BaseButton, BaseImage, BaseDropdown with common patterns
- **[generate-shared-widget-variant](generate-shared-widget-variant.md)** — Create a new variant of an existing shared widget with enum-driven properties
- **[theming](theming.md)** — Theme management with hand-built `ThemeData` (AppColors/AppTextTheme/ComponentThemes tokens, not `flex_color_scheme`): AppTheme, custom colors, theme-mode switching

### 📋 Enums & Models

- **[add-enum](add-enum.md)** — Create standard enums: Pattern A (label + API ID), Pattern B (localized labels), Pattern C (color/icon properties), combinations
- **[ipf-gen](ipf-gen.md)** — Database model generation: add entries to ipf_generator.dart, run make ipf_gen, create concrete model wrappers
- **[ipf-codegen](ipf-codegen.md)** — Code generation patterns: use build_runner for model serialization, JSON converters, repository code

### 🌐 API & Services

- **[api-service](api-service.md)** — Create API service classes: extend BaseAPIManager, implement auth headers, handle responses, multipart uploads
- **[ipf-api](ipf-api.md)** — iPF starter pack API management: BaseAPIManager, StarterAPIManagement, SSL pinning, digital signatures, error handling

### 📜 Lists & Pagination

- **[add-pagination](add-pagination.md)** — Implement paginated list fetching: OffsetPaginationController setup, infinite scroll, keyword search with queue-guard pattern, PaginatedView integration

### 💾 Data Persistence

- **[ipf-database](ipf-database.md)** — SQLite database integration: DatabaseManager, CRUD operations, encryption, migrations, schema
- **[ipf-preferences](ipf-preferences.md)** — SharedPreferences & SecureStorage: AppPreferences, AppSecurePrefs, typed getters/setters
- **[add-preference](add-preference.md)** — Add a new preference: define key, choose storage (normal/secure), implement getter/setter, use in app

### 🔐 Security & Session Management

- **[ipf-security](ipf-security.md)** — Security features: SSL pinning, digital signatures, certificate validation, biometric authentication
- **[app-lifecycle](app-lifecycle.md)** — Session management: activity tracking, timeout enforcement, PIN re-entry on resume, SessionLevel configuration

### 📱 Notifications & Permissions

- **[ipf-notifications](ipf-notifications.md)** — Local push notifications: notification service initialization, scheduling, payload handling, navigation
- **[add-notification](add-notification.md)** — Add a notification type: define payload, configure channel, handle tap, integrate with lifecycle

### 🌍 Localization

- **[add-l10n](add-l10n.md)** — Add localization strings: update intl_*.arb files, run generator, access via AppStrings, support multiple languages

### 🛠️ Utilities & Extensions

- **[ipf-utils](ipf-utils.md)** — Utility classes: Scenery navigation helper, AppUtility logging, SocketManager, utility mixins
- **[ipf-extensions](ipf-extensions.md)** — Extension methods: String, DateTime, Number, BuildContext, ColorScheme, TextTheme extensions

---

## Usage by Task Type

### I want to...

**...start a new project**
→ [ipf-setup](ipf-setup.md) → [guidelines](guidelines.md)

**...create a new feature**
→ [scaffold-feature](scaffold-feature.md) → [ipf-gen](ipf-gen.md) [if DB-backed] → [add-enum](add-enum.md) [if needed] → [api-service](api-service.md) → [add-provider](add-provider.md) → [add-route](add-route.md)

**...implement a paginated list with search**
→ [add-pagination](add-pagination.md)

**...add a new screen/page**
→ [add-route](add-route.md) → [ui-components](ui-components.md) or [add-widget](add-widget.md)

**...implement state management**
→ [state-management](state-management.md) → [add-provider](add-provider.md)

**...fetch data from an API**
→ [api-service](api-service.md) → [ipf-api](ipf-api.md) [reference]

**...update navigation flow**
→ [routing](routing.md) → [add-route](add-route.md)

**...manage user preferences**
→ [add-preference](add-preference.md)

**...persist data to database**
→ [ipf-gen](ipf-gen.md) → [ipf-database](ipf-database.md)

**...add a reusable UI component**
→ [ui-components](ui-components.md) → [add-widget](add-widget.md) or [generate-shared-widget-variant](generate-shared-widget-variant.md)

**...support multiple languages**
→ [add-l10n](add-l10n.md)

**...handle notifications**
→ [add-notification](add-notification.md) → [ipf-notifications](ipf-notifications.md) [reference]

**...implement session timeout / PIN re-entry**
→ [app-lifecycle](app-lifecycle.md)

**...customize app theme**
→ [theming](theming.md)

**...add security features**
→ [ipf-security](ipf-security.md)

---

## Architecture Overview

Actual `notify` layout (verified against the repo — see `docs/design/architecture/` for the full write-up):

```
lib/
├── features/                  # Feature modules (scaffold with /scaffold-feature)
│   ├── <feature>/
│   │   ├── enums/             # Feature enums (/add-enum)
│   │   ├── models/            # Request/response/domain models
│   │   ├── providers/         # State management (/add-provider), extends BaseProvider
│   │   ├── screens/           # Full routed pages
│   │   ├── services/          # Static API service classes (/api-service)
│   │   ├── data/              # Static flow config (multi-step flows only)
│   │   ├── utils/             # Feature-local helpers (some features only)
│   │   └── widgets/           # Feature-specific widgets (/add-widget)
├── root/                      # App shell: App, AuthenticatedShellScreen, HomeScreen
├── shared/                    # Shared across features
│   ├── providers/             # App-wide provider registration (providers.dart) + AppProvider/BaseProvider
│   ├── widgets/               # Reusable components (/ui-components, /add-widget)
│   │   └── repo/              # Core design-system widget catalog (AppButton, InputField, AppTile, ...)
│   ├── models/, services/, utils/, enum/, app_preference/
├── core/
│   ├── router/                # GoRouter config: router.dart (AppRoute enum + GoRouter) (/routing, /add-route)
│   ├── theme/                 # AppColors, AppTextTheme, ComponentThemes, AppSpacing, CustomColors, AppTheme (/theming)
│   ├── resources/             # Asset constants (images, svgs, videos, fonts)
│   ├── extensions/            # BuildContext/spacing/radius/safe-area extensions (/ipf-extensions)
│   └── constants/
├── services/                  # App-level singletons: APIManager, JwtService, SessionManager,
│                               # NotificationService, DatabaseManager, PaymentsService, ...
├── repositories/               # BaseRepository
├── l10n/                      # ARB source files (/add-l10n)
├── generated/                 # Generated localization output — do not hand-edit
└── main.dart                  # App entry point (/ipf-setup)
```

Notes on drift from generic starter-pack conventions: this repo uses plural `enums/`/`models/`/`services/`/`widgets/` (not `enum/`/`model/`/`service/`), has no `helper_model/` folder, and has no `lib/starter_models/`. Follow the plural convention for any new feature.

---

## Key Conventions

- **Placeholders:** Use `<your_app>`, `<Feature>`, `<feature>`, `<AppStrings>`, `<Model>` — substitute with real project values (see [guidelines](guidelines.md) section 0)
- **Naming:** Features, routes, providers use snake_case; classes use PascalCase; enum values use lowercase
- **State:** Use `BaseProvider` + `context.read/watch/select` pattern; never hardcode widget rebuilds
- **UI:** Always use theme colors (`context.colorScheme`, `context.textTheme`) — never hardcode
- **Strings:** Use localization (`<AppStrings>.instance.*`) — never hardcode user-facing text
- **Routes:** Define routes in `AppRoute` enum + `GoRouter` config — never use magic strings
- **Validation:** Only at system boundaries (user input, external APIs) — trust internal code guarantees

---

## Sensitive Areas (Require Extra Care)

Per [guidelines](guidelines.md) section 5, changes to these areas need explicit review and tests:

- Authentication and session management
- Personal / identity data (PII)
- Money, balances, and transactions
- Order/transaction state and financial calculations
- Pricing and figures users rely on
- Notification payload-driven navigation

---

## Quick Reference

| Topic | Skill | Quick Link |
|---|---|---|
| New project | ipf-setup | [→](ipf-setup.md) |
| New feature | scaffold-feature | [→](scaffold-feature.md) |
| Routing | routing | [→](routing.md) |
| Add route | add-route | [→](add-route.md) |
| State mgmt | state-management | [→](state-management.md) |
| New provider | add-provider | [→](add-provider.md) |
| Pagination | add-pagination | [→](add-pagination.md) |
| Widgets | ui-components | [→](ui-components.md) |
| New widget | add-widget | [→](add-widget.md) |
| Enums | add-enum | [→](add-enum.md) |
| DB models | ipf-gen | [→](ipf-gen.md) |
| API | api-service | [→](api-service.md) |
| Themes | theming | [→](theming.md) |
| L10n | add-l10n | [→](add-l10n.md) |
| Notifications | add-notification | [→](add-notification.md) |
| Session/PIN | app-lifecycle | [→](app-lifecycle.md) |
| Preferences | add-preference | [→](add-preference.md) |
| Security | ipf-security | [→](ipf-security.md) |
| Project guide | guidelines | [→](guidelines.md) |

---

## Questions?

- **How do I X?** → Check the skill for X in the list above
- **I don't know where to start** → [guidelines](guidelines.md) section 4 (Skill Routing Map)
- **I want to understand the architecture** → [guidelines](guidelines.md) sections 1-3
- **What files should I edit?** → See the skill's file location or architecture diagram above
