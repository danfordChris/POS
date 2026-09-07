import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';

import 'package:pos_mobile/data/services/winger_service.dart';
import 'package:pos_mobile/features/auth/providers/session_provider.dart';
import 'package:pos_mobile/features/winger/providers/winger_provider.dart';
import 'package:pos_mobile/features/winger/screens/winger_catalog_screen.dart';
import 'package:pos_mobile/models/catalog_models.dart' show Paged;
import 'package:pos_mobile/models/winger_models.dart';
import 'package:pos_mobile/shared/widgets/neu_badge.dart';

class _OneBusinessApi implements WingerApi {
  @override
  Future<List<WingerBusiness>> listBusinesses() async => [
    WingerBusiness(businessId: 'b1', businessName: 'Alpha Store'),
  ];

  @override
  Future<Paged<WingerProduct>> listProducts(
    String businessId, {
    String? cursor,
  }) async => Paged([
    WingerProduct(
      name: 'Sukari 1kg',
      price: 2500,
      currency: 'TZS',
      inStock: true,
      imageUrl: null,
    ),
    WingerProduct(
      name: 'Mchele 2kg',
      price: 5000,
      currency: 'TZS',
      inStock: false,
      imageUrl: null,
    ),
  ], null);
}

void main() {
  testWidgets('renders products with price, in-stock chip and a placeholder', (
    tester,
  ) async {
    final provider = WingerProvider(api: _OneBusinessApi());

    await tester.pumpWidget(
      MultiProvider(
        providers: [
          ChangeNotifierProvider<WingerProvider>.value(value: provider),
          ChangeNotifierProvider<SessionProvider>(
            create: (_) => SessionProvider(),
          ),
        ],
        child: const MaterialApp(home: WingerCatalogScreen()),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Alpha Store'), findsOneWidget); // app bar title
    expect(find.text('Sukari 1kg'), findsOneWidget);
    expect(find.text('TZS 2500'), findsOneWidget);
    expect(find.text('IN STOCK'), findsOneWidget); // NeuBadge upper-cases
    expect(find.text('OUT OF STOCK'), findsOneWidget);
    expect(find.byType(NeuBadge), findsNWidgets(2));
    // no image_url → the placeholder icon, not an Image.network
    expect(find.byIcon(Icons.image_outlined), findsNWidgets(2));
    expect(find.byType(Image), findsNothing);
  });
}
