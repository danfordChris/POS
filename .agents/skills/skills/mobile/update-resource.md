# Update Resource — Typed Request Model + PATCH/PUT Endpoint

Use this skill whenever a feature needs to **edit and save an existing server resource** — a user profile, account settings, or any object the user can partially modify.

## Arguments

`$ARGUMENTS` — feature name and editable fields, e.g.  
`<feature>: update fullName, email, address, companyName (all optional)`

---

## Pattern Overview

```
Screen
  → builds <Feature>UpdateRequest (null for untouched fields)
  → <Feature>Provider.update(request)
      → <Feature>Services.update(request)
          → jsonEncode(request.toJson)   // toJson omits null keys
          → apiAuthPatch / apiAuthPut
          → returns updated <Feature>Response
      → _data = updated response
      → notifyListeners()
  → AppAlert.show  →  context.pop()
```

**Rule: null fields are never sent.** The request model's `get toJson` is the single place where null-filtering happens. The service, provider, and screen are all free of filtering logic.

---

## 1 — Request Model

Location: `lib/features/<feature>/models/<feature>_update_request.dart`

All fields are **nullable** — a field that the user left blank stays `null` and is skipped by `toJson`.

```dart
class <Feature>UpdateRequest {
  const <Feature>UpdateRequest({
    this.fieldA,
    this.fieldB,
    this.fieldC,
  });

  final String? fieldA;
  final String? fieldB;
  final String? fieldC;

  /// Only maps non-null fields — null entries are never sent to the API.
  Map<String, dynamic> get toJson {
    final map = <String, dynamic>{};
    if (fieldA != null) map['fieldA'] = fieldA;
    if (fieldB != null) map['fieldB'] = fieldB;
    if (fieldC != null) map['fieldC'] = fieldC;
    return map;
  }
}
```

> Use a **getter** (`get toJson`) not a method (`toJson()`), matching the project's `RegistrationRequest` convention.

---

## 2 — Response Model

Location: `lib/features/<feature>/models/<feature>_response.dart`

All server-nullable fields must be `String?`, `int?`, etc. — **never cast nullable JSON values to non-nullable types**.

```dart
class <Feature>Response {
  const <Feature>Response({
    required this.id,
    required this.phone,         // always present
    this.fullName,               // nullable in API
    this.email,
    this.address,
  });

  final int id;
  final String phone;
  final String? fullName;
  final String? email;
  final String? address;

  /// Fallback display name when optional fields are empty.
  String get displayName => fullName?.trim().isNotEmpty == true ? fullName! : phone;

  /// Two-letter initials for avatars.
  String get initials {
    final n = fullName?.trim() ?? '';
    if (n.isEmpty) return phone.isNotEmpty ? phone[0].toUpperCase() : '?';
    final parts = n.split(RegExp(r'\s+')).where((p) => p.isNotEmpty).toList();
    if (parts.length == 1) return parts[0][0].toUpperCase();
    return '${parts[0][0]}${parts.last[0]}'.toUpperCase();
  }

  factory <Feature>Response.fromJson(Map<String, dynamic> json) {
    return <Feature>Response(
      id: (json['id'] as num?)?.toInt() ?? 0,
      phone: json['phone'] as String? ?? '',
      fullName: json['fullName'] as String?,
      email: json['email'] as String?,
      address: json['address'] as String?,
    );
  }
}
```

> Cast each field explicitly (`as String?`, `as num?`) so a wrong type from the server never crashes `fromJson` silently.

---

## 3 — Service

Location: `lib/features/<feature>/services/<feature>_services.dart`

```dart
import 'dart:convert';

import 'package:ipf_flutter_starter_pack/ipf_flutter_starter_pack.dart';
import 'package:notify/features/<feature>/models/<feature>_response.dart';
import 'package:notify/features/<feature>/models/<feature>_update_request.dart';
import 'package:notify/services/api_manager.dart';

class _Endpoints {
  static const String resource = '/<feature>/me';
}

class <Feature>Services {
  <Feature>Services._();

  /// Fetch the current resource state from the server.
  static Future<<Feature>Response> get current async {
    final APIResponse apiResponse = await APIManager.instance.apiAuthGet(_Endpoints.resource);
    apiResponse.log();
    apiResponse.raiseOnError();
    return <Feature>Response.fromJson(apiResponse.mapData);
  }

  /// Partially update the resource — only sends fields present in request.toJson.
  static Future<<Feature>Response> update({required <Feature>UpdateRequest request}) async {
    final APIResponse apiResponse = await APIManager.instance.apiAuthPatch(
      _Endpoints.resource,
      body: jsonEncode(request.toJson),
    );
    apiResponse.log();
    apiResponse.raiseOnError();
    return <Feature>Response.fromJson(apiResponse.mapData);
  }
}
```

> Use `apiAuthPatch` for partial updates (server ignores absent keys).  
> Use `apiAuthPut` only when the server requires a full replacement body.

---

## 4 — Provider

Location: `lib/features/<feature>/providers/<feature>_provider.dart`

