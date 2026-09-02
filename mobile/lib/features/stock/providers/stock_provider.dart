import 'package:pos_mobile/data/services/catalog_service.dart';
import 'package:pos_mobile/shared/providers/base_provider.dart';

/// Records manual stock movements (stock-in / adjustment). Kept separate from
/// [CatalogProvider] so a movement screen doesn't rebuild the catalog list.
class StockProvider extends BaseProvider {
  int? _lastOnHand;
  int? get lastOnHand => _lastOnHand;

  Future<bool> record(
    String businessId, {
    required String productId,
    required String type, // stock_in | adjustment
    required int quantityDelta,
    String? reason,
  }) async {
    final result = await guard(() {
      return CatalogService.recordMovement(
        businessId,
        productId: productId,
        type: type,
        quantityDelta: quantityDelta,
        reason: reason,
      );
    });
    if (result == null) return false;
    _lastOnHand = result.onHand;
    notifyListeners();
    return true;
  }
}
