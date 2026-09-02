import 'package:flutter/foundation.dart';
import 'api_client.dart';
import 'api_exception.dart';
import 'auth_repository.dart';
import 'token_store.dart';

enum SessionStatus { loading, signedOut, needsBusiness, ready }

/// Owns auth state for the whole app. `GoRouter` listens to this for redirects.
class SessionController extends ChangeNotifier {
  SessionController({ApiClient? api, TokenStore? store})
    : _api = api ?? ApiClient(),
      _store = store ?? TokenStore() {
    _repo = AuthRepository(_api);
    _api.onTokensRefreshed = (a, r) => _store.writeTokens(a, r);
    _api.onAuthLost = () => signOut();
  }

  final ApiClient _api;
  final TokenStore _store;
  late final AuthRepository _repo;

  SessionStatus status = SessionStatus.loading;
  AuthUser? user;
  String? businessId;
  String? businessName;
  String? role;
  String? lastError;

  bool get isReady => status == SessionStatus.ready;

  /// Called once at startup. Any storage/plugin failure lands the user on the
  /// sign-in screen rather than crashing the app.
  Future<void> bootstrap() async {
    try {
      final tokens = await _store.readTokens();
      if (tokens.access == null || tokens.refresh == null) {
        _set(SessionStatus.signedOut);
        return;
      }
      _api.setTokens(access: tokens.access, refresh: tokens.refresh);
      await _loadUserThenBusiness();
    } catch (_) {
      _set(SessionStatus.signedOut);
    }
  }

  Future<void> signIn(String email, String password) async {
    lastError = null;
    try {
      final pair = await _repo.login(email, password);
      await _store.writeTokens(pair.access, pair.refresh);
      _api.setTokens(access: pair.access, refresh: pair.refresh);
      await _loadUserThenBusiness();
    } on ApiException catch (e) {
      lastError = e.message;
      rethrow;
    }
  }

  Future<void> register(String name, String email, String password) async {
    lastError = null;
    try {
      await _repo.register(name, email, password);
      await signIn(email, password);
    } on ApiException catch (e) {
      lastError = e.message;
      rethrow;
    }
  }

  Future<void> createBusiness(String name, String currency) async {
    lastError = null;
    try {
      final biz = await _repo.createBusiness(name, currency);
      await _store.writeBusiness(biz.id, 'owner');
      businessId = biz.id;
      businessName = biz.name;
      role = 'owner';
      _set(SessionStatus.ready);
    } on ApiException catch (e) {
      lastError = e.message;
      rethrow;
    }
  }

  Future<void> signOut() async {
    final tokens = await _store.readTokens();
    if (tokens.refresh != null) {
      try {
        await _repo.logout(tokens.refresh!);
      } on ApiException {
        // best effort
      }
    }
    await _store.clear();
    _api.setTokens(access: null, refresh: null);
    user = null;
    businessId = businessName = role = null;
    _set(SessionStatus.signedOut);
  }

  Future<void> _loadUserThenBusiness() async {
    try {
      user = await _repo.me();
    } on ApiException {
      await _store.clear();
      _api.setTokens(access: null, refresh: null);
      _set(SessionStatus.signedOut);
      return;
    }

    final biz = await _store.readBusiness();
    if (biz.id == null) {
      _set(SessionStatus.needsBusiness);
      return;
    }
    try {
      final info = await _repo.getBusiness(biz.id!);
      businessId = info.id;
      businessName = info.name;
      role = info.role ?? biz.role ?? 'staff';
      _set(SessionStatus.ready);
    } on ApiException {
      // Lost access to the stored business.
      businessId = businessName = role = null;
      _set(SessionStatus.needsBusiness);
    }
  }

  void _set(SessionStatus s) {
    status = s;
    notifyListeners();
  }
}
