import 'package:pos_mobile/core/network/api_client.dart';
import 'package:pos_mobile/models/catalog_models.dart' show Paged;
import 'package:pos_mobile/models/invoice_models.dart';

/// Trade customers, tenant-scoped under `/v1/businesses/{id}/customers`.
class CustomerService {
  const CustomerService();

  static String _base(String b) => '/v1/businesses/$b/customers';

  Future<Paged<Customer>> list(
    String businessId, {
    String? q,
    bool hasBalance = false,
    String? cursor,
  }) async {
    final data = await ApiClient.instance.get<Map<String, dynamic>>(
      _base(businessId),
      query: {
        'q': ?q,
        if (hasBalance) 'has_balance': 'true',
        'cursor': ?cursor,
        'limit': 25,
      },
    );
    return Paged.fromJson(data, Customer.fromJson);
  }

  Future<Customer> create(
    String businessId, {
    required String name,
    String? email,
    String? phone,
  }) async {
    final data = await ApiClient.instance.post<Map<String, dynamic>>(
      _base(businessId),
      body: {
        'name': name,
        if (email != null && email.isNotEmpty) 'email': email,
        if (phone != null && phone.isNotEmpty) 'phone': phone,
      },
    );
    return Customer.fromJson(data);
  }
}
