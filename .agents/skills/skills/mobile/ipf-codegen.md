# iPF Flutter Starter Pack — Code Generation

## BaseModelGenerator

```dart
BaseModelGenerator(
  className: "Product",
  fields: {"id": int, "name": String, "price": double, "createdAt": DateTime},
  isDatabaseModel: true,
).generate();
```

Outputs: constructor, `fromJson`, `fromDatabase`, `toJson`, `toMap`, `tableName`, `toSchema`, `copyWith`, `merge`.

Field type → SQLite: `int`→INTEGER, `double`→REAL, `bool`→INTEGER, `String`→TEXT, `DateTime`→TEXT.

## RepositoryGenerator

```dart
RepositoryGenerator(
  modelName: "Product",
  databaseManagerClass: "AppDatabase",
).generate();
```

Outputs a `ProductRepository extends BaseDataRepository<Product>`.

## Run generation

```bash
# Install skills + generate marker
flutter pub run build_runner build --delete-conflicting-outputs

# Install skills only
dart run ipf_flutter_starter_pack:install_skills
```

## Tool script pattern

```dart
// tool/generate.dart
void main() {
  print(BaseModelGenerator(className: "User", fields: {...}, isDatabaseModel: true).generate());
}
// dart run tool/generate.dart > lib/models/user.dart
```
