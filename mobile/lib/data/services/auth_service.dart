import 'package:pos_mobile/core/network/api_client.dart';
import 'package:pos_mobile/models/auth_models.dart';

/// Identity + tenancy auth calls. Static-method class over `ApiClient.instance`.
class AuthService {
  AuthService._();

  static Future<TokenPair> login(String email, String password) async {
    final data = await ApiClient.instance.post<Map<String, dynamic>>(
      _Endpoints.login,
      body: {'email': email, 'password': password},
      noAuth: true,
    );
    return TokenPair.fromJson(data);
  }

  static Future<void> register(
    String name,
    String email,
    String password,
  ) async {
    await ApiClient.instance.post<dynamic>(
      _Endpoints.register,
      body: {'name': name, 'email': email, 'password': password},
      noAuth: true,
    );
  }

  static Future<TokenPair> refresh(String refreshToken) async {
    final data = await ApiClient.instance.post<Map<String, dynamic>>(
      _Endpoints.refresh,
      body: {'refreshToken': refreshToken},
      noAuth: true,
    );
    return TokenPair.fromJson(data);
  }

  static Future<void> logout(String refreshToken) async {
    await ApiClient.instance.post<dynamic>(
      _Endpoints.logout,
      body: {'refreshToken': refreshToken},
      noAuth: true,
    );
  }

  static Future<AuthUser> me() async {
    final data = await ApiClient.instance.get<Map<String, dynamic>>(
      _Endpoints.me,
    );
    return AuthUser.fromJson(data);
  }

  static Future<BusinessInfo> createBusiness(
    String name,
    String currency,
  ) async {
    final data = await ApiClient.instance.post<Map<String, dynamic>>(
      _Endpoints.businesses,
      body: {'name': name, 'currency': currency},
    );
    return BusinessInfo.fromJson(data);
  }

  static Future<BusinessInfo> getBusiness(String id) async {
    final data = await ApiClient.instance.get<Map<String, dynamic>>(
      _Endpoints.business(id),
    );
    return BusinessInfo.fromJson(data);
  }
}

class _Endpoints {
  _Endpoints._();
  static const String login = '/v1/auth/login';
  static const String register = '/v1/auth/register';
  static const String refresh = '/v1/auth/refresh';
  static const String logout = '/v1/auth/logout';
  static const String me = '/v1/auth/me';
  static const String businesses = '/v1/businesses';
  static String business(String id) => '/v1/businesses/$id';
}
