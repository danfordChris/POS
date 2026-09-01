# Add Route — Register a New Screen in GoRouter

Use this skill to add a new route to the app's GoRouter configuration.

## Arguments
`$ARGUMENTS` — route name, path, screen class, data it receives, and where it belongs (auth flow / main app / modal), e.g. `<feature>Details, /<feature>/:<feature>Id, <Feature>DetailsScreen, receives <feature>Id as path param and <Feature>Model as extra, main app under markets branch`

---

## Files to Edit

| File | What to change |
|---|---|
| `lib/core/router/router.dart` | Add `AppRoute` enum value + `GoRoute` entry |
| `lib/core/router/navigation_keys.dart` | Add `GlobalKey` only if a new nested navigator is needed |

---

## Step 1 — Add the `AppRoute` Enum Value

Open `lib/core/router/router.dart`. Find the `AppRoute` enum and add the new entry:

```dart
enum AppRoute {
  // ... existing routes ...
  <feature>Details('/<feature>/:<feature>Id'),  // path param syntax
  <feature>Create('/<feature>/create'),          // static path
  ;

  const AppRoute(this.path);
  final String path;

  // helpers already defined — do not change them:
  static AppRoute byPath(String path) => ...
  String appendId(int? id) => '$path/$id';
}
```

**Path param syntax:** use `:paramName` inside the path string.

---

## Step 2 — Add the `GoRoute` Entry

Find the correct location in the `routes` list:

- **Auth/onboarding screens** → inside the first `StatefulShellRoute` (onboarding shell)
- **LDM waiting screens** → inside the second `StatefulShellRoute`
- **Main app screens** (your bottom-nav tabs, e.g. `home`, `<tabA>`, `<tabB>`) → inside the matching `StatefulShellBranch` under the main `StatefulShellRoute`
- **Modal / bottom sheet screens** → `pageBuilder` with `ModalSheetPage`
- **Global screens** (accessible from anywhere) → at the top-level routes list with `parentNavigatorKey: NavigationKeys.root`

### Standard screen:
```dart
GoRoute(
  path: AppRoute.<feature>Details.path,
  pageBuilder: (context, state) {
    final <feature>Id = int.parse(state.pathParameters['<feature>Id']!);
    final <feature> = state.extra as <Feature>Model?;
    return AppTransitions.fadeAndSlideTransition(
      state,
      <Feature>DetailsScreen(<feature>Id: <feature>Id, <feature>: <feature>),
    );
  },
),
```

### Modal sheet screen:
```dart
GoRoute(
  path: AppRoute.<feature>Create.path,
  parentNavigatorKey: NavigationKeys.root,
  pageBuilder: (context, state) => ModalSheetPage(
    swipeDismissible: true,
    child: const <Feature>CreateSheet(),
  ),
),
```

---

## Step 3 — Navigate to the New Route

```dart
// Simple push:
context.push(AppRoute.<feature>Details.path.replaceFirst(':<feature>Id', '$id'));

// With extra data:
context.push(
  AppRoute.<feature>Details.path.replaceFirst(':<feature>Id', '$id'),
  extra: <feature>,
);

// Replace current route (no back button):
context.go(AppRoute.<feature>Create.path);

// Pop back:
context.pop();

// Pop with result:
context.pop(resultValue);
```

---

## Available Transition Helpers (`AppTransitions`)

| Helper | Effect |
|---|---|
| `AppTransitions.fadeAndSlideTransition(state, widget)` | Default push transition |
| `AppTransitions.slideTransition(state, widget)` | Slide from right |
| `AppTransitions.popTransition(state, widget)` | Used for pop-like screens |
| `AppTransitions.fadeCurveTransition(state, widget)` | Fade only |

---

## Passing Complex Data

When a screen needs a model object (not just an ID):

**Push:**
```dart
context.push(AppRoute.<feature>Details.path.replaceFirst(':<feature>Id', '$id'), extra: {'<feature>': <feature>});
```

**Receive (in route builder):**
```dart
final extra = state.extra as Map<String, dynamic>;
final <feature> = extra['<feature>'] as <Feature>Model;
```

Use `BaseModel.castToInt/castToBool/castToString` when extracting primitives from the extra map.

---

## Navigation Keys — When to Add One

Only add a new `GlobalKey<NavigatorState>` in `navigation_keys.dart` when:
- You are adding a **new tab** to the bottom navigation bar (new `StatefulShellBranch`).

For all other routes, reuse an existing key or rely on `NavigationKeys.root`.

---

## Checklist

- [ ] `AppRoute` enum value added with correct path string
- [ ] `GoRoute` entry added in the right shell/branch
- [ ] Path parameters match between enum path and `state.pathParameters` key
- [ ] Transition helper used (not raw `MaterialPage`)
- [ ] Navigation call uses `AppRoute.<name>.path` (never a hardcoded string)
