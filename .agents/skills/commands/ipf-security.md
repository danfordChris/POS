# iPF Flutter Starter Pack — Security

## SSL Certificate Pinning

```dart
// Get fingerprint:
// openssl s_client -connect api.example.com:443 < /dev/null 2>/dev/null | openssl x509 -pubkey -noout | openssl pkey -pubin -outform der | openssl dgst -sha256 -binary | base64

StarterAPIManagement(
  allowedSHAFingerprints: ["sha256/AAAA...="],
)
```

## Digital Signature (RSA)

When `privateKeyPEM` + `publicKeyPEM` are set, request bodies are automatically:
1. Canonically stringified (keys sorted)
2. Signed with private key
3. Wrapped as `{"data": {...}, "signature": "..."}`

```dart
StarterAPIManagement(
  privateKeyPEM: "-----BEGIN RSA PRIVATE KEY-----\n...",
  publicKeyPEM: "-----BEGIN PUBLIC KEY-----\n...",
)
```

## Encrypted Database

```dart
// Auto-generates password stored in FlutterSecureStorage (keyed by db filename)
AppDatabase._() : super.encrypted("app.db", 1, models);
```

## Secure Storage

- Use `BaseSecurePreferences` for tokens, PINs, passwords
- iOS: Keychain | Android: Keystore
- Never store sensitive data in `BasePreferences` (SharedPreferences)

## Environment Variables

```dart
class AppEnv extends BaseEnvHelper {
  static String get baseUrl => AppEnv()._instance.env("BASE_URL") ?? "";
}
// Load in main: await dotenv.load(fileName: ".env");
```
