# App Lifecycle — Session Security & Background/Resume Handling

Use this skill when handling app pause, resume, background, inactive, or detached states — especially for enforcing PIN re-entry and biometric verification in this financial app.

---

## How the Lifecycle System Works (End-to-End)

```
User interaction (tap anywhere)
        │
        ▼
ActivityWrapper (lib/shared/activity_wrapper.dart)
  └─ onPointerDown → AppLifeCycleSessionManager().userActivityDetected()
                           │ debounced (1500ms) → updates _lastActivity
                           │
App goes to background (paused/hidden)
        │
        ▼
AppLifecycleHandler.didChangeAppLifecycleState()
  ├─ paused / hidden → _session.appMovedToBackground()  ← stamps _lastActivity
  └─ resumed         → _session.appResumed()
                           │ diff = now - _lastActivity
                           │ diff > _currentLevel.timeout?
                           ├─ YES + requireBiometric → try onBiometricAuth()
                           │       ├─ success → reset _lastActivity, continue
                           │       └─ fail    → call onLogout()
                           └─ YES, no biometric  → call onLogout() directly
```

**Key files:**

| File | Role |
|---|---|
| `lib/services/app_life_cycle_handler.dart` | `WidgetsBindingObserver` — receives Flutter lifecycle events |
| `lib/services/app_life_cycle_session_manager.dart` | Singleton — owns the timeout logic and `SessionLevel` |
| `lib/shared/activity_wrapper.dart` | Root `Listener` widget — resets idle timer on every tap |
| `lib/main.dart` | Wires `onLogout` and `onBiometricAuth` callbacks |

---

## Session Levels

Defined in `AppLifeCycleSessionManager` (`lib/services/app_life_cycle_session_manager.dart`):

| Level | Timeout | Requires biometric |
|---|---|---|
| `SessionLevel.normal` | 10 minutes | No |
| `SessionLevel.sensitive` | 5 minutes | Yes |
| `SessionLevel.critical` | 1 minute | Yes |

Default is `SessionLevel.critical` — appropriate for a financial app.

---

## Step 1 — Wire the `onLogout` Callback in `main.dart`

The `onLogout` callback is currently set to an empty function. It must navigate to the PIN login screen.

**File:** `lib/main.dart`

```dart
appLifeCycleSessionManager.onLogout = () {
  // Navigate to PIN login, clearing the entire back stack
  NavigationKeys.root.currentContext?.go(AppRoute.pinCodeLogin.path);
};
```

`NavigationKeys.root` is the root `GlobalKey<NavigatorState>` — it works from outside the widget tree (no `BuildContext` needed).

---

## Step 2 — Wire the `onBiometricAuth` Callback in `main.dart`

For `SessionLevel.sensitive` and `SessionLevel.critical`, the manager will try biometrics before forcing logout.

```dart
appLifeCycleSessionManager.onBiometricAuth = () async {
  final context = NavigationKeys.root.currentContext;
  if (context == null) return false;
  final localAuthProvider = context.read<LocalAuthenticationProvider>();
  return await localAuthProvider.authenticateWithBiometrics();
};
```

If the device has no biometric enrolled or the user cancels, `authenticateWithBiometrics()` returns `false` → the manager falls through to `onLogout`.

---

## Step 3 — Start / Stop the Session

The session timer must only run when the user is logged in. Call these from your `AuthProvider`:

```dart
// After successful PIN/biometric login:
AppLifeCycleSessionManager().start();

// On explicit logout (user taps "Log Out"):
AppLifeCycleSessionManager().stop();
```

`start()` initializes `_lastActivity = DateTime.now()`.
`stop()` sets `_lastActivity = null`, so `appResumed()` becomes a no-op until `start()` is called again.

---

## Step 4 — Set Session Level Per Screen (Optional)

Call `setSessionLevel` from a screen's `initState` to tighten or relax the timeout for that flow:

```dart
@override
void initState() {
  super.initState();
  // Tighten to critical on screens that show sensitive data:
  AppLifeCycleSessionManager().setSessionLevel(SessionLevel.critical);
}

@override
void dispose() {
  // Relax back to normal when leaving:
  AppLifeCycleSessionManager().setSessionLevel(SessionLevel.normal);
  super.dispose();
}
```

