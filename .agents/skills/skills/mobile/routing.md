# Routing Documentation (GoRouter Implementation Guide)

`notify` uses `go_router` (`^17.2.3`) via a single `GoRouter` instance in `lib/core/router/router.dart`. Canonical source: `docs/design/architecture/routing.md`. This repo does **not** have a `navigation_keys.dart` or per-tab `GlobalKey<NavigatorState>`s — `StatefulShellRoute.indexedStack` manages per-branch navigator stacks internally.

## 1. Route Definition

All routes are enumerated in `enum AppRoute` (in `router.dart` itself — `lib/core/router/app_route.dart` is currently an empty/dead file, don't add routes there):

```dart
enum AppRoute {
  splash('/'),
  aiAgentCreate('/ai-agent/create'),
  // ...
  ;

  const AppRoute(this.path);
  final String path;
}
```

Every `GoRoute` references `AppRoute.<name>.name` and `AppRoute.<name>.path` — never an inline path string.

## 2. The Authenticated Tab Shell

The 5 bottom-nav tabs (`home`, `contacts`, `messages`, `campaigns`, `settings`) are `StatefulShellRoute.indexedStack` branches:

```dart
StatefulShellRoute.indexedStack(
  builder: (context, state, navigationShell) =>
      AuthenticatedShellScreen(navigationShell: navigationShell),
  branches: [
    StatefulShellBranch(
      routes: [
        GoRoute(
          name: AppRoute.home.name,
          path: AppRoute.home.path,
          builder: (context, state) => const HomeScreen(),
        ),
      ],
    ),
    // ...contacts, messages, campaigns, settings branches
  ],
)
```

`AuthenticatedShellScreen` keeps the app bar and bottom nav mounted; only `navigationShell` content swaps per tab, preserving each tab's state. Everything outside these 5 tabs (detail screens, multi-step flows, secondary settings screens) is a standalone top-level `GoRoute`, not a shell branch.

## 3. Passing Data (`extra`)

**Typed draft with a fallback default** — the pattern used by Quick Send SMS, Campaigns, and AI Agent flows:
```dart
GoRoute(
  name: AppRoute.quickSendSms.name,
  path: AppRoute.quickSendSms.path,
  builder: (context, state) => QuickSendSmsScreen(
    initialDraft: state.extra is QuickSendSmsDraft
        ? state.extra as QuickSendSmsDraft
        : defaultQuickSendSmsDraft,
  ),
),
```

**Direct cast for detail screens** (no fallback — caller must pass the right type):
```dart
GoRoute(
  name: AppRoute.campaignDetail.name,
  path: AppRoute.campaignDetail.path,
  builder: (context, state) =>
      CampaignDetailScreen(campaign: state.extra as CampaignModel),
),
```

Sending:
```dart
context.push(AppRoute.campaignDetail.path, extra: campaign);
```

Prefer a typed draft/model over a raw `Map<String, dynamic>` extra for new routes (one existing route, `newContact`, uses a map for a single optional key — treat that as the exception, not the pattern to copy).

## 4. Transitions

Default `builder:` uses the platform push transition. For a deliberate entrance transition, reuse the shared helper already defined at the bottom of `router.dart` instead of writing a new `CustomTransitionPage`:

```dart
GoRoute(
  name: AppRoute.selcomCheckout.name,
  path: AppRoute.selcomCheckout.path,
  pageBuilder: (context, state) => fadeSlidePage(
    key: state.pageKey,
    child: SelcomCheckoutScreen(order: state.extra as SubscriptionPaymentOrder),
  ),
),
```

`fadeSlidePage` is a 700ms fade + 0.08-offset slide-up transition.

## 5. Adding a Route — Checklist

1. Add a `name('/path')` entry to `enum AppRoute` in `router.dart`.
2. Add the matching `GoRoute` in the same file (import the screen at the top with the other feature imports, alphabetized by feature).
3. If the screen needs caller-supplied data, add a typed constructor parameter and read it from `state.extra` with an `is` check + explicit fallback (see §3) — don't add a new `Map<String, dynamic>` extra route.
4. If it's a new bottom-nav tab (rare), add a `StatefulShellBranch` inside the existing `StatefulShellRoute.indexedStack`, not a standalone route.
5. Also see [add-route.md](add-route.md).
