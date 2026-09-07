import 'package:pos_mobile/core/network/api_client.dart';
import 'package:pos_mobile/core/network/api_exception.dart';
import 'package:pos_mobile/data/services/auth_service.dart';
import 'package:pos_mobile/data/services/winger_service.dart';
import 'package:pos_mobile/data/token_store.dart';
import 'package:pos_mobile/models/auth_models.dart';
import 'package:pos_mobile/shared/providers/base_provider.dart';

/// `winger` — a reseller with no membership; the app shows only the winger
/// portal (see `createRouter`).
enum SessionStatus { loading, signedOut, needsBusiness, winger, ready }

/// App-wide auth state. `GoRouter` redirects on [status]; registered in
/// `appProviders` so it outlives every route.
class SessionProvider extends BaseProvider {
  SessionProvider({TokenStore? store, WingerApi? winger})
    : _store = store ?? TokenStore(),
      _winger = winger ?? const WingerService() {
    ApiClient.instance.onTokensRefreshed = _store.writeTokens;
    ApiClient.instance.onAuthLost = signOut;
  }

  final TokenStore _store;
  final WingerApi _winger;

  SessionStatus _status = SessionStatus.loading;
  AuthUser? _user;
  String? _businessId;
  String? _businessName;
  String? _role;

  SessionStatus get status => _status;
  AuthUser? get user => _user;
  String? get businessId => _businessId;
  String? get businessName => _businessName;
  String? get role => _role;
  bool get isOwner => _role == 'owner';
  bool get isWinger => _status == SessionStatus.winger;

  /// Called once at startup. Any storage/plugin failure lands the user on the
  /// sign-in screen rather than crashing the app.
  Future<void> bootstrap() async {
    try {
      final tokens = await _store.readTokens();
      if (tokens.access == null || tokens.refresh == null) {
        _set(SessionStatus.signedOut);
        return;
      }
      ApiClient.instance.setTokens(
        access: tokens.access,
        refresh: tokens.refresh,
      );
      await _loadUserThenBusiness();
    } catch (_) {
      _set(SessionStatus.signedOut);
    }
  }

  Future<void> signIn(String email, String password) async {
    final pair = await AuthService.login(email, password);
    await _store.writeTokens(pair.access, pair.refresh);
    ApiClient.instance.setTokens(access: pair.access, refresh: pair.refresh);
    await _loadUserThenBusiness();
  }

  Future<void> register(String name, String email, String password) async {
    await AuthService.register(name, email, password);
    await signIn(email, password);
  }

  Future<void> createBusiness(String name, String currency) async {
    final biz = await AuthService.createBusiness(name, currency);
    await _store.writeBusiness(biz.id, 'owner');
    _businessId = biz.id;
    _businessName = biz.name;
    _role = 'owner';
    _set(SessionStatus.ready);
  }

  Future<void> signOut() async {
    final tokens = await _store.readTokens();
    if (tokens.refresh != null) {
      try {
        await AuthService.logout(tokens.refresh!);
      } on ApiException {
        // best effort
      }
    }
    await _store.clear();
    ApiClient.instance.setTokens(access: null, refresh: null);
    _user = null;
    _businessId = _businessName = _role = null;
    _set(SessionStatus.signedOut);
  }

  Future<void> _loadUserThenBusiness() async {
    try {
      _user = await AuthService.me();
    } on ApiException {
      await _store.clear();
      ApiClient.instance.setTokens(access: null, refresh: null);
      _set(SessionStatus.signedOut);
      return;
    }

    final biz = await _store.readBusiness();
    if (biz.id != null) {
      try {
        final info = await AuthService.getBusiness(biz.id!);
        _businessId = info.id;
        _businessName = info.name;
        _role = info.role ?? biz.role ?? 'staff';
        _set(SessionStatus.ready);
        return;
      } on ApiException {
        _businessId = _businessName = _role = null;
      }
    }

    // No owner/staff membership resolved. A reseller with an active
    // winger_account gets the winger portal; anyone else must create a business.
    _set(await _isWinger() ? SessionStatus.winger : SessionStatus.needsBusiness);
  }

  Future<bool> _isWinger() async {
    try {
      final businesses = await _winger.listBusinesses();
      return businesses.isNotEmpty;
    } catch (_) {
      return false;
    }
  }

  void _set(SessionStatus s) {
    _status = s;
    notifyListeners();
  }
}
