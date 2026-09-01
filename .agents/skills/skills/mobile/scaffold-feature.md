# Scaffold Feature — Create a Full Feature Module

Use this skill to scaffold the complete folder structure for a new feature following the project's
architecture.

## Arguments

`$ARGUMENTS` — feature name and brief description, e.g.
`<feature>: investment <feature> management with list, detail, and create screens`

---

## Feature Folder Structure

Every feature lives under `lib/features/<feature>/` with these subfolders:

```
lib/features/<feature>/
├── enum/                    # Feature-specific enums
│   └── <feature>_status_enum.dart
├── helper_model/            # Lightweight request/response DTOs (not DB-backed)
│   └── <feature>_create_request.dart
├── model/                   # If feature needs its own non-DB models
├── providers/               # State management
│   └── <feature>_provider.dart
├── screens/                 # Full screens (Scaffold wrappers)
│   ├── <feature>_list_screen.dart
│   ├── <feature>_details_screen.dart
│   └── <feature>_create_screen.dart
├── service/                 # API services
│   └── <feature>_services.dart
└── widgets/                 # Feature-specific reusable widgets
    ├── <feature>_card.dart
    └── <feature>_summary_widget.dart
```

---

## Scaffolding Order (do these in sequence)

### 1. Model (if new DB table is needed)

Follow `/scaffold-feature` → use `/ipf-gen` skill to add the model to `ipf_generator.dart` and run
`make ipf_gen`.

Then create `lib/models/<feature>_model.dart`:

```dart
import 'package:<your_app>/starter_models/<feature>_model.g.dart';

class <Feature>Model extends <Feature>ModelGen {
  factory <Feature>Model.fromDatabase(Map<String, dynamic> map) =>
      <Feature>ModelGen.fromDatabase(map);
  factory <Feature>Model.fromJson(Map<String, dynamic> map) =>
      <Feature>ModelGen.fromJson(map);
}
```

### 2. Enums

Create `lib/features/<feature>/enum/<feature>_status_enum.dart`. See `/add-enum` skill.

### 3. Service

Create `lib/features/<feature>/service/<feature>_services.dart`. See `/api-service` skill.

### 4. Provider

Create `lib/features/<feature>/providers/<feature>_provider.dart`. See `/add-provider` skill.
Register it in `lib/shared/providers/providers.dart`.

### 5. Localization strings

Add keys to `lib/l10n/intl_en.arb` and `lib/l10n/intl_sw.arb`, then run generator. See `/add-l10n`
skill.

### 6. Screens

Minimal screen template:

```dart
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import 'package:<your_app>/features/<feature>/providers/<feature>_provider.dart';
import 'package:<your_app>/services/strings.dart';
import 'package:<your_app>/shared/widgets/app_button.dart';

class <Feature>ListScreen extends StatefulWidget {
  const <Feature>ListScreen({super.key});

  @override
  State<<Feature>ListScreen> createState() => _<Feature>ListScreenState();
}

class _<Feature>ListScreenState extends State<<Feature>ListScreen> {
  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<<Feature>Provider>().fetch<Feature>s();
    });
  }

  @override
  Widget build(BuildContext context) {
    final isFetching = context.select<<Feature>Provider, bool>((p) => p.isFetching);
    final <feature>s = context.select<<Feature>Provider, List<<Feature>Model>>(
      (p) => p.<feature>s,
    );

    return Scaffold(
      appBar: AppBar(title: Text(<AppStrings>.instance.<feature>Title)),
      body: isFetching
          ? const Center(child:     const NotifyLoader(size: AppSpacing.px32),)
          : ListView.builder(
              itemCount: <feature>s.length,
              itemBuilder: (context, index) => <Feature>Card(<feature>: <feature>s[index]),
            ),
    );
  }
}
```

### 7. Routes

Add `AppRoute` enum values and `GoRoute` entries. See `/add-route` skill.

---

## Helper Model Template (for API request/response DTOs)

```dart
// lib/features/<feature>/helper_model/<feature>_create_request.dart
class <Feature>CreateRequest {
  final String name;
  final int type;
  final double targetAmount;

  const <Feature>CreateRequest({
    required this.name,
    required this.type,
    required this.targetAmount,
  });

  Map<String, dynamic> toJson() => {
    'name': name,
    'type': type,
    'targetAmount': targetAmount,
  };
}
```

---

## Bottom Sheet / Modal Screen

For screens that open as a bottom sheet:

```dart
// Screen widget — no Scaffold, just a Column/ListView with SafeArea
class <Feature>CreateSheet extends StatelessWidget {
  const <Feature>CreateSheet({super.key});

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // content
            AppButton.primary(
              title: <AppStrings>.instance.<feature>CreateButton,
              onPressed: () => context.pop(),
            ),
          ],
        ),
      ),
    );
  }
}
```

Route registration in `router.dart`:

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

## Checklist

- [ ] `ipf_generator.dart` updated and `make ipf_gen` run (if new DB model)
- [ ] Concrete model in `lib/models/`
- [ ] `DatabaseManager` table list updated (if DB model)
- [ ] Enums created in `lib/features/<feature>/enum/`
- [ ] Service class created in `lib/features/<feature>/service/`
- [ ] Provider created and registered in `providers.dart`
- [ ] L10n keys added to both ARBs and generator run
- [ ] Screens created with `context.select` for minimal rebuilds
- [ ] Routes added to `AppRoute` enum and `router.dart`
- [ ] Feature widgets created in `lib/features/<feature>/widgets/`
