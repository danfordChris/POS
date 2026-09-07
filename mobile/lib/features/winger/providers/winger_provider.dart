import 'package:pos_mobile/data/services/winger_service.dart';
import 'package:pos_mobile/models/winger_models.dart';
import 'package:pos_mobile/shared/providers/base_provider.dart';

/// Winger catalog state: the businesses the caller resells for, the selected
/// one, and its paged product list. App-wide so the selection survives rebuilds.
class WingerProvider extends BaseProvider {
  WingerProvider({WingerApi? api}) : _api = api ?? const WingerService();

  final WingerApi _api;

  final List<WingerBusiness> _businesses = [];
  String? _selectedBusinessId;
  final List<WingerProduct> _products = [];
  String? _nextCursor;

  List<WingerBusiness> get businesses => List.unmodifiable(_businesses);
  String? get selectedBusinessId => _selectedBusinessId;
  WingerBusiness? get selectedBusiness {
    for (final b in _businesses) {
      if (b.businessId == _selectedBusinessId) return b;
    }
    return null;
  }

  List<WingerProduct> get products => List.unmodifiable(_products);
  bool get hasMore => _nextCursor != null;

  /// Load the business list, then the first page for the (kept or first) selection.
  Future<void> load() async {
    await guard(() async {
      final list = await _api.listBusinesses();
      _businesses
        ..clear()
        ..addAll(list);

      final keep = _businesses.any((b) => b.businessId == _selectedBusinessId);
      _selectedBusinessId = keep
          ? _selectedBusinessId
          : (_businesses.isEmpty ? null : _businesses.first.businessId);

      await _loadProducts(reset: true);
    });
  }

  /// Switch the active business and reload its catalog.
  Future<void> selectBusiness(String businessId) async {
    if (businessId == _selectedBusinessId) return;
    _selectedBusinessId = businessId;
    _products.clear();
    _nextCursor = null;
    notifyListeners();
    await guard(() => _loadProducts(reset: true));
  }

  Future<void> refresh() => guard(() => _loadProducts(reset: true));

  Future<void> loadMore() async {
    if (_nextCursor == null || isBusy) return;
    await guard(() => _loadProducts(reset: false));
  }

  Future<void> _loadProducts({required bool reset}) async {
    final id = _selectedBusinessId;
    if (id == null) {
      _products.clear();
      _nextCursor = null;
      return;
    }
    final page = await _api.listProducts(
      id,
      cursor: reset ? null : _nextCursor,
    );
    if (reset) _products.clear();
    _products.addAll(page.data);
    _nextCursor = page.nextCursor;
  }
}
