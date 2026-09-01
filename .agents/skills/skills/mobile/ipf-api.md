# iPF Flutter Starter Pack — API Management

Use this skill when creating API service classes extending `BaseAPIManager`.

## Extend BaseAPIManager

```dart
class AppApiManager extends BaseAPIManager {
  static final AppApiManager instance = AppApiManager._();
  AppApiManager._() : super(
    "https://api.example.com/v1/",
    StarterAPIManagement(
      authorization: _authHeaders(),
    ),
  );

  static Future<Map<String, String>?> _authHeaders() async {
    final token = await AppSecurePrefs.instance.fetch<String>("token");
    if (token == null) return null;
    return {"Authorization": "Bearer $token"};
  }

  @override
  Future<StarterAPIManagement>? get refreshOnUnauthorized async {
    final newToken = await AuthService.refreshToken();
    if (newToken == null) return null;
    await AppSecurePrefs.instance.save<String>("token", newToken);
    return StarterAPIManagement(authorization: _authHeaders());
  }
}
```

## StarterAPIManagement options

```dart
StarterAPIManagement(
  authorization: Future<Map<String, String>?>,
  allowedSHAFingerprints: ['sha256/...'],
  privateKeyPEM: '-----BEGIN RSA PRIVATE KEY-----',
  publicKeyPEM: '-----BEGIN PUBLIC KEY-----',
  statusCodeActions: {403: () async => Scenery.showError("Forbidden")},
)
```

## Requests

```dart
// Raw http.Response
final r = await AppApiManager.instance.authGet("/profile");
final r = await AppApiManager.instance.authPost("/orders", body: data);
final r = await AppApiManager.instance.authPatch("/orders/1", body: data);
final r = await AppApiManager.instance.authDelete("/orders/1");

// Type-safe APIResponse<T> (recommended)
APIResponse<User> r = await AppApiManager.instance.apiAuthGet<User>("/profile");
User user = r.transform((m) => User.fromJson(m));
List<User> users = r.transformMany((m) => User.fromJson(m));
r.raiseOnError();
```

## APIResponse methods

```dart
response.isSuccessful          // bool
response.statusCode            // int
response.message               // String? from "message" key
response.mapData               // Map<String,dynamic> from "data" key
response.responseBody          // dynamic decoded JSON
response.transform(generator)  // single object (handles data-keyed or flat)
response.transformMany(gen)    // list (handles data-keyed or flat list)
response.raiseOnError()        // throws Exception with server message
response.showError((code) =>)  // custom error by status code
response.expect({"id": int})   // validate response shape
response.log()                 // debug log status + body
```

## Multipart upload

```dart
await AppApiManager.instance.createMultipartFormData<T>(
  url: "/upload",
  fields: {"type": "avatar"},
  files: {"file": "/path/to/image.jpg"},
);
```

## Error handling

- SocketException → "No Internet Connection Found"
- TimeoutException → "A request took too long to complete" (1 min default)
- FormatException → "The server returned an unexpected format"
- 401 → triggers refreshOnUnauthorized, retries once
