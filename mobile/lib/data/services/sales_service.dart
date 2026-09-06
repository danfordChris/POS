import 'package:pos_mobile/core/network/api_client.dart';
import 'package:pos_mobile/models/catalog_models.dart' show Paged;
import 'package:pos_mobile/models/sale_models.dart';

/// Sales + receipts, tenant-scoped under `/v1/businesses/{businessId}/sales`.
/// Static-method class over `ApiClient.instance`.
class SalesService {
  SalesService._();

  static String _sales(String b) => '/v1/businesses/$b/sales';

  static Future<Sale> createSale(
    String businessId, {
    required List<SaleLineInput> lines,
    String? customerLabel,
    String? idempotencyKey,
  }) async {
    final data = await ApiClient.instance.post<Map<String, dynamic>>(
      _sales(businessId),
      body: {
        'lines': lines.map((l) => l.toJson()).toList(),
        if (customerLabel != null && customerLabel.isNotEmpty)
          'customer_label': customerLabel,
      },
      headers: idempotencyKey != null
          ? {'Idempotency-Key': idempotencyKey}
          : null,
    );
    return Sale.fromJson(data);
  }

  static Future<Sale> getSale(String businessId, String id) async {
    final data = await ApiClient.instance.get<Map<String, dynamic>>(
      '${_sales(businessId)}/$id',
    );
    return Sale.fromJson(data);
  }

  static Future<Paged<Sale>> listSales(
    String businessId, {
    String? cursor,
    String? status,
  }) async {
    final data = await ApiClient.instance.get<Map<String, dynamic>>(
      _sales(businessId),
      query: {'cursor': ?cursor, 'status': ?status, 'limit': 25},
    );
    return Paged.fromJson(data, Sale.fromJson);
  }
}
