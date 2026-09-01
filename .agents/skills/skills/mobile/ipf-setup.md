# iPF Flutter Starter Pack — Project Setup

Use this skill when initializing a new Flutter project using `ipf_flutter_starter_pack`.

## 1. pubspec.yaml dependency

```yaml
dependencies:
  ipf_flutter_starter_pack:
    git:
      url: https://github.com/iPFSoftwares/iPF_Flutter_Starter_Pack.git
      ref: main
```

## 2. Install Claude skills into this project

```bash
dart run ipf_flutter_starter_pack:install_skills
```

Or auto-install via build_runner:

```bash
flutter pub run build_runner build --delete-conflicting-outputs
```

## 3. main.dart initialization

```dart
void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await dotenv.load(fileName: ".env");
  AppDatabase.instance.init();
  AppNotificationService.instance.init();
  runApp(MultiProvider(providers: [...], child: const MyApp()));
}
```

## 4. Available skills

- `/ipf-api` — HTTP requests, auth headers, SSL pinning, multipart uploads
- `/ipf-database` — SQLite CRUD, migrations, encryption
- `/ipf-state` — Provider state with BaseDataProvider
- `/ipf-preferences` — SharedPreferences and SecureStorage
- `/ipf-notifications` — Local push notifications
- `/ipf-utils` — Navigation (Scenery), AppUtility, SocketManager
- `/ipf-widgets` — BaseTextField, BaseButton, BaseImage, BaseDropdown
- `/ipf-extensions` — String, DateTime, Number, BuildContext extensions
- `/ipf-security` — SSL pinning, digital signatures
- `/ipf-codegen` — Model and repository code generation
