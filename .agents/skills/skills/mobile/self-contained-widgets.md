# Self-Contained Feature Widgets

Use this skill whenever a screen has complex sub-sections (tabs, steps, panels) where each section
owns distinct state and performs its own provider actions.

**Canonical reference:** `lib/features/contacts/screens/new_contact_screen.dart` +
`lib/features/contacts/widgets/manual_contact_tab.dart`, `phone_contact_tab.dart`,
`file_contact_tab.dart`

---

## Core Principle

> A widget that has its own state and its own actions is a `StatefulWidget` that lives in
`lib/features/<feature>/widgets/`. It reads the provider directly. The screen that contains it is a
> thin shell — it holds only the state that **coordinates** between widgets (e.g. which tab is
> active).

### The layered responsibility split

```
Screen           → orchestration only (active tab, inter-widget signals)
  └─ Widget      → UI + local state + action methods
       └─ Provider → loading flags, server state, mutation methods
            └─ Service → raw API calls
```

**The screen never calls a service.** The widget never calls a service. Every mutation goes through
the provider.

---

## When to Apply This Pattern

Use self-contained widgets when a screen section:

- Has its own form / controllers that need `dispose()`
- Fires its own provider mutations (create, import, upload)
- Has independent loading state from other sections
- Would make the screen's `State` class hold 3+ groups of unrelated fields

If the sub-widget is just display with a callback, a `StatelessWidget` with params is still
correct — don't over-engineer.

---

## Anatomy of a Self-Contained Widget

```dart
// lib/features/<feature>/widgets/<name>_tab.dart

class <Name>Tab extends StatefulWidget {
  const <Name>Tab({super.key});  // ← no params (reads provider itself)

  @override
  State<<Name>Tab> createState() => _<Name>TabState();
}

class _<Name>TabState extends State<<Name>Tab> {
  // 1. Local controllers & state
  final _formKey = GlobalKey<FormState>();
  final _nameController = TextEditingController();
  String _phone = '';
  <Model>? _selectedItem;

  @override
  void dispose() {
    _nameController.dispose();
    super.dispose();
  }

  // 2. Action methods (call the provider, never the service)
  Future<void> _save() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;

    final request = Create<Feature>Request(
      name: _nameController.text.trim(),
      phone: _phone,
    );

    try {
      await context.read<<Feature>Provider>().create<Feature>(request: request);
      if (!mounted) return;
      AppAlert.show(message: '${request.name} saved.');
      context.pop();              // navigate from inside the widget — correct
    } catch (_) {
      // provider / SessionManager already showed the error
    }
  }

  // 3. Build reads provider for loading flags and list data
  @override
  Widget build(BuildContext context) {
    final provider = context.watch<<Feature>Provider>();
    final isSaving = provider.isCreating<Feature>;

    return SingleChildScrollView(
      padding: const EdgeInsets.all(AppSpacing.px16),
      child: Form(
        key: _formKey,
        child: Column(
          children: [
            InputField<String>(
              controller: _nameController,
              labelText: 'Name',
              validator: (v) => (v ?? '').isEmpty ? 'Required' : null,
            ),
            // ... more fields
            AppButton(
              title: 'Save',
              loading: isSaving,
              onPressed: isSaving ? null : _save,
            ),
          ],
        ),
      ),
    );
  }
}
```

---

## The Screen Shell

When widgets are fully self-contained, the screen becomes a coordinator only:

```dart
// lib/features/<feature>/screens/<feature>_screen.dart

class <Feature>Screen extends StatefulWidget {
  const <Feature>Screen({super.key});

  @override
  State<<Feature>Screen> createState() => _<Feature>ScreenState();
}

class _<Feature>ScreenState extends State<<Feature>Screen> {
  // Only state that crosses widget boundaries — e.g. the active tab
  <Method> _method = <Method>.manual;

  @override
  void initState() {
    super.initState();
    // One-time preloads that all tabs will need
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final p = context.read<<Feature>Provider>();
      if (p.groups.isEmpty) p.loadGroups();
    });
  }

  @override
  Widget build(BuildContext context) {
    return AppLayoutShell(
      appBar: <Feature>AppBar(method: _method),
      child: Column(
        children: [
          <Method>TabBar(
            selected: _method,
            onChanged: (m) => setState(() => _method = m),
          ),
          Expanded(
            // IndexedStack keeps ALL tabs alive — state survives tab switches
            child: IndexedStack(
              index: _method.index,
              children: const [
                <Name>TabA(),
                <Name>TabB(),
                <Name>TabC(),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
```

---

## IndexedStack vs AnimatedSwitcher

|                     | `IndexedStack`                       | `AnimatedSwitcher`        |
|---------------------|--------------------------------------|---------------------------|
| Tab state on switch | **Preserved**                        | Lost (widget recreated)   |
| All tabs active     | Yes — `initState` runs immediately   | No — lazy on first switch |
| Animation           | None (instant)                       | Fade / slide              |
| Use when            | Tabs that load data (forms, pickers) | Simple display swaps      |

**Default: `IndexedStack`.** The benefit of preserving loaded contacts / form progress outweighs the
lack of animation. Use `AnimatedSwitcher` only for trivial display-only swaps.

---

## Enum Index Alignment (critical)

`IndexedStack.index` is an `int`. Enum `.index` is zero-based in declaration order. The two **must**
match:

