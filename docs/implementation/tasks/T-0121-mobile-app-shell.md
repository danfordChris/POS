# T-0121 Mobile — App Shell (auth, session, routing, bottom nav)

## Status

- `done`
- Last updated: 2026-09-02

## Linked Phase

- Phase 02 — Inventory Core (client foundation; unblocks T-0106–T-0108)

## Agent Context

- Skills: mobile, workflow-contract
- Design docs: `docs/design/interfaces/mobile-app-spec.md`, `docs/design/interfaces/api-contract.md`, `docs/design/interfaces/ui-design-system.md`
- Constraints: tokens in `flutter_secure_storage`; a single `SessionController` drives routing; every API failure maps to `ApiException` (the `{ error }` envelope) and renders via `ErrorByCodeCard`; storage/plugin failure must land on sign-in, never crash; neumorphic kit only (no hard-coded colors).
- Do not touch: `services/*`, `web/`.

## Objective

`mobile/` boots into a real authenticated shell: sign in / register / create-business against Kong, a `go_router` redirect driven by session state, and the bottom-nav chrome (Home / Catalog / Scan / Sell / More).

## Scope Boundary

**In scope:**
- `data/`: `api_client.dart` (Dio + bearer + one-shot 401 refresh + `ApiException` mapping), `token_store.dart`, `auth_repository.dart`, `session.dart` (`SessionController`: `loading → signedOut → needsBusiness → ready`).
- `app/`: `router.dart` (session-driven redirect, `StatefulShellRoute` bottom nav), `app_shell.dart` (app bar + neumorphic bottom bar, Scan raised), `session_scope.dart` (`InheritedNotifier`), `theme_mode.dart`.
- `screens/`: real `login` / `register` / `onboarding`; themed stubs `home` / `catalog` / `scan` / `sell`; `more` (account, sign out, gallery link); `gallery_screen.dart` (moved out of `main.dart`).
- `main.dart` rewired to `MaterialApp.router`; `pubspec` deps `go_router`, `dio`, `flutter_secure_storage`.

**Out of scope:**
- Any data screen (catalog list, sell flow, scan camera) — T-0106–T-0108.
- Winger single-catalog mode, offline write-queue banner — later.
- Multi-business switcher — blocked on a `GET /v1/businesses` list endpoint (backlog).

## Acceptance Criteria

- With no stored tokens the app boots to the sign-in screen; with a valid session it boots to `/home` inside the bottom-nav shell; `needsBusiness` forces `/onboarding`.
- `api_client` attaches `Authorization: Bearer <access>`, retries once after refreshing on a 401, and calls `onAuthLost` (→ `signOut`) when refresh fails.
- A failed login shows an `ErrorByCodeCard` with the API `error.code`; the app does not navigate.
- `SessionController.bootstrap()` catches any storage/plugin error and sets `signedOut`.
- The bottom nav has five items with Scan raised/emphasized; `More` exposes sign-out and the design-system gallery.
- `flutter analyze` → "No issues found!"; `flutter test` passes.

## Dependencies

- T-0114 (Kong), T-0112 (identity auth), T-0113 (tenancy businesses + `role` echo), T-0119 (design system)

## Implementation Checklist

1. `pubspec`: add `go_router`, `dio`, `flutter_secure_storage`; `flutter pub get`.
2. `data/`: api client, token store, auth repo, session controller.
3. `app/`: session scope, router with redirect, app shell + bottom bar.
4. `screens/`: auth screens (real) + stubs + more; move gallery out of `main.dart`.
5. `main.dart` → `MaterialApp.router`; wire `SessionScope` + `bootstrap()`.
6. widget tests with `FlutterSecureStorage.setMockInitialValues({})`; `flutter analyze` + `test`.

## Verification

- `flutter analyze` → "No issues found!"; `flutter test` → 3 passing (unauthenticated boot → sign-in; login fields + no shell; both `buildDukaTheme` brightnesses).
- Live auth (login → onboarding → shell) exercised against `docker compose up` (Kong + identity + tenancy); emulator uses `--dart-define=API_BASE_URL=http://10.0.2.2:8000`.
