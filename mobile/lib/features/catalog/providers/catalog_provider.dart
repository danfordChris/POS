import 'package:pos_mobile/data/services/catalog_service.dart';
import 'package:pos_mobile/models/catalog_models.dart';
import 'package:pos_mobile/shared/providers/base_provider.dart';

/// Catalog list + detail + write state. App-wide (registered in providers.dart)
/// so the list survives tab switches while a product is opened/edited.
class CatalogProvider extends BaseProvider {
  final List<Product> _products = [];
  List<Category> _categories = [];
  final Map<String, StockItem> _stock = {};
  String? _nextCursor;
  String _query = '';

  List<Product> get products => List.unmodifiable(_products);
  List<Category> get categories => List.unmodifiable(_categories);
  String get query => _query;
  bool get hasMore => _nextCursor != null;

  StockItem? stockFor(String productId) => _stock[productId];
  Product? productById(String id) {
    for (final p in _products) {
      if (p.id == id) return p;
    }
    return null;
  }

  Future<void> load(String businessId, {String? query}) async {
    _query = query ?? _query;
    await guard(() async {
      final results = await Future.wait([
        CatalogService.listProducts(businessId, q: _query),
        CatalogService.listCategories(businessId),
        CatalogService.listStock(businessId),
      ]);
      final page = results[0] as Paged<Product>;
      _products
        ..clear()
        ..addAll(page.data);
      _nextCursor = page.nextCursor;
      _categories = results[1] as List<Category>;
      _stock
        ..clear()
        ..addEntries(
          (results[2] as List<StockItem>).map((s) => MapEntry(s.productId, s)),
        );
    });
  }

  Future<void> loadMore(String businessId) async {
    final cursor = _nextCursor;
    if (cursor == null || isBusy) return;
    await guard(() async {
      final page = await CatalogService.listProducts(
        businessId,
        q: _query,
        cursor: cursor,
      );
      _products.addAll(page.data);
      _nextCursor = page.nextCursor;
    });
  }

  /// Create (when [id] is null) or update. Returns the saved product, or null on
  /// failure (see [error]).
  Future<Product?> save(
    String businessId, {
    String? id,
    required Map<String, dynamic> body,
  }) async {
    final saved = await guard(() {
      return id == null
          ? CatalogService.createProduct(businessId, body)
          : CatalogService.updateProduct(businessId, id, body);
    });
    if (saved != null) _upsert(saved);
    return saved;
  }

  Future<bool> deactivate(String businessId, String id) async {
    final ok = await guard(() async {
      await CatalogService.deactivate(businessId, id);
      final fresh = await CatalogService.getProduct(businessId, id);
      _upsert(fresh);
    });
    return ok != null;
  }

  /// Scan lookup. Returns the product, or null when no product carries [code].
  /// Sets [error] on a transport failure.
  Future<Product?> lookupByCode(String businessId, String code) async {
    return guard<Product?>(() => CatalogService.findByCode(businessId, code));
  }

  Future<Product> refreshOne(String businessId, String id) async {
    final fresh = await CatalogService.getProduct(businessId, id);
    _upsert(fresh);
    notifyListeners();
    return fresh;
  }

  void _upsert(Product p) {
    final i = _products.indexWhere((x) => x.id == p.id);
    if (i >= 0) {
      _products[i] = p;
    } else {
      _products.insert(0, p);
    }
  }
}