```dart
import 'package:ipf_flutter_starter_pack/ipf_flutter_starter_pack.dart';
import 'package:notify/features/<feature>/models/<feature>_response.dart';
import 'package:notify/features/<feature>/models/<feature>_update_request.dart';
import 'package:notify/features/<feature>/services/<feature>_services.dart';
import 'package:notify/services/session_manager.dart';
import 'package:notify/shared/providers/base_provider.dart';

class <Feature>Provider extends BaseProvider {
  // ── fetch state ─────────────────────────────────────────────────────────
  bool? _isLoading;
  bool get isLoading => _isLoading ?? false;

  <Feature>Response? _data;
  <Feature>Response? get data => _data;

  // ── update state ─────────────────────────────────────────────────────────
  bool? _isUpdating;
  bool get isUpdating => _isUpdating ?? false;

  // ── actions ──────────────────────────────────────────────────────────────

  Future<void> get load async {
    try {
      _setIsLoading(true);
      _data = await <Feature>Services.current;
    } catch (e) {
      AppUtility.log('Load error: $e');
      SessionManager.handleError(e);
      rethrow;
    } finally {
      _setIsLoading(false);
    }
  }

  Future<void> update({required <Feature>UpdateRequest request}) async {
    try {
      _setIsUpdating(true);
      _data = await <Feature>Services.update(request: request);
    } catch (e) {
      AppUtility.log('Update error: $e');
      SessionManager.handleError(e);
      rethrow; // let the screen handle post-error UX
    } finally {
      _setIsUpdating(false);
    }
  }

  // ── private setters ───────────────────────────────────────────────────────

  void _setIsLoading(bool v) { _isLoading = v; notifyListeners(); }
  void _setIsUpdating(bool v) { _isUpdating = v; notifyListeners(); }
}
```

> **Always `rethrow`** in `update` so the screen can react (show a success message, pop, etc.) only after a confirmed success.  
> In `load` you may choose to swallow the error if the screen shows an empty state gracefully.

---

## 5 — Screen

Location: `lib/features/<feature>/screens/<feature>_edit_screen.dart`

```dart
class <Feature>EditScreen extends StatefulWidget {
  const <Feature>EditScreen({super.key});
  @override
  State<<Feature>EditScreen> createState() => _<Feature>EditScreenState();
}

class _<Feature>EditScreenState extends State<<Feature>EditScreen> {
  final _formKey = GlobalKey<FormState>();
  final _fieldAController = TextEditingController();
  final _fieldBController = TextEditingController();
  // … one controller per editable field

  @override
  void initState() {
    super.initState();
    // Pre-populate with existing server data.
    _populate(context.read<<Feature>Provider>().data);
  }

  @override
  void dispose() {
    _fieldAController.dispose();
    _fieldBController.dispose();
    super.dispose();
  }

  void _populate(<Feature>Response? data) {
    if (data == null) return;
    _fieldAController.text = data.fieldA ?? '';
    _fieldBController.text = data.fieldB ?? '';
  }

  Future<void> _save() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;

    // Helper: empty string → null so toJson skips the field.
    String? val(TextEditingController c) {
      final v = c.text.trim();
      return v.isEmpty ? null : v;
    }

    final request = <Feature>UpdateRequest(
      fieldA: val(_fieldAController),
      fieldB: val(_fieldBController),
    );

    final provider = context.read<<Feature>Provider>();
    try {
      await provider.update(request: request);
      if (!mounted) return;
      AppAlert.show(message: '<Feature> updated successfully.');
      context.pop();
    } catch (_) {
      // SessionManager.handleError already showed a dialog inside the provider.
    }
  }

  @override
  Widget build(BuildContext context) {
    final isSaving = context.select<<Feature>Provider, bool>((p) => p.isUpdating);

    return Scaffold(
      // … your AppLayoutShell / hero header here
      body: Form(
        key: _formKey,
        child: Column(
          children: [
            InputField<String>(
              controller: _fieldAController,
              labelText: 'Field A',
              validator: (v) => (v ?? '').trim().isEmpty ? 'Required' : null,
            ),
            InputField<String>(
              controller: _fieldBController,
              labelText: 'Field B',
            ),
            AppButton(
              title: isSaving ? 'Saving…' : 'Save Changes',
              expands: true,
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

### Key screen rules

| Rule | Reason |
|---|---|
| Pre-populate in `initState` via `context.read` | Avoids a rebuild-on-read during build |
| `val(controller)` helper for null conversion | One place that turns empty → null |
| Build `<Feature>UpdateRequest` in `_save` | Screen owns the mapping; service owns the HTTP |
| `try/catch` in `_save`, catch swallows | Provider `rethrow`s so the screen knows success vs. error |
| `if (!mounted) return` after `await` | Guards against navigation after widget disposal |
| `context.select` for `isUpdating` only | Minimises rebuilds — full rebuild only on provider swap |

---

## 6 — Route

```dart
// In AppRoute enum (router.dart):
<feature>Edit('/<feature>/edit'),

// In GoRouter routes list:
GoRoute(
  name: AppRoute.<feature>Edit.name,
  path: AppRoute.<feature>Edit.path,
  builder: (context, state) => const <Feature>EditScreen(),
),
```

Navigate with `context.push(AppRoute.<feature>Edit.path)` so the user can come back.

---

## Checklist

- [ ] `<Feature>UpdateRequest` model created with nullable fields and `get toJson` null-filter
- [ ] `<Feature>Response` model has all nullable JSON fields typed as `T?`
- [ ] Service has separate `get current` (GET) and `update` (PATCH/PUT) methods
- [ ] Provider has separate `isLoading` / `isUpdating` booleans — never reuse the same flag
- [ ] Provider `update` calls `rethrow` so the screen can detect success
- [ ] Screen pre-populates controllers in `initState` via `context.read`
- [ ] Screen `_save` builds the request model then calls `provider.update(request: request)`
- [ ] No null-filtering logic outside of `get toJson`
- [ ] Route uses `context.push` (not `go`) so back navigation works
