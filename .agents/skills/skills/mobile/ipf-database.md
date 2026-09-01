# iPF Flutter Starter Pack — Database Management

Use this skill for SQLite database operations with `BaseDatabaseManager`, `BaseDatabaseModel`, `BaseDataRepository`.

## Define a model

```dart
class UserModel extends BaseDatabaseModel {
  final int? id;
  final String name;
  final String email;

  UserModel({this.id, required this.name, required this.email});

  factory UserModel.fromDatabase(Map<String, dynamic> map) => UserModel(
    id: BaseModel.castToInt(map["id"]),
    name: BaseModel.castToString(map["name"]),
    email: BaseModel.castToString(map["email"]),
  );

  @override Map<String, dynamic> get toMap => {"id": id, "name": name, "email": email};
  @override String get tableName => "users";
  @override Map<String, String> get toSchema => {
    "id": "INTEGER PRIMARY KEY",
    "name": "TEXT NOT NULL",
    "email": "TEXT NOT NULL",
  };
}
```

## Create the database manager

```dart
class AppDatabase extends BaseDatabaseManager {
  static final AppDatabase instance = AppDatabase._();
  // Plain: super("app.db", version, models)
  // Encrypted: super.encrypted("app.db", version, models)
  AppDatabase._() : super("app.db", 2, [UserModel(name: "", email: "")]);
}

// main.dart
AppDatabase.instance.init();
```

## Create a repository

```dart
class UserRepository extends BaseDataRepository<UserModel> {
  UserRepository() : super(
    AppDatabase.instance,
    UserModel(name: "", email: ""),
    (map) => UserModel.fromDatabase(map),
  );
}
```

## CRUD via repository

```dart
final repo = UserRepository();
List<UserModel> all = await repo.all;
UserModel? found = await repo.findById(1);
UserModel? found = await repo.findWhere("email = ?", ["x@x.com"]);
UserModel? saved = await repo.save(user);
bool ok = await repo.saveBatch([u1, u2]);
bool ok = await repo.replaceBatch(freshList);
bool ok = await repo.insertOrUpdateBy(list, "email");
UserModel? updated = await repo.update(user);
UserModel? deleted = await repo.delete(user);
await repo.deleteWhereId(1);
```

## Migration — add columns by bumping version

Just add new columns to `toSchema` and bump the version number. `ALTER TABLE` runs automatically.

## Casting helpers

```dart
BaseModel.castToInt(val)      // int, double, or String → int?
BaseModel.castToDouble(val)   // → double?
BaseModel.castToString(val)   // null/"null"/"" → ""
BaseModel.castToBool(val)     // bool/String/"true"/0/1 → bool?
BaseModel.parse(map, Gen.fromJson)       // null-safe nested object
BaseModel.parseList(list, Gen.fromJson)  // null-safe list
