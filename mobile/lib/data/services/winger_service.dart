import 'package:pos_mobile/core/network/api_client.dart';
import 'package:pos_mobile/models/catalog_models.dart' show Paged;
import 'package:pos_mobile/models/winger_models.dart';

/// Winger portal, under `/v1/winger/*`. These routes carry a user context but no
/// membership scope — the winger service authorizes each call against its own
/// `winger_account` rows.
abstract class WingerApi {
  Future<List<WingerBusiness>> listBusinesses();
  Future<Paged<WingerProduct>> listProducts(String businessId, {String? cursor});
}

class WingerService implements WingerApi {
  const WingerService();

  @override
  Future<List<WingerBusiness>> listBusinesses() async {
    final data = await ApiClient.instance.get<List<dynamic>>(
      '/v1/winger/businesses',
    );
    return data
        .map((e) => WingerBusiness.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  @override
  Future<Paged<WingerProduct>> listProducts(
    String businessId, {
    String? cursor,
  }) async {
    final data = await ApiClient.instance.get<Map<String, dynamic>>(
      '/v1/winger/businesses/$businessId/products',
      query: {'cursor': ?cursor, 'limit': 25},
    );
    return Paged.fromJson(data, WingerProduct.fromJson);
  }
}
