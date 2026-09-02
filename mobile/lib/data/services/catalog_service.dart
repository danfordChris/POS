import 'package:pos_mobile/core/network/api_client.dart';
import 'package:pos_mobile/core/network/api_exception.dart';
import 'package:pos_mobile/models/catalog_models.dart';

/// Catalog + inventory calls, tenant-scoped under
/// `/v1/businesses/{businessId}/...`. Static-method class over `ApiClient.instance`.
class CatalogService {
  CatalogService._();

  static Future<Paged<Product>> listProducts(
    String businessId, {
    String? q,
    String? categoryId,
    String? active,
    String? cursor,
  }) async {
    final data = await ApiClient.instance.get<Map<String, dynamic>>(
      _Endpoints.products(businessId),
      query: {
        if (q != null && q.isNotEmpty) 'q': q,
        'category_id': ?categoryId,
        'active': ?active,
        'cursor': ?cursor,
        'limit': 50,
      },
    );
    return Paged.fromJson(data, Product.fromJson);
  }

  static Future<Product> getProduct(String businessId, String id) async {
    final data = await ApiClient.instance.get<Map<String, dynamic>>(
      _Endpoints.product(businessId, id),
    );
    return Product.fromJson(data);
  }

  /// Scan lookup — returns null when no product carries [code].
  static Future<Product?> findByCode(String businessId, String code) async {
    try {
      final data = await ApiClient.instance.get<Map<String, dynamic>>(
        _Endpoints.products(businessId),
        query: {'code': code},
      );
      final page = Paged.fromJson(data, Product.fromJson);
      return page.data.isEmpty ? null : page.data.first;
    } on ApiException catch (e) {
      if (e.code == 'not_found') return null;
      rethrow;
    }
  }

  static Future<List<Category>> listCategories(String businessId) async {
    final data = await ApiClient.instance.get<List<dynamic>>(
      _Endpoints.categories(businessId),
    );
    return data
        .map((e) => Category.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  static Future<Product> createProduct(
    String businessId,
    Map<String, dynamic> body,
  ) async {
    final data = await ApiClient.instance.post<Map<String, dynamic>>(
      _Endpoints.products(businessId),
      body: body,
    );
    return Product.fromJson(data);
  }

  static Future<Product> updateProduct(
    String businessId,
    String id,
    Map<String, dynamic> body,
  ) async {
    final data = await ApiClient.instance.patch<Map<String, dynamic>>(
      _Endpoints.product(businessId, id),
      body: body,
    );
    return Product.fromJson(data);
  }

  static Future<void> deactivate(String businessId, String id) async {
    await ApiClient.instance.post<dynamic>(
      _Endpoints.deactivate(businessId, id),
    );
  }

  // ── stock ───────────────────────────────────────────────────────────────────

  static Future<List<StockItem>> listStock(String businessId) async {
    final data = await ApiClient.instance.get<Map<String, dynamic>>(
      _Endpoints.stock(businessId),
      query: {'limit': 100},
    );
    return ((data['data'] as List?) ?? [])
        .map((e) => StockItem.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  static Future<Paged<StockMovement>> listMovements(
    String businessId, {
    String? productId,
    String? type,
    String? cursor,
  }) async {
    final data = await ApiClient.instance.get<Map<String, dynamic>>(
      _Endpoints.movements(businessId),
      query: {
        'product_id': ?productId,
        'type': ?type,
        'cursor': ?cursor,
        'limit': 50,
      },
    );
    return Paged.fromJson(data, StockMovement.fromJson);
  }

  static Future<({StockMovement movement, int onHand})> recordMovement(
    String businessId, {
    required String productId,
    required String type,
    required int quantityDelta,
    String? reason,
  }) async {
    final data = await ApiClient.instance.post<Map<String, dynamic>>(
      _Endpoints.movements(businessId),
      body: {
        'product_id': productId,
        'type': type,
        'quantity_delta': quantityDelta,
        if (reason != null && reason.isNotEmpty) 'reason': reason,
      },
    );
    return (
      movement: StockMovement.fromJson(
        data['movement'] as Map<String, dynamic>,
      ),
      onHand: (data['on_hand'] as num).toInt(),
    );
  }
}

class _Endpoints {
  _Endpoints._();
  static String _b(String id) => '/v1/businesses/$id';
  static String products(String b) => '${_b(b)}/products';
  static String product(String b, String id) => '${_b(b)}/products/$id';
  static String deactivate(String b, String id) =>
      '${_b(b)}/products/$id/deactivate';
  static String categories(String b) => '${_b(b)}/categories';
  static String stock(String b) => '${_b(b)}/stock';
  static String movements(String b) => '${_b(b)}/stock/movements';
}
