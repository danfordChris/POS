import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Persists the auth tokens + the selected business in the platform keystore.
class TokenStore {
  TokenStore([FlutterSecureStorage? storage])
    : _s = storage ?? const FlutterSecureStorage();

  final FlutterSecureStorage _s;

  static const _kAccess = 'duka_access';
  static const _kRefresh = 'duka_refresh';
  static const _kBiz = 'duka_business';
  static const _kRole = 'duka_role';

  Future<({String? access, String? refresh})> readTokens() async {
    return (
      access: await _s.read(key: _kAccess),
      refresh: await _s.read(key: _kRefresh),
    );
  }

  Future<void> writeTokens(String access, String refresh) async {
    await _s.write(key: _kAccess, value: access);
    await _s.write(key: _kRefresh, value: refresh);
  }

  Future<({String? id, String? role})> readBusiness() async {
    return (id: await _s.read(key: _kBiz), role: await _s.read(key: _kRole));
  }

  Future<void> writeBusiness(String id, String role) async {
    await _s.write(key: _kBiz, value: id);
    await _s.write(key: _kRole, value: role);
  }

  Future<void> clear() async {
    await _s.deleteAll();
  }
}
