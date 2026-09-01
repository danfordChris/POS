# iPF Flutter Starter Pack — Project Setup

Use this note when bootstrapping a new Flutter app with `ipf_flutter_starter_pack`.

## Dependency

Prefer the local package path when it exists on the machine that is running the generator.

```yaml
dependencies:
  ipf_flutter_starter_pack:
    path: /Users/danfordchris/projects/iPF_Flutter_Starter_Pack
```

If the local path is unavailable, fall back to the git dependency:

```yaml
dependencies:
  ipf_flutter_starter_pack:
    git:
      url: https://github.com/iPFSoftwares/iPF_Flutter_Starter_Pack.git
      ref: main
```

## Install Skills

```bash
dart run ipf_flutter_starter_pack:initialize_skills
```

Fallback for older starter-pack versions:

```bash
dart run ipf_flutter_starter_pack:install_skills
```

## Required Setup Steps

1. Add `go_router`, `provider`, and `flutter_dotenv` if the scaffold uses the default provider stack.
2. Run the starter-pack skill installer.
3. Configure Android network permissions and core library desugaring.
4. Update the iOS bundle identifier and display name.
5. Generate project-level `AGENTS.md`, `CLAUDE.md`, `.claude/commands`, and `.claude/skills`.

## Main Entrypoint Expectations

```dart
void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await dotenv.load(fileName: '.env');
  await AppDatabase.instance.init();
  AppNotificationService.instance.init();
  runApp(MultiProvider(providers: appProviders, child: const ProjectApp()));
}
```

## Starter-Pack Skill Areas

- `/ipf-api` - HTTP requests, auth headers, SSL pinning, multipart uploads
- `/ipf-database` - SQLite CRUD, migrations, encryption
- `/ipf-state` - Provider state with BaseDataProvider
- `/ipf-preferences` - SharedPreferences and SecureStorage
- `/ipf-notifications` - Local push notifications
- `/ipf-utils` - Navigation, AppUtility, SocketManager
- `/ipf-widgets` - BaseTextField, BaseButton, BaseImage, BaseDropdown
- `/ipf-extensions` - String, DateTime, Number, BuildContext extensions
- `/ipf-security` - SSL pinning, digital signatures
- `/ipf-codegen` - Model and repository code generation
