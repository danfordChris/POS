# iPF Flutter Starter Pack — State Management

Use this skill for Provider-based state with `BaseDataProvider<T>`.

## Extend BaseDataProvider

```dart
class UserProvider extends BaseDataProvider<UserModel> {
  final UserRepository _repo = UserRepository();

  @override
  Future<void> refresh() async => fetchUsers();

  Future<void> fetchUsers() async {
    setFetchState(true);
    try {
      setData(await _repo.all);
    } catch (e) {
      Scenery.showError(e.toString().replaceFirst("Exception: ", ""));
    } finally {
      setFetchState(false);
    }
  }

  Future<void> createUser(Map<String, dynamic> data) async {
    setCreateState(true);
    try {
      final user = await UserApiService.create(data);
      if (user != null) setData([...this.data, user]);
    } catch (e) {
      Scenery.showError(e.toString().replaceFirst("Exception: ", ""));
    } finally {
      setCreateState(false);
    }
  }
}
```

## State properties

```dart
provider.fetching   // loading state
provider.creating   // create state
provider.updating   // update state
provider.deleting   // delete state
provider.data       // List<T>
```

## Register & consume

```dart
// Register
MultiProvider(providers: [ChangeNotifierProvider(create: (_) => UserProvider())])

// Consume — watch (rebuilds)
final provider = context.stateWatch<UserProvider>();
// Consume — read (no rebuild)
final provider = context.stateRead<UserProvider>();
// Both at once
final (watch, read) = context.statePair<UserProvider>();

// In Consumer
Consumer<UserProvider>(builder: (ctx, p, _) => ...)
```
