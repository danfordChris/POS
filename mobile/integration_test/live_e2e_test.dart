// End-to-end test of the mobile networking layer against the LIVE Kong edge.
//
// Runs the real Dio `ApiClient`, the service classes, and the JSON models on an
// actual device/simulator, driving the same register -> login -> business ->
// catalog -> stock flow the UI uses.
//
// Requires the local stack up (`docker compose -f infra/docker-compose.yml up`)
// and migrations applied. From `mobile/`:
//
//   flutter test integration_test/live_e2e_test.dart \
//     -d <simulator-udid> --dart-define=API_BASE_URL=http://localhost:8000
//
// On the Android emulator use --dart-define=API_BASE_URL=http://10.0.2.2:8000.

import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:pos_mobile/core/network/api_client.dart';
import 'package:pos_mobile/data/services/auth_service.dart';
import 'package:pos_mobile/data/services/catalog_service.dart';

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  final stamp = DateTime.now().millisecondsSinceEpoch;
  final email = 'mobile_e2e+$stamp@example.com';
  const password = 'correct horse battery staple';

  late String businessId;
  late String productId;

  test('register + login through Kong', () async {
    await AuthService.register('Mobile E2E', email, password);
    final tokens = await AuthService.login(email, password);
    expect(tokens.access, isNotEmpty);
    expect(tokens.refresh, isNotEmpty);
    ApiClient.instance.setTokens(access: tokens.access, refresh: tokens.refresh);

    final me = await AuthService.me();
    expect(me.email, email);
  });

  test('create business -> caller is owner', () async {
    final biz = await AuthService.createBusiness('Mobile E2E Shop', 'TZS');
    businessId = biz.id;
    expect(businessId, isNotEmpty);

    final fetched = await AuthService.getBusiness(businessId);
    expect(fetched.role, 'owner');
  });

  test('catalog: create category + product, scan by code', () async {
    final categories = await CatalogService.listCategories(businessId);
    expect(categories, isA<List>());

    final product = await CatalogService.createProduct(businessId, {
      'sku': 'M-SKU-$stamp',
      'name': 'Mobile Cola 500ml',
      'code': 'M-CODE-$stamp',
      'reorder_threshold': 5,
      'cost_price': 700,
      'sell_price': 1000,
    });
    productId = product.id;
    expect(productId, isNotEmpty);

    final hit = await CatalogService.findByCode(businessId, 'M-CODE-$stamp');
    expect(hit?.id, productId);

    final miss = await CatalogService.findByCode(businessId, 'NOPE-$stamp');
    expect(miss, isNull);
  });

  test('inventory: stock_in then adjustment moves on-hand', () async {
    // Give the catalog -> inventory ProductUpserted event time to land.
    await Future<void>.delayed(const Duration(seconds: 2));

    final a = await CatalogService.recordMovement(
      businessId,
      productId: productId,
      type: 'stock_in',
      quantityDelta: 20,
      reason: 'initial',
    );
    expect(a.onHand, 20);

    final b = await CatalogService.recordMovement(
      businessId,
      productId: productId,
      type: 'adjustment',
      quantityDelta: -5,
      reason: 'shrink',
    );
    expect(b.onHand, 15);

    final stock = await CatalogService.listStock(businessId);
    final item = stock.firstWhere((s) => s.productId == productId);
    expect(item.onHand, 15);
  });
}