**Recommended levels by screen type:**

| Screen | Level |
|---|---|
| Home / Markets list | `normal` (10 min) |
| Order placement, Payments | `sensitive` (5 min) |
| PIN setup, Change PIN, Personal details | `critical` (1 min) |
| PIN code login screen itself | Do not set (session not yet started) |

---

## Step 5 — PIN Login Screen Flow

The `PinCodeLoginScreen` (`lib/features/auth/screens/auth/pin_code_login_screen.dart`) is already the re-entry gate:
- Validates PIN against `AuthPreference.instance.userPin`
- On success: calls `authProvider.userLogin(user)` then `context.go(AppRoute.home.path)`
- Supports biometric shortcut on launch (checks `Preferences.instance.allowBiometric`)
- "Forgot PIN" flow: requests OTP → re-verifies → lets user set a new PIN

When `onLogout` fires via lifecycle timeout, simply navigate here:
```dart
NavigationKeys.root.currentContext?.go(AppRoute.pinCodeLogin.path);
```
`context.go()` replaces the entire navigation stack — the user cannot press back to bypass the PIN.

---

## Step 6 — Prevent Screenshots on Sensitive Screens (Optional)

For screens showing account balances, personal info, or trade details, prevent screenshots:

```dart
import 'package:flutter_windowmanager/flutter_windowmanager.dart';

@override
void initState() {
  super.initState();
  FlutterWindowManager.addFlags(FlutterWindowManager.FLAG_SECURE); // Android
}

@override
void dispose() {
  FlutterWindowManager.clearFlags(FlutterWindowManager.FLAG_SECURE);
  super.dispose();
}
```

---

## Full Wiring Summary (main.dart)

```dart
AppLifeCycleSessionManager appLifeCycleSessionManager = AppLifeCycleSessionManager();
AppLifecycleHandler lifecycle = AppLifecycleHandler();

lifecycle.init(); // registers WidgetsBindingObserver

appLifeCycleSessionManager.onLogout = () {
  NavigationKeys.root.currentContext?.go(AppRoute.pinCodeLogin.path);
};

appLifeCycleSessionManager.onBiometricAuth = () async {
  final ctx = NavigationKeys.root.currentContext;
  if (ctx == null) return false;
  return await ctx.read<LocalAuthenticationProvider>().authenticateWithBiometrics();
};

// Start the session after app is ready (call again after every successful login):
appLifeCycleSessionManager.start();
```

---

## AppLifecycleState Reference

| Flutter state | Meaning | Handler action |
|---|---|---|
| `resumed` | App is in foreground, interactive | Check elapsed time → PIN or biometric if needed |
| `paused` | App sent to background (Android) / home screen | Stamp `_lastActivity` |
| `hidden` | App hidden but not paused (iOS multitasker) | Stamp `_lastActivity` (same as paused) |
| `inactive` | Phone call overlay, split view | No action (brief, no timeout needed) |
| `detached` | Flutter engine running, no view (rare) | No action |

---

## Debugging Lifecycle Events

`AppLifecycleHandler` calls `AppUtility.log("App Resumed")` / `"App Paused/Hidden"` for each transition. Check the debug console (or Logcat/Console) to verify events fire correctly.

To force a timeout for testing, temporarily set a very short timeout:
```dart
// In AppLifeCycleSessionManager, temporarily:
case SessionLevel.critical:
  return const Duration(seconds: 5); // test only — revert before commit
```

---

## Checklist

- [ ] `onLogout` callback in `main.dart` navigates to `AppRoute.pinCodeLogin` via `NavigationKeys.root`
- [ ] `onBiometricAuth` callback delegates to `LocalAuthenticationProvider.authenticateWithBiometrics()`
- [ ] `AppLifeCycleSessionManager().start()` called after successful login
- [ ] `AppLifeCycleSessionManager().stop()` called on explicit logout
- [ ] `SessionLevel` set appropriately on sensitive screens
- [ ] `ActivityWrapper` wraps the root `App` widget (already in `main.dart` — do not remove)
- [ ] `lifecycle.init()` is called before `runApp` (already in `main.dart`)
- [ ] `lifecycle.dispose()` is called if the app's root widget is ever torn down
