import 'api_client.dart';

class AuthUser {
  AuthUser({required this.id, required this.name, this.email, this.phone});
  final String id;
  final String name;
  final String? email;
  final String? phone;

  factory AuthUser.fromJson(Map<String, dynamic> j) => AuthUser(
    id: j['id'] as String,
    name: (j['name'] as String?) ?? '',
    email: j['email'] as String?,
    phone: j['phone'] as String?,
  );
}

class TokenPair {
  TokenPair(this.access, this.refresh);
  final String access;
  final String refresh;

  factory TokenPair.fromJson(Map<String, dynamic> j) =>
      TokenPair(j['accessToken'] as String, j['refreshToken'] as String);
}

class BusinessInfo {
  BusinessInfo({required this.id, required this.name, this.role});
  final String id;
  final String name;
  final String? role;

  factory BusinessInfo.fromJson(Map<String, dynamic> j) => BusinessInfo(
    id: j['id'] as String,
    name: (j['name'] as String?) ?? 'Business',
    role: j['role'] as String?,
  );
}

class AuthRepository {
  AuthRepository(this._api);
  final ApiClient _api;

  Future<TokenPair> login(String email, String password) async {
    final data = await _api.post<Map<String, dynamic>>(
      '/v1/auth/login',
      body: {'email': email, 'password': password},
      noAuth: true,
    );
    return TokenPair.fromJson(data);
  }

  Future<void> register(String name, String email, String password) async {
    await _api.post<dynamic>(
      '/v1/auth/register',
      body: {'name': name, 'email': email, 'password': password},
      noAuth: true,
    );
  }

  Future<TokenPair> refresh(String refreshToken) async {
    final data = await _api.post<Map<String, dynamic>>(
      '/v1/auth/refresh',
      body: {'refreshToken': refreshToken},
      noAuth: true,
    );
    return TokenPair.fromJson(data);
  }

  Future<void> logout(String refreshToken) async {
    await _api.post<dynamic>(
      '/v1/auth/logout',
      body: {'refreshToken': refreshToken},
      noAuth: true,
    );
  }

  Future<AuthUser> me() async {
    final data = await _api.get<Map<String, dynamic>>('/v1/auth/me');
    return AuthUser.fromJson(data);
  }

  Future<BusinessInfo> createBusiness(String name, String currency) async {
    final data = await _api.post<Map<String, dynamic>>(
      '/v1/businesses',
      body: {'name': name, 'currency': currency},
    );
    return BusinessInfo.fromJson(data);
  }

  Future<BusinessInfo> getBusiness(String id) async {
    final data = await _api.get<Map<String, dynamic>>('/v1/businesses/$id');
    return BusinessInfo.fromJson(data);
  }
}
