# iPF Flutter Starter Pack — Preferences & Secure Storage

## BasePreferences (SharedPreferences — non-sensitive)

```dart
class AppPreferences extends BasePreferences {
  static final AppPreferences instance = AppPreferences._();
  AppPreferences._();

  Future<String?> get language => fetch<String>("language");
  Future<bool?> get isDarkMode => fetch<bool>("dark_mode");

  void setLanguage(String lang) => save<String>("language", lang);
  void setDarkMode(bool v) => save<bool>("dark_mode", v);
}
```

Methods: `fetch<T>(key)`, `save<T>(key, value)`, `remove(key)`, `clearAll()`

## BaseSecurePreferences (FlutterSecureStorage — sensitive)

```dart
class AppSecurePrefs extends BaseSecurePreferences {
  static final AppSecurePrefs instance = AppSecurePrefs._();
  AppSecurePrefs._();

  Future<String?> get token => fetch<String>("token");
  Future<void> saveToken(String t) => save<String>("token", t);
  Future<void> clearSession() => remove("token");
}
```

Supported types: `String`, `int`, `double`, `bool`, `List<String>`, `Map<String,dynamic>`

Methods: `fetch<T>(key)`, `save<T>(key, value)`, `remove(key)`, `clearAll()`

- iOS: Keychain | Android: EncryptedSharedPreferences + Keystore