```dart
// ✓ Declaration order matches IndexedStack children order
enum AddMethod { manual, phone, file }
//               0       1      2

IndexedStack(
  index: _method.index,
  children: const [
    ManualTab(),   // index 0
    PhoneTab(),    // index 1
    FileTab(),     // index 2
  ],
)
```

---

## What Goes Where

| Concern                  | Screen                         | Widget                       |
|--------------------------|--------------------------------|------------------------------|
| Which tab is active      | ✓                              | —                            |
| Form controllers         | —                              | ✓                            |
| Loading flags (local)    | —                              | ✓                            |
| Loading flags (provider) | —                              | `context.watch` in `build()` |
| `StreamSubscription`     | —                              | ✓ + `dispose()`              |
| `createContact()` call   | —                              | ✓ in action method           |
| `loadGroups()` preload   | ✓ (once, shared)               | —                            |
| `context.pop()`          | —                              | ✓ after success              |
| AppBar title             | AppBar widget (reads `method`) | —                            |
| Download / util actions  | AppBar widget (self-contained) | —                            |

---

## AppBar as a Self-Contained Widget

App bars that change with the active tab should be their own widget and handle their own utility
actions:

```dart
class <Feature>AppBar extends StatelessWidget {
  const <Feature>AppBar({super.key, required this.method});

  final AddMethod method;

  // Utility action lives here — not passed as a callback from the screen
  void _downloadTemplate() =>
      AppAlert.show(message: 'Template download coming soon.');

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        AppActionButton(onPressed: () => context.pop()),  // ← no onBack callback needed
        Text(_titleFor(method)),
        if (method == AddMethod.file)
          AppActionButton(onPressed: _downloadTemplate),
      ],
    );
  }

  String _titleFor(AddMethod m) => switch (m) {
    AddMethod.manual => 'Add',
    AddMethod.phone  => 'Import',
    AddMethod.file   => 'Upload',
  };
}
```

---

## Permission-Gated Widgets

For tabs that need system permissions (contacts, camera, location):

```dart
// Don't auto-request in initState — show a gate UI instead.
// The widget requests permission only when the user explicitly taps the button.

@override
Widget build(BuildContext context) {
  if (_isLoading) return const Center(child:     const NotifyLoader(size: AppSpacing.px32),);
  if (!_loaded)   return _PermissionGate(onRequest: _requestAndLoad);
  return /* normal content */;
}

// _PermissionGate is a private StatelessWidget in the same file
class _PermissionGate extends StatelessWidget {
  const _PermissionGate({required this.onRequest});
  final VoidCallback onRequest;

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        // icon + explanation copy
        AppButton(title: 'Allow Access', expands: true, onPressed: onRequest),
      ],
    );
  }
}
```

**Why not `initState`?** With `IndexedStack` all tabs initialize at once. Auto-requesting on
`initState` would fire a permission dialog before the user ever taps the tab.

---

## Provider: What the Widget Needs

The provider must expose:

1. **Boolean flags** for each mutation: `isCreating<Feature>`, `isImporting`, `isUploading`
2. **List data** consumed by the widget: `groups`, `contacts`
3. **Mutation methods** returning `Future` that throw on error (so `catch` in the widget can detect
   failure without reading an error field)

```dart
class <Feature>Provider extends BaseProvider {
  // Flags
  bool _isCreating = false;
  bool get isCreating => _isCreating;

  // Data
  List<GroupModel> _groups = [];
  List<GroupModel> get groups => List.unmodifiable(_groups);

  // Mutation — throws on error so the widget's try/catch fires
  Future<<Feature>Model> create<Feature>({required Create<Feature>Request request}) async {
    _isCreating = true; notifyListeners();
    try {
      final result = await _service.create(request);
      _<feature>s = [result, ..._<feature>s];
      notifyListeners();
      return result;
    } finally {
      _isCreating = false; notifyListeners();
    }
  }
}
```

---

## Anti-Patterns to Avoid

```dart
// ✗ Screen passes 12 callbacks down to a widget
ManualTab(
  formKey: _formKey,
  controller: _ctrl,
  onSave: _saveContact,     // screen method
  onCancel: () => context.pop(),
  isSaving: provider.isCreating,
  groups: provider.groups,
  selectedGroup: _group,
  onGroupChanged: (g) => setState(() => _group = g),
  ...
)

// ✓ Widget owns everything — zero params
const ManualTab()

// ✗ Widget calls the service directly
await ContactsService.createContact(request);  // bypasses provider

// ✓ Widget calls the provider
await context.read<ContactsProvider>().createContact(request: request);

// ✗ Screen holds state for all tabs and routes it via params
String _contactQuery = '';
bool _contactsLoaded = false;
List<DeviceContact> _deviceContacts = const [];
// ... 15 more lines of phone-tab state in the screen

// ✓ PhoneTab owns its own state — screen holds nothing for it
```

---

## File Placement Checklist

```
lib/features/<feature>/
  screens/
    <feature>_screen.dart          ← shell only, < 60 lines
  widgets/
    <name>_tab_bar.dart            ← enum + tab bar widget
    <name>_app_bar.dart            ← app bar with utility actions
    <section_a>_tab.dart           ← fully self-contained StatefulWidget
    <section_b>_tab.dart           ← fully self-contained StatefulWidget
    <section_c>_tab.dart           ← fully self-contained StatefulWidget
    <shared_sub_widget>.dart       ← StatelessWidget used by 2+ tabs
```

Private helper widgets (`_StepCard`, `_PermissionGate`, `_ContactTile`) stay in the same file as the
tab that uses them exclusively.
