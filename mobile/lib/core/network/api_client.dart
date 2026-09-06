import 'package:dio/dio.dart';
import 'package:pos_mobile/core/network/api_exception.dart';

/// Base URL for the POS edge (Kong). Override at build time:
///   flutter run --dart-define=API_BASE_URL=http://10.0.2.2:8000
const String kApiBaseUrl = String.fromEnvironment(
  'API_BASE_URL',
  defaultValue: 'http://localhost:8000',
);

/// Thin Dio wrapper for the Kong edge: attaches the bearer token, refreshes once
/// on 401, and maps every failure to [ApiException].
///
/// Singleton — `ApiClient.instance`. The `SessionProvider` owns the token
/// lifecycle (`setTokens`, `onTokensRefreshed`, `onAuthLost`); feature services
/// call `ApiClient.instance` and never construct their own.
class ApiClient {
  ApiClient._({Dio? dio}) : _dio = dio ?? Dio() {
    _dio.options
      ..baseUrl = kApiBaseUrl
      ..connectTimeout = const Duration(seconds: 10)
      ..receiveTimeout = const Duration(seconds: 15)
      ..headers['content-type'] = 'application/json'
      ..validateStatus = (s) => s != null && s < 500;

    _dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) {
          if (_accessToken != null && options.extra['noAuth'] != true) {
            options.headers['authorization'] = 'Bearer $_accessToken';
          }
          handler.next(options);
        },
      ),
    );
  }

  static final ApiClient instance = ApiClient._();

  /// Test seam — swap the underlying Dio (and its MockAdapter) before use.
  static ApiClient debugWith(Dio dio) => ApiClient._(dio: dio);

  final Dio _dio;

  String? _accessToken;
  String? _refreshToken;

  /// Called after a refresh so the owner can persist the new tokens.
  void Function(String access, String refresh)? onTokensRefreshed;

  /// Called when refresh fails — the session is over.
  void Function()? onAuthLost;

  void setTokens({String? access, String? refresh}) {
    _accessToken = access;
    _refreshToken = refresh;
  }

  // ── requests ──────────────────────────────────────────────────────────────

  Future<T> get<T>(String path, {Map<String, dynamic>? query}) =>
      _send<T>('GET', path, query: query);

  Future<T> post<T>(
    String path, {
    Object? body,
    bool noAuth = false,
    Map<String, String>? headers,
  }) => _send<T>('POST', path, body: body, noAuth: noAuth, headers: headers);

  Future<T> patch<T>(String path, {Object? body}) =>
      _send<T>('PATCH', path, body: body);

  Future<T> _send<T>(
    String method,
    String path, {
    Object? body,
    Map<String, dynamic>? query,
    bool noAuth = false,
    bool isRetry = false,
    Map<String, String>? headers,
  }) async {
    Response<dynamic> res;
    try {
      res = await _dio.request<dynamic>(
        path,
        data: body,
        queryParameters: query,
        options: Options(
          method: method,
          extra: {'noAuth': noAuth},
          headers: headers,
        ),
      );
    } on DioException catch (e) {
      if (e.response != null) {
        res = e.response!;
      } else {
        throw ApiException.network(e);
      }
    }

    if (res.statusCode == 401 && !noAuth && !isRetry && _refreshToken != null) {
      final ok = await _refresh();
      if (ok) {
        return _send<T>(
          method,
          path,
          body: body,
          query: query,
          noAuth: noAuth,
          isRetry: true,
          headers: headers,
        );
      }
      onAuthLost?.call();
    }

    if (res.statusCode != null &&
        res.statusCode! >= 200 &&
        res.statusCode! < 300) {
      return res.data as T;
    }
    throw _toApiException(res);
  }

  Future<bool> _refresh() async {
    try {
      final res = await _dio.post<dynamic>(
        '/v1/auth/refresh',
        data: {'refreshToken': _refreshToken},
        options: Options(extra: {'noAuth': true}),
      );
      if (res.statusCode == 200 && res.data is Map) {
        final data = res.data as Map;
        _accessToken = data['accessToken'] as String?;
        _refreshToken = data['refreshToken'] as String?;
        if (_accessToken != null && _refreshToken != null) {
          onTokensRefreshed?.call(_accessToken!, _refreshToken!);
          return true;
        }
      }
    } on DioException {
      // fall through
    }
    return false;
  }

  ApiException _toApiException(Response<dynamic> res) {
    final data = res.data;
    if (data is Map && data['error'] is Map) {
      final err = data['error'] as Map;
      return ApiException(
        code: (err['code'] as String?) ?? 'unknown',
        message: (err['message'] as String?) ?? 'Request failed',
        devMessage: err['devMessage'] as String?,
        status: res.statusCode ?? 0,
        details:
            (err['details'] as List?)
                ?.whereType<Map>()
                .map((m) => m.cast<String, dynamic>())
                .toList() ??
            const [],
      );
    }
    return ApiException(
      code: 'unknown',
      message: 'Request failed (${res.statusCode})',
      status: res.statusCode ?? 0,
    );
  }
}
