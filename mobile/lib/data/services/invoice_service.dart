import 'package:pos_mobile/core/network/api_client.dart';
import 'package:pos_mobile/models/catalog_models.dart' show Paged;
import 'package:pos_mobile/models/invoice_models.dart';

/// Invoices, tenant-scoped under `/v1/businesses/{id}/invoices`. Read-only on
/// mobile — payments and void are done on the web console.
class InvoiceService {
  const InvoiceService();

  static String _base(String b) => '/v1/businesses/$b/invoices';

  Future<Invoice> get(String businessId, String id) async {
    final data = await ApiClient.instance.get<Map<String, dynamic>>(
      '${_base(businessId)}/$id',
    );
    return Invoice.fromJson(data);
  }

  Future<Paged<InvoiceSummary>> list(
    String businessId, {
    String? status,
    bool overdue = false,
    String? cursor,
  }) async {
    final data = await ApiClient.instance.get<Map<String, dynamic>>(
      _base(businessId),
      query: {
        'status': ?status,
        if (overdue) 'overdue': 'true',
        'cursor': ?cursor,
        'limit': 25,
      },
    );
    return Paged.fromJson(data, InvoiceSummary.fromJson);
  }
}
